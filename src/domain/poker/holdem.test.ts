import { describe, expect, test } from "vitest";
import { assignBlinds, nextDealer, orderedSeats } from "./seats";
import { buildSidePots, splitPotEqually, uncalledReturn } from "./pots";
import { amountToCall, isFullRaise, legalActions } from "./actions";
import { streetIsComplete } from "./street";
import { pokerStreetRail } from "./phases";

const seats = [
  { playerId: "d", orderIndex: 0 },
  { playerId: "a", orderIndex: 1 },
  { playerId: "b", orderIndex: 2 },
];

test("street rail highlights the current phase only", () => {
  expect(pokerStreetRail("POKER_SETUP").map((stop) => `${stop.id}:${stop.state}`)).toEqual([
    "DEAL:current",
    "PRE-FLOP:next",
    "FLOP:next",
    "TURN:next",
    "RIVER:next",
    "SHOWDOWN:next",
  ]);
  expect(pokerStreetRail("RIVER").find((stop) => stop.state === "current")?.id).toBe("RIVER");
  expect(pokerStreetRail("RIVER").filter((stop) => stop.state === "done").map((stop) => stop.id)).toEqual([
    "DEAL",
    "PRE-FLOP",
    "FLOP",
    "TURN",
  ]);
  expect(pokerStreetRail("HAND_COMPLETE").every((stop) => stop.state === "done")).toBe(true);
});

test("three-player blinds sit left of the dealer", () => {
  const blinds = assignBlinds(seats, "d");
  expect(blinds.headsUp).toBe(false);
  expect(blinds.smallBlindPlayerId).toBe("a");
  expect(blinds.bigBlindPlayerId).toBe("b");
  expect(blinds.preflopFirstPlayerId).toBe("d");
  expect(blinds.postflopFirstPlayerId).toBe("a");
});

test("heads-up dealer posts the small blind and acts first pre-flop", () => {
  const blinds = assignBlinds(seats.slice(0, 2), "d");
  expect(blinds.headsUp).toBe(true);
  expect(blinds.smallBlindPlayerId).toBe("d");
  expect(blinds.bigBlindPlayerId).toBe("a");
  expect(blinds.preflopFirstPlayerId).toBe("d");
  expect(blinds.postflopFirstPlayerId).toBe("a");
});

test("dealer rotates to the next ordered seat", () => {
  expect(nextDealer(seats, "d").playerId).toBe("a");
  expect(nextDealer(seats, "b").playerId).toBe("d");
});

test("all-in layers create a main pot and a side pot", () => {
  const pots = buildSidePots([
    { playerId: "short", total: 50000n, folded: false },
    { playerId: "deep", total: 100000n, folded: false },
    { playerId: "mid", total: 100000n, folded: false },
  ]);
  expect(pots).toHaveLength(2);
  expect(pots[0]).toMatchObject({ amountMillis: 150000n, eligiblePlayerIds: ["short", "deep", "mid"] });
  expect(pots[1]).toMatchObject({ amountMillis: 100000n, eligiblePlayerIds: ["deep", "mid"] });
});

test("folded contribution stays in the pot but cannot win it", () => {
  const pots = buildSidePots([
    { playerId: "fold", total: 25000n, folded: true },
    { playerId: "live", total: 25000n, folded: false },
  ]);
  expect(pots[0]?.amountMillis).toBe(50000n);
  expect(pots[0]?.eligiblePlayerIds).toEqual(["live"]);
});

test("split remainder is assigned left of the dealer", () => {
  const awards = splitPotEqually(1000n, ["a", "b"], "d", seats);
  expect(awards.get("a")).toBe(500n);
  expect(awards.get("b")).toBe(500n);
  const odd = splitPotEqually(1001n, ["a", "b"], "d", seats);
  expect((odd.get("a") ?? 0n) + (odd.get("b") ?? 0n)).toBe(1001n);
  expect(odd.get("a")).toBe(501n);
});

test("uncalled extra returns to the last live player", () => {
  const extra = uncalledReturn([
    { playerId: "raiser", total: 80000n, folded: false },
    { playerId: "fold", total: 25000n, folded: true },
  ]);
  expect(extra).toEqual({ playerId: "raiser", amount: 55000n });
});

test("check is illegal when chips are owed", () => {
  const actions = legalActions({
    isActor: true,
    status: "ACTIVE",
    streetContributionMillis: 0n,
    streetWagerMillis: 10000n,
    availableMillis: 90000n,
    lastRaiseSizeMillis: 10000n,
  });
  expect(actions.some((action) => action.type === "CHECK")).toBe(false);
  expect(actions.some((action) => action.type === "CALL")).toBe(true);
  expect(amountToCall(10000n, 0n)).toBe(10000n);
});

test("check is legal when nothing is owed", () => {
  const actions = legalActions({
    isActor: true,
    status: "ACTIVE",
    streetContributionMillis: 10000n,
    streetWagerMillis: 10000n,
    availableMillis: 90000n,
    lastRaiseSizeMillis: 10000n,
  });
  expect(actions.some((action) => action.type === "CHECK")).toBe(true);
  expect(actions.some((action) => action.type === "BET")).toBe(false);
  expect(actions.some((action) => action.type === "RAISE")).toBe(true);
});

test("bet is legal only when the street wager is zero", () => {
  const actions = legalActions({
    isActor: true,
    status: "ACTIVE",
    streetContributionMillis: 0n,
    streetWagerMillis: 0n,
    availableMillis: 90000n,
    lastRaiseSizeMillis: 10000n,
  });
  expect(actions.some((action) => action.type === "BET")).toBe(true);
});

test("a non-actor has no legal actions", () => {
  expect(
    legalActions({
      isActor: false,
      status: "ACTIVE",
      streetContributionMillis: 0n,
      streetWagerMillis: 0n,
      availableMillis: 100000n,
      lastRaiseSizeMillis: 10000n,
    }),
  ).toEqual([]);
});

test("a full raise is at least the previous raise size", () => {
  expect(isFullRaise(20000n, 10000n, 10000n)).toBe(true);
  expect(isFullRaise(15000n, 10000n, 10000n)).toBe(false);
});

test("the street completes only after every live actor matches and has acted", () => {
  const players = [
    { playerId: "a", status: "ACTIVE" as const, streetContributionMillis: 10000n, hasActedThisStreet: true },
    { playerId: "b", status: "ACTIVE" as const, streetContributionMillis: 10000n, hasActedThisStreet: false },
  ];
  expect(streetIsComplete(players, 10000n)).toBe(false);
  players[1]!.hasActedThisStreet = true;
  expect(streetIsComplete(players, 10000n)).toBe(true);
});

test("one remaining live player completes the street", () => {
  expect(
    streetIsComplete(
      [
        { playerId: "a", status: "ACTIVE", streetContributionMillis: 0n, hasActedThisStreet: false },
        { playerId: "b", status: "FOLDED", streetContributionMillis: 0n, hasActedThisStreet: true },
      ],
      10000n,
    ),
  ).toBe(true);
});

test("seat order is stable", () => {
  expect(orderedSeats([{ playerId: "b", orderIndex: 2 }, { playerId: "a", orderIndex: 1 }]).map((seat) => seat.playerId)).toEqual([
    "a",
    "b",
  ]);
});
