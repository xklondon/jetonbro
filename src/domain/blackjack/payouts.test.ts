import { expect, test } from "vitest";
import { FORWARD_TRANSITIONS } from "./phases";
import { assertTransition, nextPhase } from "./transitions";
import {
  blackjackWinningsMillis,
  insuranceMaxMillis,
  insuranceProfitMillis,
  insuranceReturnMillis,
  ordinaryProfitMillis,
  ordinaryReturnMillis,
  suggestedPayout,
  suggestedPayouts,
} from "./payouts";
import { jeton } from "../money";

test("Blackjack phases only move forward", () => {
  expect(nextPhase("TABLE_SETUP")).toBe("BETTING");
  expect(nextPhase("BETTING")).toBe("PLAYING");
  expect(nextPhase("PLAYING")).toBe("PAYOUT");
  expect(nextPhase("PAYOUT")).toBe("ROUND_COMPLETE");
  expect(nextPhase("ROUND_COMPLETE")).toBe("BETTING");
  expect(() => assertTransition("PLAYING", "BETTING")).toThrow(/Cannot move/);
  expect(FORWARD_TRANSITIONS.BETTING).toBe("PLAYING");
});

test("normal win: profit 1× stake, total return 2× stake", () => {
  const stake = jeton(25);
  expect(ordinaryProfitMillis(stake, "WON", "THREE_TWO")).toBe(jeton(25));
  expect(ordinaryReturnMillis(stake, "WON", "THREE_TWO")).toBe(jeton(50));
});

test("push: profit 0, total return 1× stake", () => {
  const stake = jeton(25);
  expect(ordinaryProfitMillis(stake, "PUSH", "THREE_TWO")).toBe(0n);
  expect(ordinaryReturnMillis(stake, "PUSH", "THREE_TWO")).toBe(jeton(25));
});

test("loss: total return 0", () => {
  const stake = jeton(25);
  expect(ordinaryReturnMillis(stake, "LOST", "THREE_TWO")).toBe(0n);
  expect(ordinaryProfitMillis(stake, "LOST", "THREE_TWO")).toBe(0n);
});

test("Blackjack 3:2: profit 1.5× stake, total return 2.5× stake, 25 returns 62.5", () => {
  const stake = jeton(25);
  expect(blackjackWinningsMillis(stake, "THREE_TWO")).toBe(jeton("37.5"));
  expect(ordinaryProfitMillis(stake, "BLACKJACK", "THREE_TWO")).toBe(jeton("37.5"));
  expect(ordinaryReturnMillis(stake, "BLACKJACK", "THREE_TWO")).toBe(jeton("62.5"));
  expect(ordinaryReturnMillis(stake, "BLACKJACK", "THREE_TWO")).toBe(62500n);
});

test("suggestedPayout labels come from ordinaryReturnMillis", () => {
  const stake = jeton(25);
  expect(suggestedPayout(stake, "WON", "THREE_TWO").buttonLabel).toContain("50");
  expect(suggestedPayout(stake, "WON", "THREE_TWO").railTitle).toBe("WON");
  expect(suggestedPayout(stake, "WON", "THREE_TWO").swipeLabel).toBe("WIN +50");
  expect(suggestedPayout(stake, "PUSH", "THREE_TWO").railTitle).toBe("STAND OFF");
  expect(suggestedPayout(stake, "PUSH", "THREE_TWO").returnMillis).toBe(jeton(25));
  expect(suggestedPayout(stake, "LOST", "THREE_TWO").swipeLabel).toBe("LOSS · 0");
  expect(suggestedPayout(stake, "BLACKJACK", "THREE_TWO").returnMillis).toBe(jeton("62.5"));
  expect(suggestedPayouts(stake, "THREE_TWO").map((item) => item.outcome)).toEqual([
    "LOST",
    "PUSH",
    "BLACKJACK",
    "WON",
  ]);
});

test("Blackjack 6:5: profit 1.2× stake, total return 2.2× stake", () => {
  const stake = jeton(25);
  expect(ordinaryProfitMillis(stake, "BLACKJACK", "SIX_FIVE")).toBe(jeton(30));
  expect(ordinaryReturnMillis(stake, "BLACKJACK", "SIX_FIVE")).toBe(jeton(55));
});

test("Insurance 2:1: profit 2× Insurance stake, total return 3× Insurance stake", () => {
  const insurance = jeton(10);
  expect(insuranceProfitMillis(insurance, "DEALER_BLACKJACK")).toBe(jeton(20));
  expect(insuranceReturnMillis(insurance, "DEALER_BLACKJACK")).toBe(jeton(30));
  expect(insuranceProfitMillis(insurance, "NO_DEALER_BLACKJACK")).toBe(0n);
  expect(insuranceReturnMillis(insurance, "NO_DEALER_BLACKJACK")).toBe(0n);
  expect(insuranceMaxMillis(jeton(25))).toBe(jeton("12.5"));
});
