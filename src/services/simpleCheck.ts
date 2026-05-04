import type { QuranAyahEntry, WordComparisonResult } from '../types.js';
import { AppError } from '../utils/errors.js';
import { getAllAyahs, getAyahBySurahAndAyat, getAyahsBySurah } from './quranData.js';
import { quranMatcher } from './quranMatcher.js';

interface SimpleCheckOptions {
  surah_id?: number;
  ayat_id?: number;
}

interface MajorityAyahResult {
  ayah: QuranAyahEntry;
  comparison: WordComparisonResult;
  majority_score: number;
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

export const detectMajorityAyah = (
  transcriptWords: string[],
  options?: SimpleCheckOptions,
): MajorityAyahResult => {
  if (transcriptWords.length === 0) {
    throw new AppError(422, 'Transcript is empty after normalization.', 'EMPTY_TRANSCRIPT');
  }

  const candidates = getCandidates(options);
  let best: MajorityAyahResult | undefined;
  let bestAlignedCount = -1;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const comparison = quranMatcher.compareWords(transcriptWords, candidate.words);
    const alignedCount = comparison.matched_words.length + comparison.incorrect_words.length;
    const penalty = comparison.extra_words.length + comparison.missing_words.length;
    const majorityScore = alignedCount / Math.max(transcriptWords.length, 1);

    if (!best) {
      best = {
        ayah: candidate,
        comparison,
        majority_score: round(majorityScore),
      };
      bestAlignedCount = alignedCount;
      bestPenalty = penalty;
      continue;
    }

    if (
      alignedCount > bestAlignedCount ||
      (alignedCount === bestAlignedCount &&
        (penalty < bestPenalty ||
          (penalty === bestPenalty &&
            (comparison.score > best.comparison.score ||
              (comparison.score === best.comparison.score && candidate.id < best.ayah.id)))))
    ) {
      best = {
        ayah: candidate,
        comparison,
        majority_score: round(majorityScore),
      };
      bestAlignedCount = alignedCount;
      bestPenalty = penalty;
    }
  }

  if (!best) {
    throw new AppError(404, 'No Quran ayah candidates were available for matching.', 'NO_CANDIDATES');
  }

  return best;
};
