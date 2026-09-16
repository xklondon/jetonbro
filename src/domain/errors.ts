export class DomainError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super("FORBIDDEN", message, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super("NOT_FOUND", message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super("CONFLICT", message, 409);
    this.name = "ConflictError";
  }
}

export class PhaseConflictError extends DomainError {
  constructor(action: string, actual: string, expected: string) {
    super(
      "PHASE_CONFLICT",
      `${action} is only available during ${expected}. The table is currently in ${actual}.`,
      409,
    );
    this.name = "PhaseConflictError";
  }
}
