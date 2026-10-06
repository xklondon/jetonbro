import { expect, test } from "vitest";
import {
  netMillisToMoneyMinor,
  parseStakeSpec,
  personalResultCopy,
  stakeExample,
  stakePersistFields,
} from "./stakes";

test("new sessions default parse to FUN_ONLY", () => {
  expect(parseStakeSpec({}).type).toBe("FUN_ONLY");
  expect(parseStakeSpec({ stakeType: "FUN_ONLY" }).type).toBe("FUN_ONLY");
});

test("fun only ledger never uses owe/owed", () => {
  const stake = parseStakeSpec({ stakeType: "FUN_ONLY" });
  expect(personalResultCopy({ netMillis: -50000n, stake })).toBe("Lost 50 jetons");
  expect(personalResultCopy({ netMillis: 50000n, stake })).toBe("Won 50 jetons");
  expect(personalResultCopy({ netMillis: 0n, stake })).toBe("Finished even");
  expect(personalResultCopy({ netMillis: -50000n, stake })).not.toMatch(/owe/i);
});

test("default money is USD 1:1", () => {
  const stake = parseStakeSpec({ stakeType: "MONEY" });
  expect(stake).toMatchObject({ type: "MONEY", currencyCode: "USD", minorUnitsPerJeton: 100n, moneyBuyInMinorUnits: null });
  expect(personalResultCopy({ netMillis: -50000n, stake })).toBe("You owe $50");
  expect(stakeExample(stake)).toBe("1 jeton = $1");
});

test("custom buy-in 100 jetons = $10 converts net −50 to −$5", () => {
  const stake = parseStakeSpec({
    stakeType: "MONEY",
    currencyCode: "USD",
    moneyBuyIn: "10.00",
    startingJetonsPerPlayer: "100",
  });
  expect(stake.type).toBe("MONEY");
  if (stake.type !== "MONEY") return;
  expect(stake.moneyBuyInMinorUnits).toBe(1000n);
  expect(netMillisToMoneyMinor(-50000n, 100000n, 1000n)).toBe(-500n);
  expect(personalResultCopy({ netMillis: -50000n, stake })).toBe("You owe $5.00");
  expect(personalResultCopy({ netMillis: 50000n, stake })).toBe("You are owed $5.00");
  expect(stakeExample(stake)).toBe("100 jetons = $10.00");
});

test("legacy money GBP still converts with minorUnitsPerJeton", () => {
  const stake = parseStakeSpec({ stakeType: "MONEY", currencyCode: "GBP", moneyPerJeton: "1" });
  expect(personalResultCopy({ netMillis: -50000n, stake })).toBe("You owe £50");
  expect(personalResultCopy({ netMillis: 20000n, stake })).toBe("You are owed £20");
  expect(personalResultCopy({ netMillis: 0n, stake })).toBe("Settled evenly");
});

test("custom dinner conversion unchanged", () => {
  const stake = parseStakeSpec({ stakeType: "CUSTOM", customUnitLabel: "Dinner", jetonsPerCustomUnit: "50" });
  expect(personalResultCopy({ netMillis: -50000n, stake })).toBe("You owe 1 Dinner");
  expect(personalResultCopy({ netMillis: 50000n, stake })).toBe("You are owed 1 Dinner");
  expect(personalResultCopy({ netMillis: -25000n, stake })).toBe("You owe 25 jetons (Dinner)");
});

test("no floating-point drift on buy-in ratio", () => {
  expect(netMillisToMoneyMinor(-333000n, 1000000n, 1000n)).toBe(-333n);
  expect(netMillisToMoneyMinor(1n, 3n, 100n)).toBe(33n); // 100/3 → 33.333… rounds half-away to 33
});

test("persist fields clear money columns for fun only", () => {
  expect(stakePersistFields({ type: "FUN_ONLY" })).toEqual({
    stakeType: "FUN_ONLY",
    currencyCode: null,
    minorUnitsPerJeton: null,
    moneyBuyInMinorUnits: null,
    customUnitLabel: null,
    jetonsPerCustomUnit: null,
  });
});
