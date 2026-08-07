export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}

/** Not authenticated at all, or credentials were wrong. */
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}

/** Authenticated, but not allowed to perform this action (wrong role / not the owner). */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}
