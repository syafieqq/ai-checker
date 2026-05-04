import { describe, expect, it } from 'vitest';

import { normalizeArabic, splitWords } from '../src/utils/arabic.js';

describe('Arabic utilities', () => {
  it('normalizeArabic removes harakat', () => {
    expect(normalizeArabic('ٱلْحَمْدُ لِلَّهِ')).toBe('الحمد لله');
  });

  it('normalizeArabic converts إياك to اياك', () => {
    expect(normalizeArabic('إِيَّاكَ نَعْبُدُ')).toBe('اياك نعبد');
  });

  it('splitWords works', () => {
    expect(splitWords('  الْحَمْدُ   لِلَّهِ  رَبِّ الْعَالَمِينَ ')).toEqual([
      'الحمد',
      'لله',
      'رب',
      'العالمين',
    ]);
  });
});
