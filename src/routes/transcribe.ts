import { Hono } from 'hono';

import { transcribeAudioFile } from '../services/openaiTranscription.js';
import { getValidatedAudioFile } from '../utils/uploads.js';

const transcribe = new Hono();

transcribe.post('/transcribe', async (c) => {
  const body = await c.req.parseBody();
  const file = getValidatedAudioFile(body.file);
  const transcript = await transcribeAudioFile(file);

  return c.json({
    success: true,
    transcript,
  });
});

export default transcribe;
