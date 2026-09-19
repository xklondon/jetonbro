import { expect, test } from "vitest";
import { buildPokerView } from "./poker-snapshot";

const members = [
  { userId: "a", availableMillis: 95000n, user: { name: "Alex", email: "a@t.test" } },
  { userId: "b", availableMillis: 105000n, user: { name: "Sam", email: "b@t.test" } },
];

const seats = [
  { playerId: "a", orderIndex: 0, sittingOut: false },
  { playerId: "b", orderIndex: 1, sittingOut: false },
];

test("HAND_COMPLETE cannot show toCall, an actor, or leftover street wager", () => {
  const view = buildPokerView({
    tableName: "Hold em",
    isOwner: true,
    viewerId: "a",
    smallBlind: 5000n,
    bigBlind: 10000n,
    members,
    seats,
    hand: {
      id: "h1",
      number: 1,
      phase: "HAND_COMPLETE",
      dealerPlayerId: "a",
      smallBlindPlayerId: "a",
      bigBlindPlayerId: "b",
      currentActorPlayerId: "a",
      streetWagerMillis: 5000n,
      lastRaiseSizeMillis: 10000n,
      actionCount: 3,
      nextHandDeadlineAt: null,
      settledKey: "h1",
      awardSummary: [{ playerId: "b", amount: "15", millis: "15000" }],
      participants: [
        {
          playerId: "a",
          status: "FOLDED",
          streetContributionMillis: 5000n,
          totalContributionMillis: 5000n,
          lockedMillis: 0n,
          hasActedThisStreet: true,
          isDealer: true,
          isSmallBlind: true,
          isBigBlind: false,
          seatOrder: 0,
          player: { name: "Alex", email: "a@t.test" },
        },
        {
          playerId: "b",
          status: "ACTIVE",
          streetContributionMillis: 0n,
          totalContributionMillis: 10000n,
          lockedMillis: 0n,
          hasActedThisStreet: false,
          isDealer: false,
          isSmallBlind: false,
          isBigBlind: true,
          seatOrder: 1,
          player: { name: "Sam", email: "b@t.test" },
        },
      ],
      pots: [],
    },
    tableClosed: false,
  });
  expect(view.phase).toBe("HAND_COMPLETE");
  expect(view.toCall.label).toBe("0");
  expect(view.potPaid).toBe(true);
  expect(view.pot.label).toBe("0");
  expect(view.currentActorId).toBeNull();
  expect(view.waitingCopy).toBeNull();
  expect(view.legalActions).toEqual([]);
  expect(view.seats.every((seat) => !seat.isActor && seat.toCall.label === "0")).toBe(true);
  expect(view.winners[0]).toMatchObject({ userId: "b", name: "Sam" });
  expect(view.winners[0]?.amount.label).toBe("15");
  expect(view.winners[0]?.amount.millis).toBe("15000");
  expect(view.copy).toBe("Sam WON 15");
  expect(view.streetWager.label).toBe("0");
});

test("pre-flop blinds show pot 15 and CALL 5 for the small blind", () => {
  const view = buildPokerView({
    tableName: "Hold em",
    isOwner: true,
    viewerId: "a",
    smallBlind: 5000n,
    bigBlind: 10000n,
    members: [
      { userId: "a", availableMillis: 95000n, user: { name: "Alex", email: "a@t.test" } },
      { userId: "b", availableMillis: 90000n, user: { name: "Sam", email: "b@t.test" } },
    ],
    seats,
    hand: {
      id: "h1",
      number: 1,
      phase: "PRE_FLOP",
      dealerPlayerId: "a",
      smallBlindPlayerId: "a",
      bigBlindPlayerId: "b",
      currentActorPlayerId: "a",
      streetWagerMillis: 10000n,
      lastRaiseSizeMillis: 10000n,
      actionCount: 0,
      nextHandDeadlineAt: null,
      settledKey: null,
      awardSummary: null,
      participants: [
        {
          playerId: "a",
          status: "ACTIVE",
          streetContributionMillis: 5000n,
          totalContributionMillis: 5000n,
          lockedMillis: 5000n,
          hasActedThisStreet: false,
          isDealer: true,
          isSmallBlind: true,
          isBigBlind: false,
          seatOrder: 0,
          player: { name: "Alex", email: "a@t.test" },
        },
        {
          playerId: "b",
          status: "ACTIVE",
          streetContributionMillis: 10000n,
          totalContributionMillis: 10000n,
          lockedMillis: 10000n,
          hasActedThisStreet: false,
          isDealer: false,
          isSmallBlind: false,
          isBigBlind: true,
          seatOrder: 1,
          player: { name: "Sam", email: "b@t.test" },
        },
      ],
      pots: [{ index: 0, amountMillis: 15000n, capMillis: 10000n, eligiblePlayerIds: ["a", "b"], winnerPlayerIds: [] }],
    },
    tableClosed: false,
  });
  expect(view.pot.label).toBe("15");
  expect(view.potPaid).toBe(false);
  expect(view.toCall.label).toBe("5");
  expect(view.currentActorId).toBe("a");
  expect(view.legalActions.map((action) => action.type)).toEqual(["FOLD", "CALL", "RAISE", "ALL_IN"]);
  expect(view.legalActions.find((action) => action.type === "CALL")?.label).toBe("CALL 5");
});
