import { Hono } from 'hono';

import type { CheckResponse } from '../types.js';
import { transcribeAudioFile } from '../services/openaiTranscription.js';
import { quranMatcher } from '../services/quranMatcher.js';
import { detectBestAyahWindow } from '../services/simpleCheck.js';
import { analyzeTajwidForAyah } from '../services/tajwidOrchestrator.js';
import { normalizeArabic, splitWords } from '../utils/arabic.js';
import { AppError } from '../utils/errors.js';
import { getValidatedAudioFile, parseOptionalIntegerField } from '../utils/uploads.js';

const check = new Hono();

check.get('/check', (c) => {
  return c.json({
    success: true,
    message: 'Use POST /api/check or POST /api/check/simple with multipart/form-data and a "file" field.',
  });
});

check.get('/check/simple', (c) => {
  return c.json({
    success: true,
    message:
      'Use POST /api/check/simple with multipart/form-data and a "file" field. Optional: surah_id, ayat_id.',
  });
});

check.post('/check/simple', async (c) => {
  const body = await c.req.parseBody();
  const file = getValidatedAudioFile(body.file);
  const surah_id = parseOptionalIntegerField(body.surah_id, 'surah_id');
  const ayat_id = parseOptionalIntegerField(body.ayat_id, 'ayat_id');

  if (ayat_id !== undefined && surah_id === undefined) {
    throw new AppError(400, '"ayat_id" requires "surah_id".', 'INVALID_LOOKUP_SCOPE');
  }

  const rawTranscript = await transcribeAudioFile(file);
  const normalizedTranscript = normalizeArabic(rawTranscript);
  const transcriptWords = splitWords(rawTranscript);

  if (transcriptWords.length === 0) {
    throw new AppError(422, 'Transcript is empty after normalization.', 'EMPTY_TRANSCRIPT');
  }

  const matchOptions =
    surah_id !== undefined || ayat_id !== undefined
      ? {
          ...(surah_id !== undefined ? { surah_id } : {}),
          ...(ayat_id !== undefined ? { ayat_id } : {}),
        }
      : undefined;

  const window = detectBestAyahWindow(transcriptWords, matchOptions);
  const extraWords = [...window.comparison.extra_words]
    .sort((left, right) => left.user_index - right.user_index)
    .map((item) => item.word);

  const userIndexesByAyah = window.boundaries.map(() => new Set<number>());

  const bindUserIndexToAyah = (targetIndex: number, userIndex: number): void => {
    const boundaryIndex = window.boundaries.findIndex(
      (boundary) => targetIndex >= boundary.start && targetIndex < boundary.end,
    );

    if (boundaryIndex >= 0) {
      userIndexesByAyah[boundaryIndex]!.add(userIndex);
    }
  };

  for (const item of window.comparison.matched_words) {
    bindUserIndexToAyah(item.target_index, item.user_index);
  }

  for (const item of window.comparison.incorrect_words) {
    bindUserIndexToAyah(item.target_index, item.user_index);
  }

  let extraAyah: { surah_id: number; ayat_id: number; id: number; confidence: number } | null = null;
  if (extraWords.length > 0) {
    try {
      const extraMatch = quranMatcher.findBestMatch(extraWords.join(' '));
      const inWindow = window.ayahs.some((ayah) => ayah.id === extraMatch.ayah.id);
      if (!inWindow) {
        extraAyah = {
          surah_id: extraMatch.ayah.surah_id,
          ayat_id: extraMatch.ayah.ayat_id,
          id: extraMatch.ayah.id,
          confidence: extraMatch.confidence,
        };
      }
    } catch {
      extraAyah = null;
    }
  }

  return c.json({
    success: true,
    transcript: {
      raw: rawTranscript,
      normalized: normalizedTranscript,
    },
    selected_ayah_range: {
      start: {
        surah_id: window.ayahs[0]!.surah_id,
        ayat_id: window.ayahs[0]!.ayat_id,
        id: window.ayahs[0]!.id,
      },
      end: {
        surah_id: window.ayahs[window.ayahs.length - 1]!.surah_id,
        ayat_id: window.ayahs[window.ayahs.length - 1]!.ayat_id,
        id: window.ayahs[window.ayahs.length - 1]!.id,
      },
      total_ayahs: window.ayahs.length,
      coverage_score: window.coverage_score,
    },
    user_read: {
      by_ayah: [
        ...window.boundaries.map((boundary, index) => {
          const words = [...userIndexesByAyah[index]!]
            .sort((left, right) => left - right)
            .map((userIndex) => transcriptWords[userIndex]!)
            .filter(Boolean);

          return {
            surah_id: boundary.ayah.surah_id,
            ayat_id: boundary.ayah.ayat_id,
            classification: 'detected',
            words,
            text: words.join(' '),
          };
        }),
        ...(extraWords.length > 0
          ? [
              {
                surah_id: extraAyah?.surah_id ?? null,
                ayat_id: extraAyah?.ayat_id ?? null,
                classification: 'extra',
                words: extraWords,
                text: extraWords.join(' '),
              },
            ]
          : []),
      ],
    },
    correct_text: {
      by_ayah: window.ayahs.map((ayah) => ({
        surah_id: ayah.surah_id,
        ayat_id: ayah.ayat_id,
        clean_text: ayah.clean_text,
        display_text: ayah.display_text,
        words: ayah.words,
      })),
    },
    error: {
      missing: window.comparison.missing_words.map((item) => item.word),
      extra: extraWords,
      incorrect: window.comparison.incorrect_words.map((item) => ({
        expected: item.expected,
        actual: item.actual,
      })),
    },
  });
});

check.post('/check', async (c) => {
  const body = await c.req.parseBody();
  const file = getValidatedAudioFile(body.file);
  const surah_id = parseOptionalIntegerField(body.surah_id, 'surah_id');
  const ayat_id = parseOptionalIntegerField(body.ayat_id, 'ayat_id');

  if (ayat_id !== undefined && surah_id === undefined) {
    throw new AppError(400, '"ayat_id" requires "surah_id".', 'INVALID_LOOKUP_SCOPE');
  }

  const rawTranscript = await transcribeAudioFile(file);
  const normalizedTranscript = normalizeArabic(rawTranscript);
  const transcriptWords = splitWords(rawTranscript);

  if (transcriptWords.length === 0) {
    throw new AppError(422, 'Transcript is empty after normalization.', 'EMPTY_TRANSCRIPT');
  }

  const matchOptions =
    surah_id !== undefined || ayat_id !== undefined
      ? {
          ...(surah_id !== undefined ? { surah_id } : {}),
          ...(ayat_id !== undefined ? { ayat_id } : {}),
        }
      : undefined;

  const match = quranMatcher.findBestMatch(rawTranscript, matchOptions);
  const tajwid = await analyzeTajwidForAyah({
    file,
    targetAyah: match.ayah,
    transcript: {
      raw: rawTranscript,
      normalized: normalizedTranscript,
      words: transcriptWords,
    },
  });

  const response: CheckResponse = {
    success: true,
    transcript: {
      raw: rawTranscript,
      normalized: normalizedTranscript,
      words: transcriptWords,
    },
    detected: {
      surah_id: match.ayah.surah_id,
      ayat_id: match.ayah.ayat_id,
      id: match.ayah.id,
      confidence: match.confidence,
    },
    target: {
      clean_text: match.ayah.clean_text,
      display_text: match.ayah.display_text,
      words: match.ayah.words,
    },
    result: {
      accuracy: match.comparison.accuracy,
      missing_words: match.comparison.missing_words,
      extra_words: match.comparison.extra_words,
      incorrect_words: match.comparison.incorrect_words,
      matched_words: match.comparison.matched_words,
    },
    tajwid,
  };

  return c.json(response);
});

export default check;
