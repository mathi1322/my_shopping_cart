import { ZodError } from 'zod';
import { DomainError } from '../../domain/shared/DomainError';

interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function statusForCode(code: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    default:
      return 500;
  }
}

function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Maps a thrown error to a JSON HTTP response — the single place API routes translate domain/validation failures into status codes. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return jsonError(400, 'VALIDATION_ERROR', 'Invalid request payload', error.issues);
  }
  if (error instanceof SyntaxError) {
    return jsonError(400, 'VALIDATION_ERROR', 'Malformed JSON body');
  }
  if (error instanceof DomainError) {
    return jsonError(statusForCode(error.code), error.code, error.message);
  }

  console.error('Unhandled error in API route:', error);
  return jsonError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}
