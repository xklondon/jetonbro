export class EscrowError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'EscrowError';
    this.code = code;
  }
}

export function fail(code: string, message: string): never {
  throw new EscrowError(code, message);
}
