import { OpenAI, toFile } from 'openai';

import { AppError } from '../utils/errors.js';

const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_TRANSCRIPTION_LANGUAGE = 'ar';
const DEFAULT_TRANSCRIPTION_PROMPT =
  'Transcribe Quran recitation in Arabic script only. Do not transliterate to Latin letters.';

let client: OpenAI | undefined;

const getClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new AppError(
      503,
      'Transcription service is not configured.',
      'TRANSCRIPTION_NOT_CONFIGURED',
    );
  }

  client ??= new OpenAI({ apiKey });
  return client;
};

export const getTranscriptionModel = (): string => {
  return process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_TRANSCRIPTION_MODEL;
};

export const getTranscriptionLanguage = (): string => {
  return process.env.OPENAI_TRANSCRIPTION_LANGUAGE?.trim() || DEFAULT_TRANSCRIPTION_LANGUAGE;
};

export const getTranscriptionPrompt = (): string => {
  return process.env.OPENAI_TRANSCRIPTION_PROMPT?.trim() || DEFAULT_TRANSCRIPTION_PROMPT;
};

export const transcribeAudioFile = async (file: File): Promise<string> => {
  try {
    const upload = await toFile(
      Buffer.from(await file.arrayBuffer()),
      file.name || 'recitation.audio',
      { type: file.type },
    );

    const transcription = await getClient().audio.transcriptions.create({
      file: upload,
      model: getTranscriptionModel(),
      language: getTranscriptionLanguage(),
      prompt: getTranscriptionPrompt(),
    });

    return transcription.text.trim();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error('[transcription-error]', error);
    throw new AppError(502, 'Unable to transcribe audio right now.', 'TRANSCRIPTION_FAILED');
  }
};
