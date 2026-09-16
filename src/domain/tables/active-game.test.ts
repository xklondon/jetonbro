import { expect, test } from "vitest";
import { formatPokerPhaseLabel, pokerHandIsOpen, projectActiveGame } from "./active-game";

test("Poker tables project Hold’em phase, never a stale Blackjack round phase", () => {
  expect(
    projectActiveGame({
      game: "POKER",
      blackjackPhase: "BETTING",
      pokerPhase: "PRE_FLOP",
    }),
  ).toEqual({
    game: "POKER",
    gameLabel: "Texas Hold’em",
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "Texas Hold’em · PRE-FLOP",
  });
  expect(
    projectActiveGame({
      game: "POKER",
      blackjackPhase: "TABLE_SETUP",
      pokerPhase: "SHOWDOWN",
    }).headline,
  ).toBe("Texas Hold’em · SHOWDOWN");
  expect(
    projectActiveGame({
      game: "POKER",
      blackjackPhase: "TABLE_SETUP",
      pokerPhase: "HAND_COMPLETE",
    }).headline,
  ).toBe("Texas Hold’em · HAND COMPLETE");
});

test("Blackjack tables keep the round phase", () => {
  expect(
    projectActiveGame({
      game: "BLACKJACK",
      blackjackPhase: "PAYOUT",
      pokerPhase: "PRE_FLOP",
    }).headline,
  ).toBe("Blackjack · PAYOUT");
});

test("PRE_FLOP label uses a hyphen", () => {
  expect(formatPokerPhaseLabel("PRE_FLOP")).toBe("PRE-FLOP");
  expect(formatPokerPhaseLabel("HAND_COMPLETE")).toBe("HAND COMPLETE");
});

test("an active Poker hand is anything except setup or complete", () => {
  expect(pokerHandIsOpen("PRE_FLOP")).toBe(true);
  expect(pokerHandIsOpen("POKER_SETUP")).toBe(false);
  expect(pokerHandIsOpen("HAND_COMPLETE")).toBe(false);
  expect(pokerHandIsOpen(null)).toBe(false);
});
