import type { TajwidAnalysis, TajwidAyahAnnotations, TajwidWorkerResponse } from '../types.js';
import { summarizeTajwidAnnotations } from './tajwidAnnotations.js';

interface FallbackOptions {
  annotations?: TajwidAyahAnnotations | undefined;
  workerUrl?: string | undefined;
}

interface UnavailableOptions extends FallbackOptions {
  attempted: boolean;
  reason: string;
  warnings?: string[];
}

interface AnalyzedOptions extends FallbackOptions {
  response: TajwidWorkerResponse;
}

const buildWorkerMeta = (
  options: {
    attempted: boolean;
    enabled: boolean;
    configured: boolean;
    workerUrl?: string | undefined;
    workerVersion?: string | undefined;
    alignmentConfidence?: number | undefined;
    warnings?: string[] | undefined;
  },
): TajwidAnalysis['worker'] => {
  return {
    attempted: options.attempted,
    enabled: options.enabled,
    configured: options.configured,
    ...(options.workerUrl ? { url: options.workerUrl } : {}),
    ...(options.workerVersion ? { worker_version: options.workerVersion } : {}),
    ...(options.alignmentConfidence !== undefined
      ? { alignment_confidence: options.alignmentConfidence }
      : {}),
    warnings: options.warnings ?? [],
  };
};

export const buildDisabledTajwidAnalysis = ({
  annotations,
  workerUrl,
}: FallbackOptions): TajwidAnalysis => {
  return {
    supported: false,
    mode: 'transcript_only',
    status: 'disabled',
    mistakes: [],
    message: 'Audio tajwid analysis is disabled. Returning annotated rules present in the target ayah only.',
    reason:
      'This backend can identify tajwid rule locations from the Quran text, but real tajwid mistake detection requires an external audio analysis worker.',
    next_step:
      'Set TAJWID_ENABLED=true and configure TAJWID_WORKER_URL to enable audio-based tajwid analysis.',
    annotations: summarizeTajwidAnnotations(annotations),
    worker: buildWorkerMeta({
      attempted: false,
      enabled: false,
      configured: Boolean(workerUrl),
      workerUrl,
    }),
  };
};

export const buildUnavailableTajwidAnalysis = ({
  annotations,
  workerUrl,
  attempted,
  reason,
  warnings,
}: UnavailableOptions): TajwidAnalysis => {
  return {
    supported: false,
    mode: 'audio_analysis',
    status: 'unavailable',
    mistakes: [],
    message: 'Audio tajwid analysis is currently unavailable. Returning annotated rules present in the target ayah only.',
    reason,
    next_step:
      'Check the tajwid worker health, request payload contract, and timeout settings before retrying audio analysis.',
    annotations: summarizeTajwidAnnotations(annotations),
    worker: buildWorkerMeta({
      attempted,
      enabled: true,
      configured: Boolean(workerUrl),
      workerUrl,
      warnings,
    }),
  };
};

export const buildAnalyzedTajwidAnalysis = ({
  annotations,
  workerUrl,
  response,
}: AnalyzedOptions): TajwidAnalysis => {
  return {
    supported: true,
    mode: 'audio_analysis',
    status: 'analyzed',
    ...(response.overall_score !== undefined ? { overall_score: response.overall_score } : {}),
    mistakes: response.mistakes,
    message: response.message ?? 'Audio-based tajwid analysis completed.',
    reason:
      'This result was produced by the configured tajwid worker using annotated rule spans and the uploaded recitation audio.',
    next_step:
      'Calibrate thresholds and expand rule coverage with labeled recitation examples before using this for high-stakes assessment.',
    annotations: summarizeTajwidAnnotations(annotations),
    worker: buildWorkerMeta({
      attempted: true,
      enabled: true,
      configured: Boolean(workerUrl),
      workerUrl,
      workerVersion: response.worker_version,
      alignmentConfidence: response.alignment_confidence,
      warnings: response.warnings,
    }),
  };
};
