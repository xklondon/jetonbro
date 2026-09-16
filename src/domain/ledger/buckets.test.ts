import { expect, test } from "vitest";
import { emptyBuckets, moveBetweenBuckets } from "./buckets";
import { jeton } from "../money";

test("betting moves AVAILABLE into LOCKED_BET", () => {
  const started = { ...emptyBuckets(), AVAILABLE: jeton(100) };
  const afterBet = moveBetweenBuckets(started, {
    from: "AVAILABLE",
    to: "LOCKED_BET",
    amount: jeton(25),
  });
  expect(afterBet.AVAILABLE).toBe(jeton(75));
  expect(afterBet.LOCKED_BET).toBe(jeton(25));
  expect(afterBet.LOCKED_INSURANCE).toBe(0n);
});

test("retracting during betting reverses AVAILABLE and LOCKED_BET", () => {
  const started = { ...emptyBuckets(), AVAILABLE: jeton(75), LOCKED_BET: jeton(25) };
  const afterRetract = moveBetweenBuckets(started, {
    from: "LOCKED_BET",
    to: "AVAILABLE",
    amount: jeton(25),
  });
  expect(afterRetract.AVAILABLE).toBe(jeton(100));
  expect(afterRetract.LOCKED_BET).toBe(0n);
});

test("insurance moves AVAILABLE into LOCKED_INSURANCE, not LOCKED_BET", () => {
  const started = { ...emptyBuckets(), AVAILABLE: jeton(75), LOCKED_BET: jeton(25) };
  const afterInsurance = moveBetweenBuckets(started, {
    from: "AVAILABLE",
    to: "LOCKED_INSURANCE",
    amount: jeton(10),
  });
  expect(afterInsurance.AVAILABLE).toBe(jeton(65));
  expect(afterInsurance.LOCKED_BET).toBe(jeton(25));
  expect(afterInsurance.LOCKED_INSURANCE).toBe(jeton(10));
});

test("poker wagers move AVAILABLE into LOCKED_POKER", () => {
  const started = { ...emptyBuckets(), AVAILABLE: jeton(100) };
  const afterBlind = moveBetweenBuckets(started, {
    from: "AVAILABLE",
    to: "LOCKED_POKER",
    amount: jeton(10),
  });
  expect(afterBlind.AVAILABLE).toBe(jeton(90));
  expect(afterBlind.LOCKED_POKER).toBe(jeton(10));
  expect(afterBlind.LOCKED_BET).toBe(0n);
});
