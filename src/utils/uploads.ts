import { AppError } from './errors.js';

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
export const ALLOWED_AUDIO_TYPES = new Set([
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
]);

const getSingleValue = (value: unknown, fieldName: string): unknown => {
  if (!Array.isArray(value)) {
    return value;
  }

  if (value.length !== 1) {
    throw new AppError(400, `Only one "${fieldName}" value is allowed.`, 'INVALID_MULTIPART_FIELD');
  }

  return value[0];
};

export const getValidatedAudioFile = (value: unknown): File => {
  const singleValue = getSingleValue(value, 'file');

  if (!(singleValue instanceof File)) {
    throw new AppError(400, 'Audio file is required.', 'FILE_REQUIRED');
  }

  if (!ALLOWED_AUDIO_TYPES.has(singleValue.type)) {
    throw new AppError(400, 'Unsupported audio format.', 'UNSUPPORTED_AUDIO_TYPE');
  }

  if (singleValue.size <= 0) {
    throw new AppError(400, 'Uploaded audio file is empty.', 'EMPTY_FILE');
  }

  if (singleValue.size > MAX_AUDIO_BYTES) {
    throw new AppError(400, 'Audio file exceeds the 15MB limit.', 'FILE_TOO_LARGE');
  }

  return singleValue;
};

export const parseOptionalIntegerField = (
  value: unknown,
  fieldName: string,
): number | undefined => {
  const singleValue = getSingleValue(value, fieldName);

  if (singleValue === undefined) {
    return undefined;
  }

  if (singleValue instanceof File) {
    throw new AppError(400, `"${fieldName}" must be a number.`, 'INVALID_FIELD');
  }

  const trimmed = String(singleValue).trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(400, `"${fieldName}" must be a positive integer.`, 'INVALID_FIELD');
  }

  return parsed;
};
