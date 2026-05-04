import { Hono } from 'hono';

import type { CheckResponse } from '../types.js';
import { transcribeAudioFile } from '../services/openaiTranscription.js';
import { quranMatcher } from '../services/quranMatcher.js';
import { detectMajorityAyah } from '../services/simpleCheck.js';
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

  const majority = detectMajorityAyah(transcriptWords, matchOptions);
  const alignedIndexes = new Set<number>();

  for (const item of majority.comparison.matched_words) {
    alignedIndexes.add(item.user_index);
  }

  for (const item of majority.comparison.incorrect_words) {
    alignedIndexes.add(item.user_index);
  }

  const userMajorityWords = [...alignedIndexes]
    .sort((left, right) => left - right)
    .map((index) => transcriptWords[index]!)
    .filter(Boolean);

  const extraWords = [...majority.comparison.extra_words]
    .sort((left, right) => left.user_index - right.user_index)
    .map((item) => item.word);

  let extraAyah: { surah_id: number; ayat_id: number; id: number; confidence: number } | null = null;
  if (extraWords.length > 0) {
    try {
      const extraMatch = quranMatcher.findBestMatch(extraWords.join(' '));
      if (extraMatch.ayah.id !== majority.ayah.id) {
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
    selected_ayah: {
      surah_id: majority.ayah.surah_id,
      ayat_id: majority.ayah.ayat_id,
      id: majority.ayah.id,
      majority_score: majority.majority_score,
    },
    user_read: {
      by_ayah: [
        {
          surah_id: majority.ayah.surah_id,
          ayat_id: majority.ayah.ayat_id,
          classification: 'majority',
          words: userMajorityWords,
          text: userMajorityWords.join(' '),
        },
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
      by_ayah: [
        {
          surah_id: majority.ayah.surah_id,
          ayat_id: majority.ayah.ayat_id,
          clean_text: majority.ayah.clean_text,
          display_text: majority.ayah.display_text,
          words: majority.ayah.words,
        },
      ],
    },
    error: {
      missing: majority.comparison.missing_words.map((item) => item.word),
      extra: extraWords,
      incorrect: majority.comparison.incorrect_words.map((item) => ({
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
