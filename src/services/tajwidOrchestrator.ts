import { randomUUID } from 'node:crypto';

import type {
  QuranAyahEntry,
  TajwidAnalysis,
  TajwidCapabilities,
  TajwidWorkerRequest,
  TajwidWorkerResponse,
} from '../types.js';
import {
  getTajwidAnnotationsByAyahId,
  summarizeTajwidAnnotations,
} from './tajwidAnnotations.js';
import {
  buildAnalyzedTajwidAnalysis,
  buildDisabledTajwidAnalysis,
  buildUnavailableTajwidAnalysis,
} from './tajwidFallback.js';
import { DEFAULT_TAJWID_WORKER_TIMEOUT_MS, SUPPORTED_TAJWID_RULES } from './tajwidRules.js';

interface TajwidTranscriptContext {
  raw: string;
  normalized: string;
  words: string[];
}

interface AnalyzeTajwidInput {
  file: File;
  targetAyah: QuranAyahEntry;
  transcript: TajwidTranscriptContext;
}

interface TajwidRuntimeConfig {
  envEnabled: boolean;
  enabled: boolean;
  workerConfigured: boolean;
  mode: TajwidCapabilities['mode'];
  workerUrl?: string;
  timeoutMs: number;
}

const parseTimeoutMs = (): number => {
  const raw = process.env.TAJWID_WORKER_TIMEOUT_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_TAJWID_WORKER_TIMEOUT_MS;
  }

  return parsed;
};

export const getTajwidRuntimeConfig = (): TajwidRuntimeConfig => {
  const envEnabled = process.env.TAJWID_ENABLED?.trim().toLowerCase() === 'true';
  const workerUrl = process.env.TAJWID_WORKER_URL?.trim() || undefined;
  const workerConfigured = Boolean(workerUrl);
  const enabled = envEnabled && workerConfigured;

  return {
    envEnabled,
    enabled,
    workerConfigured,
    mode: enabled ? 'audio_analysis' : 'transcript_only',
    ...(workerUrl ? { workerUrl } : {}),
    timeoutMs: parseTimeoutMs(),
  };
};

export const getTajwidCapabilities = (): TajwidCapabilities => {
  const config = getTajwidRuntimeConfig();

  return {
    enabled: config.enabled,
    mode: config.mode,
    worker_configured: config.workerConfigured,
    supported_rules: [...SUPPORTED_TAJWID_RULES],
    timeout_ms: config.timeoutMs,
  };
};

const isTajwidWorkerResponse = (value: unknown): value is TajwidWorkerResponse => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<TajwidWorkerResponse>;

  return (
    (candidate.status === 'analyzed' || candidate.status === 'unavailable') &&
    candidate.mode === 'audio_analysis' &&
    typeof candidate.worker_version === 'string' &&
    Array.isArray(candidate.mistakes) &&
    Array.isArray(candidate.warnings)
  );
};

export const analyzeTajwidForAyah = async ({
  file,
  targetAyah,
  transcript,
}: AnalyzeTajwidInput): Promise<TajwidAnalysis> => {
  const annotations = getTajwidAnnotationsByAyahId(targetAyah.id);
  const config = getTajwidRuntimeConfig();

  if (!config.envEnabled) {
    return buildDisabledTajwidAnalysis({
      annotations,
      workerUrl: config.workerUrl,
    });
  }

  if (!config.workerConfigured || !config.workerUrl) {
    return buildUnavailableTajwidAnalysis({
      annotations,
      workerUrl: config.workerUrl,
      attempted: false,
      reason: 'TAJWID_ENABLED is true but TAJWID_WORKER_URL is not configured.',
    });
  }

  const payload: TajwidWorkerRequest = {
    request_id: randomUUID(),
    surah_id: targetAyah.surah_id,
    ayat_id: targetAyah.ayat_id,
    ayah_id: targetAyah.id,
    expected_clean_text: targetAyah.clean_text,
    expected_display_text: targetAyah.display_text,
    transcript_normalized: transcript.normalized,
    target_words: targetAyah.words,
    rules: annotations?.rules ?? [],
  };

  const formData = new FormData();
  formData.set('file', file, file.name || 'recitation.audio');
  formData.set('payload', JSON.stringify(payload));

  try {
    const response = await fetch(config.workerUrl, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    if (!response.ok) {
      return buildUnavailableTajwidAnalysis({
        annotations,
        workerUrl: config.workerUrl,
        attempted: true,
        reason: `Tajwid worker returned HTTP ${response.status}.`,
      });
    }

    const parsed = (await response.json()) as unknown;
    if (!isTajwidWorkerResponse(parsed)) {
      return buildUnavailableTajwidAnalysis({
        annotations,
        workerUrl: config.workerUrl,
        attempted: true,
        reason: 'Tajwid worker returned an invalid response shape.',
      });
    }

    if (parsed.status !== 'analyzed') {
      return buildUnavailableTajwidAnalysis({
        annotations,
        workerUrl: config.workerUrl,
        attempted: true,
        reason: parsed.message ?? 'Tajwid worker could not analyze the audio.',
        warnings: parsed.warnings,
      });
    }

    return buildAnalyzedTajwidAnalysis({
      annotations,
      workerUrl: config.workerUrl,
      response: parsed,
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'TimeoutError'
        ? `Tajwid worker timed out after ${config.timeoutMs}ms.`
        : 'Tajwid worker request failed before analysis completed.';

    return buildUnavailableTajwidAnalysis({
      annotations,
      workerUrl: config.workerUrl,
      attempted: true,
      reason,
      warnings: [
        error instanceof Error ? error.message : 'Unknown worker request error.',
        `Annotated rules available: ${summarizeTajwidAnnotations(annotations).total_rules}.`,
      ],
    });
  }
};
