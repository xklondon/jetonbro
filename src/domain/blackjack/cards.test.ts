import { expect, test } from "vitest";
import { evaluateHand, suggestedBoxOutcome, suggestedInsuranceResolution } from "./cards";

test("multiple Aces calculate as 1 or 11", () => {
  expect(evaluateHand(["A", "A"]).total).toBe(12);
  expect(evaluateHand(["A", "A"]).soft).toBe(true);
  expect(evaluateHand(["A", "A"]).label).toBe("Soft 12");
  expect(evaluateHand(["A", "A", "9"]).total).toBe(21);
  expect(evaluateHand(["A", "A", "9"]).label).toBe("21");
  expect(evaluateHand(["A", "A", "A", "8"]).total).toBe(21);
});

test("soft and hard totals are labelled", () => {
  expect(evaluateHand(["A", "6"]).label).toBe("Soft 17");
  expect(evaluateHand(["K", "7"]).label).toBe("Hard 17");
  expect(evaluateHand(["10", "7"]).label).toBe("Hard 17");
  expect(evaluateHand(["A", "6", "10"]).label).toBe("Hard 17");
});

test("natural Blackjack is a non-split two-card 21", () => {
  expect(evaluateHand(["A", "K"]).naturalBlackjack).toBe(true);
  expect(evaluateHand(["A", "K"]).label).toBe("Blackjack");
  expect(evaluateHand(["A", "10"]).naturalBlackjack).toBe(true);
  expect(evaluateHand(["K", "Q", "A"]).naturalBlackjack).toBe(false);
  expect(evaluateHand(["K", "Q", "A"]).label).toBe("21");
});

test("split two-card 21 is not Blackjack", () => {
  const split = evaluateHand(["A", "K"], true);
  expect(split.naturalBlackjack).toBe(false);
  expect(split.label).toBe("21");
  expect(suggestedBoxOutcome(["A", "K"], ["K", "9"], true)).toBe("WON");
});

test("player bust loses even if dealer later busts", () => {
  expect(evaluateHand(["K", "Q", "5"]).bust).toBe(true);
  expect(evaluateHand(["K", "Q", "5"]).label).toBe("Bust");
  expect(suggestedBoxOutcome(["K", "Q", "5"], ["K", "Q", "6"])).toBe("LOST");
});

test("dealer bust wins when the Player did not bust", () => {
  expect(suggestedBoxOutcome(["K", "9"], ["K", "Q", "5"])).toBe("WON");
});

test("equal totals push", () => {
  expect(suggestedBoxOutcome(["K", "7"], ["10", "7"])).toBe("PUSH");
  expect(suggestedBoxOutcome(["A", "K"], ["A", "Q"])).toBe("PUSH");
});

test("natural Blackjack beats a non-Blackjack 21", () => {
  expect(suggestedBoxOutcome(["A", "K"], ["K", "6", "5"])).toBe("BLACKJACK");
  expect(suggestedBoxOutcome(["K", "6", "5"], ["A", "Q"])).toBe("LOST");
});

test("Dealer first two cards settle Insurance independently of the box", () => {
  expect(suggestedInsuranceResolution(["A", "K", "5"])).toBe("DEALER_BLACKJACK");
  expect(suggestedInsuranceResolution(["A", "9"])).toBe("NO_DEALER_BLACKJACK");
  expect(suggestedInsuranceResolution(["A"])).toBeNull();
  expect(suggestedBoxOutcome(["K", "9"], ["A", "K"])).toBe("LOST");
});

test("incomplete hands do not suggest an outcome", () => {
  expect(suggestedBoxOutcome([], ["K", "7"])).toBeNull();
  expect(suggestedBoxOutcome(["K", "7"], [])).toBeNull();
});
