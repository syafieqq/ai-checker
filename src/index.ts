import { Hono } from 'hono';
import { cors } from 'hono/cors';

import checkRoute from './routes/check.js';
import healthRoute from './routes/health.js';
import surahsRoute from './routes/surahs.js';
import tajwidRoute from './routes/tajwid.js';
import transcribeRoute from './routes/transcribe.js';
import { handleAppError } from './utils/errors.js';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.get('/', (c) => {
  return c.json({
    name: 'Quran Smart Checker API',
    status: 'ok',
  });
});

app.route('/', healthRoute);
app.route('/api', transcribeRoute);
app.route('/api', checkRoute);
app.route('/api', surahsRoute);
app.route('/api', tajwidRoute);

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
      },
    },
    404,
  );
});

app.onError((error, c) => handleAppError(error, c));

export default app;
