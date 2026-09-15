import { DomainError } from "../errors";

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Empty rows are ignored. Duplicate filled rows are rejected. */
export function collectInviteEmails(rows: string[]): string[] {
  const filled = rows.map(normalizeEmail).filter(Boolean);
  const unique = [...new Set(filled)];
  if (unique.length !== filled.length) {
    throw new DomainError("DUPLICATE_EMAIL", "Each player email can only be invited once.");
  }
  for (const email of unique) {
    if (!isValidEmail(email)) {
      throw new DomainError("INVALID_EMAIL", "Enter valid email addresses.");
    }
  }
  return unique;
}
