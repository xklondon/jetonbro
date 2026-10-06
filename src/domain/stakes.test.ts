import { expect, test } from "vitest";
import { personalResultCopy, parseStakeSpec } from "./stakes";

test("money conversion uses integer minor units", () => {
  const stake = parseStakeSpec({ stakeType: "MONEY", currencyCode: "GBP", moneyPerJeton: "1" });
  expect(personalResultCopy({ netMillis: -50000n, stake })).toBe("You owe £50");
  expect(personalResultCopy({ netMillis: 20000n, stake })).toBe("You are owed £20");
  expect(personalResultCopy({ netMillis: 0n, stake })).toBe("Settled evenly");
});

test("custom conversion uses integer jetons per unit", () => {
  const stake = parseStakeSpec({ stakeType: "CUSTOM", customUnitLabel: "Dinner", jetonsPerCustomUnit: "50" });
  expect(personalResultCopy({ netMillis: -50000n, stake })).toBe("You owe 1 Dinner");
  expect(personalResultCopy({ netMillis: 50000n, stake })).toBe("You are owed 1 Dinner");
});
