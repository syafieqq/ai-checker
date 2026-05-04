import { Hono } from 'hono';

import type { CheckResponse } from '../types.js';
import { transcribeAudioFile } from '../services/openaiTranscription.js';
import { quranMatcher } from '../services/quranMatcher.js';
import { analyzeTajwidForAyah } from '../services/tajwidOrchestrator.js';
import { normalizeArabic, splitWords } from '../utils/arabic.js';
import { AppError } from '../utils/errors.js';
import { getValidatedAudioFile, parseOptionalIntegerField } from '../utils/uploads.js';

const check = new Hono();

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
