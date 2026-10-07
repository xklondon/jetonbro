import { expect, test } from "vitest";
import { blackjackPhaseCopy, pokerPhaseCopy, pokerStartHandNotice } from "./phase-copy";
import { blackjackPhaseInstruction, blackjackPhaseLabel } from "./blackjack-phase-controls";

test("Blackjack dealer/player phase copy is single primary with optional instruction", () => {
  expect(blackjackPhaseCopy({ role: "DEALER", phase: "TABLE_SETUP", seatedPlayerCount: 0 })).toEqual({
    primary: "TABLE SETUP",
    instruction: "Invite a Player to begin.",
  });
  expect(blackjackPhaseCopy({ role: "DEALER", phase: "TABLE_SETUP", seatedPlayerCount: 1 })).toEqual({
    primary: "TABLE SETUP",
    instruction: "Ready to open betting.",
  });
  expect(blackjackPhaseCopy({ role: "PLAYER", phase: "TABLE_SETUP" })).toEqual({
    primary: "TABLE SETUP",
    instruction: "Waiting for the Dealer to open betting.",
  });
  expect(blackjackPhaseCopy({ role: "DEALER", phase: "BETTING" })).toEqual({ primary: "BETTING" });
  expect(blackjackPhaseCopy({ role: "PLAYER", phase: "BETTING" })).toEqual({ primary: "BETTING" });
  expect(blackjackPhaseCopy({ role: "DEALER", phase: "PLAYING" })).toEqual({ primary: "PLAYING" });
  expect(blackjackPhaseCopy({ role: "DEALER", phase: "PLAYING", insuranceOpen: true })).toEqual({
    primary: "INSURANCE",
  });
  expect(blackjackPhaseCopy({ role: "DEALER", phase: "PAYOUT" })).toEqual({ primary: "PAYOUT" });
});

test("Blackjack never restores Betting open", () => {
  for (const role of ["DEALER", "PLAYER"] as const) {
    const copy = blackjackPhaseCopy({ role, phase: "BETTING" });
    expect(copy.primary).toBe("BETTING");
    expect(JSON.stringify(copy)).not.toMatch(/betting open/i);
  }
  expect(blackjackPhaseLabel({ role: "PLAYER", phase: "BETTING" })).toBe("BETTING");
  expect(blackjackPhaseInstruction({ role: "DEALER", phase: "BETTING" })).not.toMatch(/betting open/i);
});

test("Poker phase 0 and live phases do not duplicate SETUP / street headings", () => {
  expect(pokerPhaseCopy({ phase: "POKER_SETUP" })).toEqual({
    primary: "TABLE SETUP",
    instruction: "Waiting for Players",
  });
  const pre = pokerPhaseCopy({ phase: "PRE_FLOP", isActor: true });
  expect(pre.primary).toBe("PRE-FLOP");
  expect(pre.instruction).toBe("YOUR TURN");
  expect(JSON.stringify(pre).match(/PRE-FLOP/g)?.length ?? 0).toBe(1);
  expect(pokerPhaseCopy({ phase: "PRE_FLOP", actorName: "Casey" }).instruction).toBe("TURN · Casey");
  expect(pokerPhaseCopy({ phase: "FLOP" }).primary).toBe("FLOP");
  expect(pokerPhaseCopy({ phase: "SHOWDOWN" }).instruction).toBeUndefined();
});

test("START HAND seat notice is compact and never the Create Table raw error", () => {
  expect(pokerStartHandNotice("Texas Hold’em needs at least two Players.")).toBe(
    "Add at least two Players to start a Poker hand.",
  );
  expect(pokerStartHandNotice("POKER_SEATS")).toBe("Add at least two Players to start a Poker hand.");
  expect(pokerStartHandNotice("Something else")).toBe("Something else");
  expect(pokerStartHandNotice(null)).toBeNull();
});
