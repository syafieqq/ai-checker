import type { QuranAyahEntry, WordComparisonResult } from '../types.js';
import { AppError } from '../utils/errors.js';
import { getAllAyahs, getAyahBySurahAndAyat, getAyahsBySurah } from './quranData.js';
import { quranMatcher } from './quranMatcher.js';

interface SimpleCheckOptions {
  surah_id?: number;
  ayat_id?: number;
}

interface AyahWindowBoundary {
  ayah: QuranAyahEntry;
  start: number;
  end: number;
}

interface AyahWindowResult {
  ayahs: QuranAyahEntry[];
  boundaries: AyahWindowBoundary[];
  comparison: WordComparisonResult;
  coverage_score: number;
}

const round = (value: number, digits = 4): number => {
  return Number(value.toFixed(digits));
};

const getCandidates = (options?: SimpleCheckOptions): QuranAyahEntry[] => {
  const surahId = options?.surah_id;
  const ayatId = options?.ayat_id;

  if (surahId !== undefined && ayatId !== undefined) {
    const ayah = getAyahBySurahAndAyat(surahId, ayatId);
    if (!ayah) {
      throw new AppError(404, `Ayah ${surahId}:${ayatId} not found.`, 'AYAH_NOT_FOUND');
    }

    return [ayah];
  }

  if (surahId !== undefined) {
    const ayahs = getAyahsBySurah(surahId);
    if (ayahs.length === 0) {
      throw new AppError(404, `Surah ${surahId} not found.`, 'SURAH_NOT_FOUND');
    }

    return ayahs;
  }

  return getAllAyahs();
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const toWordBoundaries = (ayahs: QuranAyahEntry[]): AyahWindowBoundary[] => {
  const boundaries: AyahWindowBoundary[] = [];
  let cursor = 0;

  for (const ayah of ayahs) {
    const start = cursor;
    cursor += ayah.words.length;
    boundaries.push({
      ayah,
      start,
      end: cursor,
    });
  }

  return boundaries;
};

const toCombinedWords = (ayahs: QuranAyahEntry[]): string[] => {
  return ayahs.flatMap((ayah) => ayah.words);
};

const getWindowScore = (comparison: WordComparisonResult): number => {
  const aligned = comparison.matched_words.length + comparison.incorrect_words.length;
  const errors = comparison.missing_words.length + comparison.extra_words.length;
  return aligned * 2 - errors + comparison.score;
};

const getMaxWindowSize = (transcriptWordCount: number): number => {
  const estimate = Math.ceil(transcriptWordCount / 8) + 2;
  return clamp(estimate, 1, 8);
};

const getSeedIndex = (
  candidates: QuranAyahEntry[],
  options: SimpleCheckOptions | undefined,
  transcriptWords: string[],
): number => {
  if (options?.ayat_id !== undefined && options?.surah_id !== undefined) {
    return 0;
  }

  if (candidates.length === 1) {
    return 0;
  }

  const seed = quranMatcher.findBestMatch(transcriptWords.join(' '), options);
  const index = candidates.findIndex((ayah) => ayah.id === seed.ayah.id);
  return index >= 0 ? index : Math.floor(candidates.length / 2);
};

export const detectBestAyahWindow = (
  transcriptWords: string[],
  options?: SimpleCheckOptions,
): AyahWindowResult => {
  if (transcriptWords.length === 0) {
    throw new AppError(422, 'Transcript is empty after normalization.', 'EMPTY_TRANSCRIPT');
  }

  const candidates = getCandidates(options);
  if (candidates.length === 0) {
    throw new AppError(404, 'No Quran ayah candidates were available for matching.', 'NO_CANDIDATES');
  }

  const exactAyahRequested = options?.surah_id !== undefined && options?.ayat_id !== undefined;
  const maxWindowSize = exactAyahRequested ? 1 : getMaxWindowSize(transcriptWords.length);
  const seedIndex = getSeedIndex(candidates, options, transcriptWords);
  const backtrack = Math.min(maxWindowSize - 1, seedIndex);
  const lookahead = Math.min(maxWindowSize - 1, candidates.length - seedIndex - 1);

  let best: AyahWindowResult | undefined;
  let bestWindowScore = Number.NEGATIVE_INFINITY;

  for (let start = seedIndex - backtrack; start <= seedIndex; start += 1) {
    for (
      let end = seedIndex + 1;
      end <= Math.min(candidates.length, seedIndex + lookahead + 2);
      end += 1
    ) {
      const windowSize = end - start;
      if (windowSize <= 0 || windowSize > maxWindowSize) {
        continue;
      }

      const ayahs = candidates.slice(start, end);
      const boundaries = toWordBoundaries(ayahs);
      const combinedWords = toCombinedWords(ayahs);
      const comparison = quranMatcher.compareWords(transcriptWords, combinedWords);
      const windowScore = getWindowScore(comparison);

      if (!best || windowScore > bestWindowScore) {
        best = {
          ayahs,
          boundaries,
          comparison,
          coverage_score: round(windowScore),
        };
        bestWindowScore = windowScore;
        continue;
      }

      if (
        windowScore === bestWindowScore &&
        (comparison.score > best.comparison.score ||
          (comparison.score === best.comparison.score && ayahs.length < best.ayahs.length))
      ) {
        best = {
          ayahs,
          boundaries,
          comparison,
          coverage_score: round(windowScore),
        };
      }
    }
  }

  if (!best) {
    throw new AppError(404, 'No Quran ayah candidates were available for matching.', 'NO_CANDIDATES');
  }

  return best;
};
