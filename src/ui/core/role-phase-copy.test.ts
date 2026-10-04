import { expect, test } from "vitest";
import { blackjackPhaseInstruction, blackjackPhaseLabel } from "./blackjack-phase-controls";

test("Blackjack role and phase copy is compact and exact", () => {
  expect(blackjackPhaseLabel({ role: "PLAYER", phase: "TABLE_SETUP" })).toBe(
    "Waiting for the table to open betting.",
  );
  expect(blackjackPhaseLabel({ role: "PLAYER", phase: "BETTING" })).toBe("Betting is open.");
  expect(blackjackPhaseLabel({ role: "PLAYER", phase: "BETTING", hasStake: true })).toBe("Betting is open.");
  expect(blackjackPhaseLabel({ role: "DEALER", phase: "TABLE_SETUP" })).toBe("Table setup");
  expect(blackjackPhaseLabel({ role: "DEALER", phase: "BETTING" })).toBe("Betting open");
  expect(blackjackPhaseLabel({ role: "DEALER", phase: "PLAYING" })).toBe("PLAYING");
  expect(blackjackPhaseLabel({ role: "DEALER", phase: "PAYOUT" })).toBe("PAYOUT");
  expect(blackjackPhaseLabel({ role: "PLAYER", phase: "PLAYING" })).toBe("PLAYING");
  expect(blackjackPhaseLabel({ role: "PLAYER", phase: "PAYOUT" })).toBe("PAYOUT");
});

test("never shows Waiting for players when Betting is open or one player is present", () => {
  const cases = [
    { role: "PLAYER" as const, phase: "TABLE_SETUP" },
    { role: "PLAYER" as const, phase: "BETTING" },
    { role: "PLAYER" as const, phase: "BETTING", hasStake: true },
    { role: "DEALER" as const, phase: "TABLE_SETUP" },
    { role: "DEALER" as const, phase: "BETTING" },
  ];
  for (const input of cases) {
    expect(blackjackPhaseLabel(input)).not.toMatch(/waiting for players/i);
    expect(blackjackPhaseInstruction(input)).not.toMatch(/waiting for players/i);
  }
});
