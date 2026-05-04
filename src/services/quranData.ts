import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { QuranAyah, QuranAyahEntry } from '../types.js';
import { normalizeArabic, splitWords } from '../utils/arabic.js';
import { AppError } from '../utils/errors.js';

interface QuranDataStore {
  allAyahs: QuranAyahEntry[];
  cleanById: Map<number, QuranAyah>;
  displayById: Map<number, QuranAyah>;
  mergedById: Map<number, QuranAyahEntry>;
  ayahsBySurah: Map<number, QuranAyahEntry[]>;
  ayahLookup: Map<string, QuranAyahEntry>;
}

const cleanPath = path.resolve(process.cwd(), 'data', 'quran_texts_clean.json');
const displayPath = path.resolve(process.cwd(), 'data', 'quran_texts.json');

const readQuranJson = (filePath: string): QuranAyah[] => {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error('Expected JSON array.');
    }

    return parsed.map((item, index) => {
      const ayah = item as Partial<QuranAyah>;
      if (
        typeof ayah.id !== 'number' ||
        typeof ayah.surah_id !== 'number' ||
        typeof ayah.ayat_id !== 'number' ||
        typeof ayah.text !== 'string'
      ) {
        throw new Error(`Invalid Quran record at index ${index}.`);
      }

      return {
        id: ayah.id,
        surah_id: ayah.surah_id,
        ayat_id: ayah.ayat_id,
        text: ayah.text,
      };
    });
  } catch {
    throw new AppError(500, `Failed to load Quran data from ${path.basename(filePath)}.`, 'QURAN_DATA_ERROR', {
      expose: false,
    });
  }
};

const buildQuranDataStore = (): QuranDataStore => {
  const cleanData = readQuranJson(cleanPath);
  const displayData = readQuranJson(displayPath);

  if (cleanData.length === 0 || displayData.length === 0) {
    throw new AppError(500, 'Quran data files are empty.', 'QURAN_DATA_EMPTY', { expose: false });
  }

  if (cleanData.length !== displayData.length) {
    throw new AppError(500, 'Quran data files do not contain the same number of ayahs.', 'QURAN_DATA_MISMATCH', {
      expose: false,
    });
  }

  const cleanById = new Map<number, QuranAyah>();
  const displayById = new Map<number, QuranAyah>();
  const mergedById = new Map<number, QuranAyahEntry>();
  const ayahsBySurah = new Map<number, QuranAyahEntry[]>();
  const ayahLookup = new Map<string, QuranAyahEntry>();

  for (const ayah of cleanData) {
    cleanById.set(ayah.id, ayah);
  }

  for (const ayah of displayData) {
    displayById.set(ayah.id, ayah);
  }

  for (const cleanAyah of cleanData) {
    const displayAyah = displayById.get(cleanAyah.id);

    if (!displayAyah) {
      throw new AppError(500, `Missing display ayah for id ${cleanAyah.id}.`, 'QURAN_DATA_MISMATCH', {
        expose: false,
      });
    }

    if (
      displayAyah.surah_id !== cleanAyah.surah_id ||
      displayAyah.ayat_id !== cleanAyah.ayat_id
    ) {
      throw new AppError(500, `Ayah metadata mismatch for id ${cleanAyah.id}.`, 'QURAN_DATA_MISMATCH', {
        expose: false,
      });
    }

    const entry: QuranAyahEntry = {
      id: cleanAyah.id,
      surah_id: cleanAyah.surah_id,
      ayat_id: cleanAyah.ayat_id,
      clean_text: cleanAyah.text,
      display_text: displayAyah.text,
      normalized_text: normalizeArabic(cleanAyah.text),
      words: splitWords(cleanAyah.text),
    };

    mergedById.set(entry.id, entry);
    ayahLookup.set(`${entry.surah_id}:${entry.ayat_id}`, entry);

    const existing = ayahsBySurah.get(entry.surah_id) ?? [];
    existing.push(entry);
    ayahsBySurah.set(entry.surah_id, existing);
  }

  for (const ayahs of ayahsBySurah.values()) {
    ayahs.sort((left, right) => left.ayat_id - right.ayat_id);
  }

  const allAyahs = [...mergedById.values()].sort((left, right) => left.id - right.id);

  return {
    allAyahs,
    cleanById,
    displayById,
    mergedById,
    ayahsBySurah,
    ayahLookup,
  };
};

const store = buildQuranDataStore();

export const quranLoaded = true;

export const getTotalAyahs = (): number => store.allAyahs.length;

export const getAllAyahs = (): QuranAyahEntry[] => store.allAyahs;

export const getAyahsBySurah = (surahId: number): QuranAyahEntry[] => {
  return store.ayahsBySurah.get(surahId) ?? [];
};

export const getAyahBySurahAndAyat = (
  surahId: number,
  ayatId: number,
): QuranAyahEntry | undefined => {
  return store.ayahLookup.get(`${surahId}:${ayatId}`);
};

export const getQuranDataMaps = () => ({
  cleanById: store.cleanById,
  displayById: store.displayById,
  ayahsBySurah: store.ayahsBySurah,
});
