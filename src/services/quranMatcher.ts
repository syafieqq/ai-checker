import type { BestMatchResult, MatchOptions, QuranAyahEntry, WordComparisonResult } from '../types.js';
import { splitWords } from '../utils/arabic.js';
import { AppError } from '../utils/errors.js';
import { getAllAyahs, getAyahBySurahAndAyat, getAyahsBySurah } from './quranData.js';

const MATCH_THRESHOLD = 0.88;
const INCORRECT_THRESHOLD = 0.55;

type Operation = 'start' | 'match' | 'delete' | 'insert';

interface Cell {
  cost: number;
  operation: Operation;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const round = (value: number, digits = 4): number => {
  return Number(value.toFixed(digits));
};

export class QuranMatcher {
  similarity(a: string, b: string): number {
    if (a === b) {
      return 1;
    }

    if (a.length === 0 || b.length === 0) {
      return 0;
    }

    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

    for (let i = 0; i < rows; i += 1) {
      matrix[i]![0] = i;
    }

    for (let j = 0; j < cols; j += 1) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j - 1]! + substitutionCost,
        );
      }
    }

    const distance = matrix[a.length]![b.length]!;
    return clamp(1 - distance / Math.max(a.length, b.length), 0, 1);
  }

  compareWords(userWords: string[], targetWords: string[]): WordComparisonResult {
    const rows = targetWords.length + 1;
    const cols = userWords.length + 1;
    const dp = Array.from({ length: rows }, () =>
      Array<Cell>(cols).fill({ cost: Number.POSITIVE_INFINITY, operation: 'start' }),
    );

    dp[0]![0] = { cost: 0, operation: 'start' };

    for (let i = 1; i < rows; i += 1) {
      dp[i]![0] = { cost: i, operation: 'delete' };
    }

    for (let j = 1; j < cols; j += 1) {
      dp[0]![j] = { cost: j, operation: 'insert' };
    }

    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        const targetWord = targetWords[i - 1]!;
        const userWord = userWords[j - 1]!;
        const similarity = this.similarity(targetWord, userWord);

        const deleteCandidate = {
          cost: dp[i - 1]![j]!.cost + 1,
          operation: 'delete' as const,
        };
        const insertCandidate = {
          cost: dp[i]![j - 1]!.cost + 1,
          operation: 'insert' as const,
        };

        const substitutionCost =
          similarity >= MATCH_THRESHOLD
            ? 0
            : similarity >= INCORRECT_THRESHOLD
              ? 0.75 - similarity * 0.25
              : Number.POSITIVE_INFINITY;

        const matchCandidate = {
          cost: dp[i - 1]![j - 1]!.cost + substitutionCost,
          operation: 'match' as const,
        };

        const best = [deleteCandidate, insertCandidate, matchCandidate].reduce((current, candidate) => {
          if (candidate.cost < current.cost) {
            return candidate;
          }

          if (candidate.cost === current.cost) {
            if (candidate.operation === 'match') {
              return candidate;
            }

            if (candidate.operation === 'delete' && current.operation === 'insert') {
              return candidate;
            }
          }

          return current;
        });

        dp[i]![j] = best;
      }
    }

    const matched_words: WordComparisonResult['matched_words'] = [];
    const missing_words: WordComparisonResult['missing_words'] = [];
    const extra_words: WordComparisonResult['extra_words'] = [];
    const incorrect_words: WordComparisonResult['incorrect_words'] = [];

    let i = targetWords.length;
    let j = userWords.length;

    while (i > 0 || j > 0) {
      const cell = dp[i]![j]!;

      if (cell.operation === 'match' && i > 0 && j > 0) {
        const targetWord = targetWords[i - 1]!;
        const userWord = userWords[j - 1]!;
        const similarity = round(this.similarity(targetWord, userWord), 4);

        if (similarity >= MATCH_THRESHOLD) {
          matched_words.push({
            word: targetWord,
            target_index: i - 1,
            user_index: j - 1,
          });
        } else {
          incorrect_words.push({
            expected: targetWord,
            actual: userWord,
            target_index: i - 1,
            user_index: j - 1,
            similarity,
          });
        }

        i -= 1;
        j -= 1;
        continue;
      }

      if (cell.operation === 'delete' && i > 0) {
        missing_words.push({
          word: targetWords[i - 1]!,
          target_index: i - 1,
        });
        i -= 1;
        continue;
      }

      if (cell.operation === 'insert' && j > 0) {
        extra_words.push({
          word: userWords[j - 1]!,
          user_index: j - 1,
        });
        j -= 1;
        continue;
      }

      if (i > 0) {
        missing_words.push({
          word: targetWords[i - 1]!,
          target_index: i - 1,
        });
        i -= 1;
        continue;
      }

      if (j > 0) {
        extra_words.push({
          word: userWords[j - 1]!,
          user_index: j - 1,
        });
        j -= 1;
      }
    }

    matched_words.reverse();
    missing_words.reverse();
    extra_words.reverse();
    incorrect_words.reverse();

    const exactMatchCount = matched_words.reduce((count, match) => {
      return count + Number(targetWords[match.target_index] === userWords[match.user_index]);
    }, 0);

    const weightedMatches =
      matched_words.length +
      incorrect_words.reduce((sum, item) => sum + item.similarity, 0);
    const denominator = Math.max(targetWords.length, userWords.length, 1);
    const score = clamp(weightedMatches / denominator, 0, 1);

    return {
      accuracy: Math.round(score * 100),
      score: round(score),
      exact_match_count: exactMatchCount,
      missing_words,
      extra_words,
      incorrect_words,
      matched_words,
    };
  }

  findBestMatch(transcript: string, options?: MatchOptions): BestMatchResult {
    const userWords = splitWords(transcript);

    if (userWords.length === 0) {
      throw new AppError(422, 'Transcript is empty after normalization.', 'EMPTY_TRANSCRIPT');
    }

    const candidates = this.getCandidates(options);
    let best: BestMatchResult | undefined;
    let bestScore = -1;

    for (const candidate of candidates) {
      const comparison = this.compareWords(userWords, candidate.words);
      const denominator = Math.max(userWords.length, candidate.words.length, 1);
      const exactRatio = comparison.exact_match_count / denominator;
      const sequenceRatio = comparison.matched_words.length / denominator;
      const confidence = clamp(comparison.score * 0.7 + exactRatio * 0.2 + sequenceRatio * 0.1, 0, 1);

      if (!best || confidence > bestScore) {
        best = {
          ayah: candidate,
          confidence: round(confidence),
          comparison,
        };
        bestScore = confidence;
        continue;
      }

      if (
        confidence === bestScore &&
        (comparison.accuracy > best.comparison.accuracy ||
          (comparison.accuracy === best.comparison.accuracy && candidate.id < best.ayah.id))
      ) {
        best = {
          ayah: candidate,
          confidence: round(confidence),
          comparison,
        };
      }
    }

    if (!best) {
      throw new AppError(404, 'No Quran ayah candidates were available for matching.', 'NO_CANDIDATES');
    }

    return best;
  }

  private getCandidates(options?: MatchOptions): QuranAyahEntry[] {
    const surahId = options?.surah_id;
    const ayatId = options?.ayat_id;

    if (surahId !== undefined && ayatId !== undefined) {
      const ayah = getAyahBySurahAndAyat(surahId, ayatId);
      if (!ayah) {
        throw new AppError(404, 'Requested ayah was not found.', 'AYAH_NOT_FOUND');
      }

      return [ayah];
    }

    if (surahId !== undefined) {
      const ayahs = getAyahsBySurah(surahId);
      if (ayahs.length === 0) {
        throw new AppError(404, 'Requested surah was not found.', 'SURAH_NOT_FOUND');
      }

      return ayahs;
    }

    return getAllAyahs();
  }
}

export const quranMatcher = new QuranMatcher();
