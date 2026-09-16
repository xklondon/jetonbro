import { expect, test } from "vitest";
import { SWITCH_BLOCKED, assertCanSwitchGame } from "./switch-game";
import { DomainError } from "../errors";

test("owner can switch during unstaked betting or a completed round", () => {
  expect(() =>
    assertCanSwitchGame({
      isOwner: true,
      game: "BLACKJACK",
      blackjackPhase: "BETTING",
      pokerPhase: null,
      hasLockedBlackjack: false,
      hasBankExposure: false,
      hasLockedPoker: false,
    }),
  ).not.toThrow();
});

test("locked value blocks a game switch", () => {
  try {
    assertCanSwitchGame({
      isOwner: true,
      game: "BLACKJACK",
      blackjackPhase: "BETTING",
      pokerPhase: null,
      hasLockedBlackjack: true,
      hasBankExposure: false,
      hasLockedPoker: false,
    });
    throw new Error("expected switch to be blocked");
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).message).toBe(SWITCH_BLOCKED);
  }
});

test("only the owner can switch games", () => {
  expect(() =>
    assertCanSwitchGame({
      isOwner: false,
      game: "BLACKJACK",
      blackjackPhase: "TABLE_SETUP",
      pokerPhase: null,
      hasLockedBlackjack: false,
      hasBankExposure: false,
      hasLockedPoker: false,
    }),
  ).toThrow(/owner/i);
});
