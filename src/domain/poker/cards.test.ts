import { expect, test } from "vitest";
import { assertCommunityCards, cardLabel, communityCardLimit, parsePokerCard } from "./cards";

test("community card limits follow the physical street", () => {
  expect(communityCardLimit("PRE_FLOP")).toBe(0);
  expect(communityCardLimit("FLOP")).toBe(3);
  expect(communityCardLimit("TURN")).toBe(4);
  expect(communityCardLimit("RIVER")).toBe(5);
});

test("flop must be exactly three cards when any are entered", () => {
  const ace = parsePokerCard("A", "S");
  expect(() => assertCommunityCards("FLOP", [ace])).toThrow(/exactly 3/);
  expect(() => assertCommunityCards("FLOP", [ace, ace, ace])).not.toThrow();
});

test("card labels do not invent a winner", () => {
  expect(cardLabel(parsePokerCard("K", "H"))).toBe("K♥");
});
