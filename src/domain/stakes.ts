import { DomainError } from "./errors";

export const STAKE_CURRENCIES = ["GBP", "EUR", "USD"] as const;
export type StakeCurrency = (typeof STAKE_CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<StakeCurrency, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
};

export type StakeSpec =
  | { type: "MONEY"; currencyCode: StakeCurrency; minorUnitsPerJeton: bigint }
  | { type: "CUSTOM"; customUnitLabel: string; jetonsPerCustomUnit: bigint };

export function stakeFromSession(session: {
  stakeType: "MONEY" | "CUSTOM";
  currencyCode: string | null;
  minorUnitsPerJeton: bigint | null;
  customUnitLabel: string | null;
  jetonsPerCustomUnit: bigint | null;
}): StakeSpec {
  if (session.stakeType === "CUSTOM") {
    return {
      type: "CUSTOM",
      customUnitLabel: session.customUnitLabel ?? "Unit",
      jetonsPerCustomUnit: session.jetonsPerCustomUnit ?? 1n,
    };
  }
  return {
    type: "MONEY",
    currencyCode: (session.currencyCode as StakeCurrency) ?? "GBP",
    minorUnitsPerJeton: session.minorUnitsPerJeton ?? 100n,
  };
}

export function parseStakeSpec(input: {
  stakeType?: string;
  currencyCode?: string;
  moneyPerJeton?: string;
  customUnitLabel?: string;
  jetonsPerCustomUnit?: string;
}): StakeSpec {
  const type = input.stakeType === "CUSTOM" ? "CUSTOM" : "MONEY";
  if (type === "MONEY") {
    const currency = (input.currencyCode ?? "GBP").toUpperCase();
    if (!STAKE_CURRENCIES.includes(currency as StakeCurrency)) {
      throw new DomainError("INVALID_STAKE", "Choose GBP, EUR or USD.");
    }
    const major = BigInt(Math.trunc(Number(input.moneyPerJeton ?? "1")));
    if (major <= 0n) throw new DomainError("INVALID_STAKE", "One jeton must be worth more than zero.");
    return { type: "MONEY", currencyCode: currency as StakeCurrency, minorUnitsPerJeton: major * 100n };
  }
  const label = (input.customUnitLabel ?? "").trim();
  if (!label) throw new DomainError("INVALID_STAKE", "Enter what you are playing for.");
  const per = BigInt(Math.trunc(Number(input.jetonsPerCustomUnit ?? "0")));
  if (per <= 0n) throw new DomainError("INVALID_STAKE", "Jetons per unit must be greater than zero.");
  return { type: "CUSTOM", customUnitLabel: label.slice(0, 40), jetonsPerCustomUnit: per };
}

export function formatMoneyMinor(minor: bigint, currency: StakeCurrency): string {
  const abs = minor < 0n ? -minor : minor;
  const major = abs / 100n;
  const rest = abs % 100n;
  const symbol = CURRENCY_SYMBOL[currency];
  if (rest === 0n) return `${symbol}${major.toString()}`;
  return `${symbol}${major.toString()}.${rest.toString().padStart(2, "0")}`;
}

export function personalResultCopy(input: {
  netMillis: bigint;
  stake: StakeSpec;
}): string {
  const netJetons = input.netMillis / 1000n;
  if (netJetons === 0n) return "Settled evenly";
  if (input.stake.type === "MONEY") {
    const money = netJetons * input.stake.minorUnitsPerJeton;
    const amount = formatMoneyMinor(money < 0n ? -money : money, input.stake.currencyCode);
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
  if (stake.type === "MONEY") {
    return `1 jeton = ${formatMoneyMinor(stake.minorUnitsPerJeton, stake.currencyCode)}`;
  }
  return `${stake.jetonsPerCustomUnit.toString()} jetons = 1 ${stake.customUnitLabel}`;
}
