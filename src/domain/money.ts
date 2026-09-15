import { DomainError } from "./errors";

/** 1 jeton = 1000 millijetons. Ledger math is integer-only. */
export const MILLIS_PER_JETON = 1000n;

export type JetonMillis = bigint;

export function assertNonNegative(amount: JetonMillis, label = "amount"): void {
  if (amount < 0n) {
    throw new DomainError("INVALID_AMOUNT", `${label} cannot be negative.`);
  }
}

export function parseJetonInput(raw: string): JetonMillis {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmed)) {
    throw new DomainError("INVALID_AMOUNT", "Enter a jeton amount using up to 3 decimal places.");
  }
  const [wholePart, fracPart = ""] = trimmed.split(".");
  const frac = (fracPart + "000").slice(0, 3);
  return BigInt(wholePart ?? "0") * MILLIS_PER_JETON + BigInt(frac);
}

export function parseWholeJetons(raw: string, label = "Starting jetons"): JetonMillis {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new DomainError("INVALID_AMOUNT", `${label} must be a whole number.`);
  }
  return BigInt(trimmed) * MILLIS_PER_JETON;
}

export function formatJetons(amount: JetonMillis): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const whole = abs / MILLIS_PER_JETON;
  const frac = abs % MILLIS_PER_JETON;
  const sign = negative ? "-" : "";
  if (frac === 0n) return `${sign}${whole.toString()}`;
  return `${sign}${whole.toString()}.${frac.toString().padStart(3, "0").replace(/0+$/, "")}`;
}

export function jeton(amount: number | string): JetonMillis {
  if (typeof amount === "string") return parseJetonInput(amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new DomainError("INVALID_AMOUNT", "Jeton amounts must be finite and non-negative.");
  }
  return parseJetonInput(String(amount));
}

export function minMillis(a: JetonMillis, b: JetonMillis): JetonMillis {
  return a <= b ? a : b;
}
