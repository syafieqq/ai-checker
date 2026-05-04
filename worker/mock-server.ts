import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import type { TajwidWorkerRequest, TajwidWorkerResponse } from '../src/types.js';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    worker: 'mock-tajwid-worker',
    mode: 'audio_analysis',
  });
});

app.post('/analyze', async (c) => {
  const body = await c.req.parseBody();
  const payloadValue = body.payload;

  if (typeof payloadValue !== 'string') {
    return c.json(
      {
        status: 'unavailable',
        mode: 'audio_analysis',
        worker_version: 'mock-v1',
        mistakes: [],
        warnings: ['Missing JSON payload field.'],
        message: 'Mock worker expected a "payload" form field.',
      } satisfies TajwidWorkerResponse,
      400,
    );
  }

  const payload = JSON.parse(payloadValue) as TajwidWorkerRequest;
  const response: TajwidWorkerResponse = {
    status: 'analyzed',
    mode: 'audio_analysis',
    worker_version: 'mock-v1',
    overall_score: 100,
    alignment_confidence: 0.7,
    mistakes: [],
    warnings: [
      'This is a mock tajwid worker. No real audio analysis was performed.',
      `Received ${payload.rules.length} annotated rules for ayah ${payload.surah_id}:${payload.ayat_id}.`,
    ],
    message: 'Mock audio-analysis pipeline completed successfully.',
  };

  return c.json(response);
});

const port = Number.parseInt(process.env.TAJWID_WORKER_PORT ?? '4001', 10);

serve({
  fetch: app.fetch,
  port: Number.isNaN(port) ? 4001 : port,
});

console.log(`Mock tajwid worker listening on http://localhost:${Number.isNaN(port) ? 4001 : port}`);
