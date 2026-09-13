export class PersonalLedgerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PersonalLedgerError';
    this.code = code;
  }
}

export function fail(code: string, message: string): never {
  throw new PersonalLedgerError(code, message);
}
