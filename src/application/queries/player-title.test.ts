import { expect, test } from "vitest";
import { playerTitleForPhase } from "./player-copy";

test("Player Payout waits while any box is unresolved", () => {
  expect(
    playerTitleForPhase("PAYOUT", [
      { outcome: null },
      { outcome: "WON" },
    ]),
  ).toBe("Waiting for the Bank");
});

test("Player Payout is complete when every box is resolved", () => {
  expect(
    playerTitleForPhase("PAYOUT", [
      { outcome: "LOST" },
      { outcome: "PUSH" },
    ]),
  ).toBe("Hand complete");
  expect(playerTitleForPhase("ROUND_COMPLETE", [{ outcome: "WON" }])).toBe("Hand complete");
});
