import { Hono } from 'hono';

import { getAyahsBySurah } from '../services/quranData.js';
import { AppError } from '../utils/errors.js';

const surahs = new Hono();

surahs.get('/surahs/:surah_id/ayahs', (c) => {
  const surahId = Number.parseInt(c.req.param('surah_id'), 10);
  if (!Number.isInteger(surahId) || surahId <= 0) {
    throw new AppError(400, 'Invalid surah_id.', 'INVALID_SURAH_ID');
  }

  const ayahs = getAyahsBySurah(surahId);
  if (ayahs.length === 0) {
    throw new AppError(404, 'Surah not found.', 'SURAH_NOT_FOUND');
  }

  return c.json({
    surah_id: surahId,
    ayahs: ayahs.map((ayah) => ({
      id: ayah.id,
      ayat_id: ayah.ayat_id,
      clean_text: ayah.clean_text,
      display_text: ayah.display_text,
    })),
  });
});

export default surahs;
