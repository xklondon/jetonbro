export class ProtocolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ProtocolError';
    this.code = code;
  }
}

export function fail(code: string, message: string): never {
  throw new ProtocolError(code, message);
}
