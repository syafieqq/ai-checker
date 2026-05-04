import { serve } from '@hono/node-server';

import app from './index.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);

serve({
  fetch: app.fetch,
  port: Number.isNaN(port) ? 3000 : port,
});

console.log(`Quran Smart Checker API listening on http://localhost:${Number.isNaN(port) ? 3000 : port}`);
