import { expect, test } from "vitest";
import { selectTableBoard } from "./table-board";

test("Owner/Dealer not seated uses Create Table then Dealer Phase 0 and Dealer live boards", () => {
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: true,
      isSeatedPlayer: false,
      game: "BLACKJACK",
      phase: "TABLE_SETUP",
      setup: { setupCompleted: false },
    }),
  ).toBe("CREATE_TABLE");
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: true,
      isSeatedPlayer: false,
      game: "BLACKJACK",
      phase: "TABLE_SETUP",
      setup: { setupCompleted: true },
    }),
  ).toBe("BLACKJACK_DEALER");
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: true,
      isSeatedPlayer: false,
      game: "BLACKJACK",
      phase: "BETTING",
    }),
  ).toBe("BLACKJACK_DEALER");
});

test("Owner/Dealer who is also seated still uses the Dealer board", () => {
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: true,
      isSeatedPlayer: true,
      game: "BLACKJACK",
      phase: "BETTING",
    }),
  ).toBe("BLACKJACK_DEALER");
});

test("separate Dealer is not the Player board", () => {
  expect(
    selectTableBoard({
      isOwner: false,
      isDealer: true,
      isSeatedPlayer: false,
      game: "BLACKJACK",
      phase: "PLAYING",
    }),
  ).toBe("BLACKJACK_DEALER");
});

test("Guest and Verified seated Players use Player boards", () => {
  expect(
    selectTableBoard({
      isOwner: false,
      isDealer: false,
      isSeatedPlayer: true,
      game: "BLACKJACK",
      phase: "TABLE_SETUP",
    }),
  ).toBe("PHASE_ZERO_PLAYER");
  expect(
    selectTableBoard({
      isOwner: false,
      isDealer: false,
      isSeatedPlayer: true,
      game: "BLACKJACK",
      phase: "BETTING",
    }),
  ).toBe("BLACKJACK_PLAYER");
  expect(
    selectTableBoard({
      isOwner: false,
      isDealer: false,
      isSeatedPlayer: true,
      game: "BLACKJACK",
      phase: "PAYOUT",
    }),
  ).toBe("BLACKJACK_PLAYER");
});

test("Owner who assigned away Dealer still sees the Dealer Blackjack surface in Phase 0", () => {
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: false,
      isSeatedPlayer: true,
      game: "BLACKJACK",
      phase: "TABLE_SETUP",
      setup: { setupCompleted: true },
    }),
  ).toBe("BLACKJACK_DEALER");
});

test("Owner only is not inferred as Player or Dealer", () => {
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: false,
      isSeatedPlayer: false,
      game: "BLACKJACK",
      phase: "BETTING",
    }),
  ).toBe("WAITING");
});

test("Blackjack live phases keep Dealer and Player boards distinct", () => {
  for (const phase of ["BETTING", "PLAYING", "PAYOUT", "ROUND_COMPLETE"] as const) {
    expect(
      selectTableBoard({
        isOwner: true,
        isDealer: true,
        isSeatedPlayer: false,
        game: "BLACKJACK",
        phase,
      }),
    ).toBe("BLACKJACK_DEALER");
    expect(
      selectTableBoard({
        isOwner: false,
        isDealer: false,
        isSeatedPlayer: true,
        game: "BLACKJACK",
        phase,
      }),
    ).toBe("BLACKJACK_PLAYER");
  }
});

test("Poker Owner and Player boards stay distinct", () => {
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: false,
      isSeatedPlayer: true,
      game: "POKER",
      phase: "POKER_SETUP",
      poker: { phase: "POKER_SETUP" },
      setup: { setupCompleted: true },
    }),
  ).toBe("POKER_DEALER");
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: false,
      isSeatedPlayer: true,
      game: "POKER",
      phase: "POKER_SETUP",
      poker: { phase: "POKER_SETUP" },
    }),
  ).toBe("POKER_DEALER");
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: false,
      isSeatedPlayer: true,
      game: "POKER",
      phase: "PRE_FLOP",
      poker: { phase: "PRE_FLOP" },
    }),
  ).toBe("POKER_DEALER");
  expect(
    selectTableBoard({
      isOwner: false,
      isDealer: false,
      isSeatedPlayer: true,
      game: "POKER",
      phase: "PRE_FLOP",
      poker: { phase: "PRE_FLOP" },
    }),
  ).toBe("POKER_PLAYER");
});
