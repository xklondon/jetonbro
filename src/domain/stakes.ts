import { DomainError } from "./errors";

export const STAKE_CURRENCIES = ["USD", "GBP", "EUR"] as const;
export type StakeCurrency = (typeof STAKE_CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<StakeCurrency, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
};

export type StakeSpec =
  | { type: "FUN_ONLY" }
  | {
      type: "MONEY";
      currencyCode: StakeCurrency;
      /** Cents (or equivalent) per whole jeton when buy-in is absent (1:1 default = 100). */
      minorUnitsPerJeton: bigint;
      /** Whole-stack buy-in in minor units for custom rates; null ⇒ use minorUnitsPerJeton. */
      moneyBuyInMinorUnits: bigint | null;
      /** Session starting stack in millis; required when moneyBuyInMinorUnits is set. */
      startingJetonsMillis: bigint;
    }
  | { type: "CUSTOM"; customUnitLabel: string; jetonsPerCustomUnit: bigint };

export function stakeFromSession(session: {
  stakeType: "FUN_ONLY" | "MONEY" | "CUSTOM";
  currencyCode: string | null;
  minorUnitsPerJeton: bigint | null;
  moneyBuyInMinorUnits?: bigint | null;
  customUnitLabel: string | null;
  jetonsPerCustomUnit: bigint | null;
  startingJetonsMillis: bigint;
}): StakeSpec {
  if (session.stakeType === "FUN_ONLY") return { type: "FUN_ONLY" };
  if (session.stakeType === "CUSTOM") {
    return {
      type: "CUSTOM",
      customUnitLabel: session.customUnitLabel ?? "Unit",
      jetonsPerCustomUnit: session.jetonsPerCustomUnit ?? 1n,
    };
  }
  return {
    type: "MONEY",
    currencyCode: (session.currencyCode as StakeCurrency) ?? "USD",
    minorUnitsPerJeton: session.minorUnitsPerJeton ?? 100n,
    moneyBuyInMinorUnits: session.moneyBuyInMinorUnits ?? null,
    startingJetonsMillis: session.startingJetonsMillis,
  };
}

/** Parse a major-currency string like `10` or `10.00` into integer minor units. */
export function parseMoneyMajorToMinor(value: string): bigint {
  const trimmed = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) throw new DomainError("INVALID_STAKE", "Enter a valid money amount.");
  const major = BigInt(match[1]!);
  const frac = (match[2] ?? "").padEnd(2, "0");
  return major * 100n + BigInt(frac || "0");
}

export function formatMoneyMinor(
  minor: bigint,
  currency: StakeCurrency,
  opts?: { cents?: "always" | "auto" },
): string {
  const abs = minor < 0n ? -minor : minor;
  const major = abs / 100n;
  const rest = abs % 100n;
  const symbol = CURRENCY_SYMBOL[currency];
  if (rest === 0n && (opts?.cents ?? "auto") === "auto") return `${symbol}${major.toString()}`;
  return `${symbol}${major.toString()}.${rest.toString().padStart(2, "0")}`;
}

/**
 * Convert net jetons (millis) to money minor units using buy-in ratio when present.
 * Rounding: half-away-from-zero on the final minor-unit quotient only.
 */
export function netMillisToMoneyMinor(
  netMillis: bigint,
  startingJetonsMillis: bigint,
  moneyBuyInMinorUnits: bigint,
): bigint {
  if (startingJetonsMillis <= 0n) throw new DomainError("INVALID_STAKE", "Starting jetons must be greater than zero.");
  if (netMillis === 0n) return 0n;
  const sign = netMillis < 0n ? -1n : 1n;
  const absNet = netMillis < 0n ? -netMillis : netMillis;
  const product = absNet * moneyBuyInMinorUnits;
  const quot = product / startingJetonsMillis;
  const rem = product % startingJetonsMillis;
  const rounded = rem * 2n >= startingJetonsMillis ? quot + 1n : quot;
  return sign * rounded;
}

export function parseStakeSpec(input: {
  stakeType?: string;
  currencyCode?: string;
  moneyPerJeton?: string;
  moneyBuyIn?: string;
  startingJetonsPerPlayer?: string;
  customUnitLabel?: string;
  jetonsPerCustomUnit?: string;
}): StakeSpec {
  const raw = (input.stakeType ?? "FUN_ONLY").toUpperCase();
  if (raw === "FUN_ONLY" || raw === "FUN") return { type: "FUN_ONLY" };
  if (raw === "CUSTOM" || raw === "SOMETHING_ELSE" || raw === "OTHER") {
    const label = (input.customUnitLabel ?? "").trim();
    if (!label) throw new DomainError("INVALID_STAKE", "Enter what you are playing for.");
    const per = BigInt(Math.trunc(Number(input.jetonsPerCustomUnit ?? "0")));
    if (per <= 0n) throw new DomainError("INVALID_STAKE", "Jetons per unit must be greater than zero.");
    return { type: "CUSTOM", customUnitLabel: label.slice(0, 40), jetonsPerCustomUnit: per };
  }
  if (raw !== "MONEY") throw new DomainError("INVALID_STAKE", "Choose Fun only, Money or Something else.");

  const currency = (input.currencyCode ?? "USD").toUpperCase();
  if (!STAKE_CURRENCIES.includes(currency as StakeCurrency)) {
    throw new DomainError("INVALID_STAKE", "Choose USD, GBP or EUR.");
  }
  const startingLabel = (input.startingJetonsPerPlayer ?? "100").trim() || "100";
  const startingJetons = BigInt(Math.trunc(Number(startingLabel)));
  if (startingJetons <= 0n) throw new DomainError("INVALID_STAKE", "Starting jetons must be greater than zero.");
  const startingJetonsMillis = startingJetons * 1000n;

  if (input.moneyBuyIn != null && String(input.moneyBuyIn).trim() !== "") {
    const buyIn = parseMoneyMajorToMinor(String(input.moneyBuyIn));
    if (buyIn <= 0n) throw new DomainError("INVALID_STAKE", "Buy-in must be greater than zero.");
    // Exact cents-per-jeton when divisible; otherwise keep buy-in as source of truth.
    const perJeton = buyIn % startingJetons === 0n ? buyIn / startingJetons : 0n;
    return {
      type: "MONEY",
      currencyCode: currency as StakeCurrency,
      minorUnitsPerJeton: perJeton > 0n ? perJeton : 100n,
      moneyBuyInMinorUnits: buyIn,
      startingJetonsMillis,
    };
  }

  const major = BigInt(Math.trunc(Number(input.moneyPerJeton ?? "1")));
  if (major <= 0n) throw new DomainError("INVALID_STAKE", "One jeton must be worth more than zero.");
  return {
    type: "MONEY",
    currencyCode: currency as StakeCurrency,
    minorUnitsPerJeton: major * 100n,
    moneyBuyInMinorUnits: null,
    startingJetonsMillis,
  };
}

export function personalResultCopy(input: {
  netMillis: bigint;
  stake: StakeSpec;
}): string {
  const netJetons = input.netMillis / 1000n;
  if (input.stake.type === "FUN_ONLY") {
    if (netJetons === 0n) return "Finished even";
    const abs = netJetons < 0n ? -netJetons : netJetons;
    return netJetons < 0n ? `Lost ${abs.toString()} jetons` : `Won ${abs.toString()} jetons`;
  }
  if (netJetons === 0n) return "Settled evenly";
  if (input.stake.type === "MONEY") {
    let money: bigint;
    if (input.stake.moneyBuyInMinorUnits != null && input.stake.startingJetonsMillis > 0n) {
      money = netMillisToMoneyMinor(input.netMillis, input.stake.startingJetonsMillis, input.stake.moneyBuyInMinorUnits);
    } else {
      money = netJetons * input.stake.minorUnitsPerJeton;
    }
    const amount = formatMoneyMinor(money < 0n ? -money : money, input.stake.currencyCode, {
      cents: input.stake.moneyBuyInMinorUnits != null ? "always" : "auto",
    });
    return netJetons < 0n ? `You owe ${amount}` : `You are owed ${amount}`;
  }
  const units = netJetons / input.stake.jetonsPerCustomUnit;
  const remainder = netJetons % input.stake.jetonsPerCustomUnit;
  const label = input.stake.customUnitLabel;
  if (remainder !== 0n || units === 0n) {
    const abs = netJetons < 0n ? -netJetons : netJetons;
    return netJetons < 0n ? `You owe ${abs.toString()} jetons (${label})` : `You are owed ${abs.toString()} jetons (${label})`;
  }
  const count = units < 0n ? -units : units;
  const unitText = `${count.toString()} ${label}`;
  return units < 0n ? `You owe ${unitText}` : `You are owed ${unitText}`;
}

export function stakeExample(stake: StakeSpec): string {
  if (stake.type === "FUN_ONLY") return "Fun only";
  if (stake.type === "MONEY") {
    if (stake.moneyBuyInMinorUnits != null && stake.startingJetonsMillis > 0n) {
      const jetons = stake.startingJetonsMillis / 1000n;
      return `${jetons.toString()} jetons = ${formatMoneyMinor(stake.moneyBuyInMinorUnits, stake.currencyCode, { cents: "always" })}`;
    }
    return `1 jeton = ${formatMoneyMinor(stake.minorUnitsPerJeton, stake.currencyCode)}`;
  }
  return `${stake.jetonsPerCustomUnit.toString()} jetons = 1 ${stake.customUnitLabel}`;
}

export function stakeTypeLabel(type: StakeSpec["type"]): string {
  if (type === "FUN_ONLY") return "Fun only";
  if (type === "MONEY") return "Money";
  return "Something else";
}

export function stakePersistFields(stake: StakeSpec): {
  stakeType: "FUN_ONLY" | "MONEY" | "CUSTOM";
  currencyCode: string | null;
  minorUnitsPerJeton: bigint | null;
  moneyBuyInMinorUnits: bigint | null;
  customUnitLabel: string | null;
  jetonsPerCustomUnit: bigint | null;
} {
  if (stake.type === "FUN_ONLY") {
    return {
      stakeType: "FUN_ONLY",
      currencyCode: null,
      minorUnitsPerJeton: null,
      moneyBuyInMinorUnits: null,
      customUnitLabel: null,
      jetonsPerCustomUnit: null,
    };
  }
  if (stake.type === "MONEY") {
    return {
      stakeType: "MONEY",
      currencyCode: stake.currencyCode,
      minorUnitsPerJeton: stake.minorUnitsPerJeton,
      moneyBuyInMinorUnits: stake.moneyBuyInMinorUnits,
      customUnitLabel: null,
      jetonsPerCustomUnit: null,
    };
  }
  return {
    stakeType: "CUSTOM",
    currencyCode: null,
    minorUnitsPerJeton: null,
    moneyBuyInMinorUnits: null,
    customUnitLabel: stake.customUnitLabel,
    jetonsPerCustomUnit: stake.jetonsPerCustomUnit,
  };
}
