import { expect, test } from "vitest";
import { assertFundedPokerDealer, POKER_DEALER_UNFUNDED } from "./dealer-stack";
import { DomainError } from "../errors";

test("new session rejects a zero-stack Poker Dealer", () => {
  expect(() =>
    assertFundedPokerDealer({
      dealerPlayerId: "alex",
      seats: [
        { playerId: "alex", availableMillis: 0n },
        { playerId: "casey", availableMillis: 100000n },
      ],
      sessionStarting: true,
    }),
  ).toThrow(DomainError);
  try {
    assertFundedPokerDealer({
      dealerPlayerId: "alex",
      seats: [{ playerId: "alex", availableMillis: 0n }],
      sessionStarting: true,
    });
  } catch (error) {
    expect((error as DomainError).message).toBe(POKER_DEALER_UNFUNDED);
  }
});

test("later hands may have a busted dealer", () => {
  expect(() =>
    assertFundedPokerDealer({
      dealerPlayerId: "alex",
      seats: [{ playerId: "alex", availableMillis: 0n }],
      sessionStarting: false,
    }),
  ).not.toThrow();
});
