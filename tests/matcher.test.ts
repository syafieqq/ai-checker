import { describe, expect, it } from 'vitest';

import app from '../src/index.js';
import { QuranMatcher } from '../src/services/quranMatcher.js';
import { splitWords } from '../src/utils/arabic.js';

const matcher = new QuranMatcher();

describe('QuranMatcher', () => {
  it('compareWords detects missing word', () => {
    const result = matcher.compareWords(
      splitWords('الحمد لله العالمين'),
      splitWords('الحمد لله رب العالمين'),
    );

    expect(result.missing_words).toContainEqual({
      word: 'رب',
      target_index: 2,
    });
  });

  it('compareWords detects extra word', () => {
    const result = matcher.compareWords(
      splitWords('الحمد لله يا رب العالمين'),
      splitWords('الحمد لله رب العالمين'),
    );

    expect(result.extra_words).toContainEqual({
      word: 'يا',
      user_index: 2,
    });
  });

  it('compareWords detects incorrect word', () => {
    const result = matcher.compareWords(
      splitWords('الحمد لله رب العلمين'),
      splitWords('الحمد لله رب العالمين'),
    );

    expect(result.incorrect_words).toHaveLength(1);
    expect(result.incorrect_words[0]?.expected).toBe('العالمين');
    expect(result.incorrect_words[0]?.actual).toBe('العلمين');
  });

  it('findBestMatch detects Al-Fatihah ayah 2', () => {
    const result = matcher.findBestMatch('الحمد لله رب العالمين');

    expect(result.ayah.surah_id).toBe(1);
    expect(result.ayah.ayat_id).toBe(2);
  });

  it('health endpoint returns quranLoaded true', async () => {
    const response = await app.request('/health');
    const payload = (await response.json()) as {
      status: string;
      quranLoaded: boolean;
      totalAyahs: number;
    };

    expect(response.status).toBe(200);
    expect(payload.quranLoaded).toBe(true);
    expect(payload.totalAyahs).toBeGreaterThan(0);
  });
});
