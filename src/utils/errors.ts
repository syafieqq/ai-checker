import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class AppError extends Error {
  readonly statusCode: ContentfulStatusCode;
  readonly code: string;
  readonly expose: boolean;

  constructor(
    statusCode: ContentfulStatusCode,
    message: string,
    code = 'APP_ERROR',
    options?: { expose?: boolean },
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.expose = options?.expose ?? true;
  }
}

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export const errorResponse = (
  error: unknown,
): { statusCode: ContentfulStatusCode; body: ErrorBody } => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.expose ? error.message : 'An unexpected error occurred.',
        },
      },
    };
  }

  console.error('[unexpected-error]', error);

  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    },
  };
};

export const handleAppError = (error: unknown, c: Context) => {
  const { statusCode, body } = errorResponse(error);
  return c.json(body, statusCode);
};
