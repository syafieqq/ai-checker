import { Hono } from 'hono';

import { getTotalAyahs, quranLoaded } from '../services/quranData.js';

const health = new Hono();

health.get('/health', (c) => {
  return c.json({
    status: 'ok',
    quranLoaded,
    totalAyahs: getTotalAyahs(),
  });
});

export default health;
