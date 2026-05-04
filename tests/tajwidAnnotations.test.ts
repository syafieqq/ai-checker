import { describe, expect, it } from 'vitest';

import {
  getTajwidAnnotationsBySurahAyat,
  getTajwidDatasetStats,
  summarizeTajwidAnnotations,
} from '../src/services/tajwidAnnotations.js';

describe('tajwid annotations', () => {
  it('loads tajwid annotation dataset', () => {
    const stats = getTajwidDatasetStats();

    expect(stats.totalAyahs).toBeGreaterThan(0);
    expect(stats.totalRules).toBeGreaterThan(0);
  });

  it('returns rule summaries for Al-Fatihah ayah 2', () => {
    const annotations = getTajwidAnnotationsBySurahAyat(1, 2);
    const summary = summarizeTajwidAnnotations(annotations);

    expect(annotations?.id).toBe(2);
    expect(summary.total_rules).toBeGreaterThan(0);
    expect(summary.rules_present.some((rule) => rule.rule === 'waqf')).toBe(true);
  });
});
