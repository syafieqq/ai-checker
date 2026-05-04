import { afterEach, describe, expect, it } from 'vitest';

import app from '../src/index.js';
import { getAyahBySurahAndAyat } from '../src/services/quranData.js';
import { analyzeTajwidForAyah } from '../src/services/tajwidOrchestrator.js';
import type { TajwidCapabilities } from '../src/types.js';

const originalEnabled = process.env.TAJWID_ENABLED;
const originalWorkerUrl = process.env.TAJWID_WORKER_URL;
const originalTimeout = process.env.TAJWID_WORKER_TIMEOUT_MS;

afterEach(() => {
  process.env.TAJWID_ENABLED = originalEnabled;
  process.env.TAJWID_WORKER_URL = originalWorkerUrl;
  process.env.TAJWID_WORKER_TIMEOUT_MS = originalTimeout;
});

describe('tajwid orchestrator', () => {
  it('returns transcript-only capabilities when worker is disabled', async () => {
    delete process.env.TAJWID_ENABLED;
    delete process.env.TAJWID_WORKER_URL;

    const response = await app.request('/api/tajwid/capabilities');
    const payload = (await response.json()) as TajwidCapabilities;

    expect(response.status).toBe(200);
    expect(payload.enabled).toBe(false);
    expect(payload.mode).toBe('transcript_only');
    expect(payload.supported_rules).toContain('madd');
  });

  it('falls back safely when audio tajwid analysis is disabled', async () => {
    delete process.env.TAJWID_ENABLED;
    delete process.env.TAJWID_WORKER_URL;

    const targetAyah = getAyahBySurahAndAyat(1, 2);
    if (!targetAyah) {
      throw new Error('Missing expected test ayah.');
    }

    const analysis = await analyzeTajwidForAyah({
      file: new File([new Uint8Array([1, 2, 3])], 'sample.wav', { type: 'audio/wav' }),
      targetAyah,
      transcript: {
        raw: 'الحمد لله رب العالمين',
        normalized: 'الحمد لله رب العالمين',
        words: ['الحمد', 'لله', 'رب', 'العالمين'],
      },
    });

    expect(analysis.status).toBe('disabled');
    expect(analysis.mode).toBe('transcript_only');
    expect(analysis.annotations.total_rules).toBeGreaterThan(0);
  });
});
