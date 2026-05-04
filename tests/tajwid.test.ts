import { describe, expect, it } from 'vitest';

import { getAyahBySurahAndAyat } from '../src/services/quranData.js';
import { buildDisabledTajwidAnalysis } from '../src/services/tajwidFallback.js';
import { getTajwidAnnotationsByAyahId } from '../src/services/tajwidAnnotations.js';

describe('tajwid analysis response', () => {
  it('returns annotated transcript-only fallback data', () => {
    const ayah = getAyahBySurahAndAyat(1, 2);
    if (!ayah) {
      throw new Error('Missing expected test ayah.');
    }

    expect(
      buildDisabledTajwidAnalysis({
        annotations: getTajwidAnnotationsByAyahId(ayah.id),
      }),
    ).toEqual({
      supported: false,
      mode: 'transcript_only',
      status: 'disabled',
      mistakes: [],
      message: 'Audio tajwid analysis is disabled. Returning annotated rules present in the target ayah only.',
      reason:
        'This backend can identify tajwid rule locations from the Quran text, but real tajwid mistake detection requires an external audio analysis worker.',
      next_step:
        'Set TAJWID_ENABLED=true and configure TAJWID_WORKER_URL to enable audio-based tajwid analysis.',
      annotations: {
        total_rules: expect.any(Number),
        rules_present: expect.any(Array),
      },
      worker: {
        attempted: false,
        enabled: false,
        configured: false,
        warnings: [],
      },
    });
  });
});
