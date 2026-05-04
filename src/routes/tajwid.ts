import { Hono } from 'hono';

import { transcribeAudioFile } from '../services/openaiTranscription.js';
import { getAyahBySurahAndAyat } from '../services/quranData.js';
import {
  analyzeTajwidForAyah,
  getTajwidCapabilities,
} from '../services/tajwidOrchestrator.js';
import { normalizeArabic, splitWords } from '../utils/arabic.js';
import { AppError } from '../utils/errors.js';
import { getValidatedAudioFile, parseOptionalIntegerField } from '../utils/uploads.js';

const tajwid = new Hono();

tajwid.get('/tajwid/capabilities', (c) => {
  return c.json(getTajwidCapabilities());
});

tajwid.post('/tajwid/check', async (c) => {
  const body = await c.req.parseBody();
  const file = getValidatedAudioFile(body.file);
  const surahId = parseOptionalIntegerField(body.surah_id, 'surah_id');
  const ayatId = parseOptionalIntegerField(body.ayat_id, 'ayat_id');

  if (surahId === undefined || ayatId === undefined) {
    throw new AppError(400, '"surah_id" and "ayat_id" are required for tajwid checking.', 'INVALID_LOOKUP_SCOPE');
  }

  const targetAyah = getAyahBySurahAndAyat(surahId, ayatId);
  if (!targetAyah) {
    throw new AppError(404, 'Requested ayah was not found.', 'AYAH_NOT_FOUND');
  }

  const rawTranscript = await transcribeAudioFile(file);
  const normalizedTranscript = normalizeArabic(rawTranscript);
  const transcriptWords = splitWords(rawTranscript);

  if (transcriptWords.length === 0) {
    throw new AppError(422, 'Transcript is empty after normalization.', 'EMPTY_TRANSCRIPT');
  }

  const tajwidAnalysis = await analyzeTajwidForAyah({
    file,
    targetAyah,
    transcript: {
      raw: rawTranscript,
      normalized: normalizedTranscript,
      words: transcriptWords,
    },
  });

  return c.json({
    success: true,
    transcript: {
      raw: rawTranscript,
      normalized: normalizedTranscript,
      words: transcriptWords,
    },
    target: {
      id: targetAyah.id,
      surah_id: targetAyah.surah_id,
      ayat_id: targetAyah.ayat_id,
      clean_text: targetAyah.clean_text,
      display_text: targetAyah.display_text,
      words: targetAyah.words,
    },
    tajwid: tajwidAnalysis,
  });
});

export default tajwid;
