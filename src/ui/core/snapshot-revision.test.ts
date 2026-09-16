import { expect, test } from "vitest";
import { shouldApplySnapshot } from "./snapshot-revision";

test("rejects an older BETTING snapshot after Deal has moved the table to PLAYING", () => {
  expect(
    shouldApplySnapshot(
      { revision: 200, phase: "PLAYING", roundNumber: 1 },
      { revision: 100, phase: "BETTING", roundNumber: 1 },
    ),
  ).toBe(false);
});

test("accepts the PLAYING snapshot after a stale BETTING view", () => {
  expect(
    shouldApplySnapshot(
      { revision: 100, phase: "BETTING", roundNumber: 1 },
      { revision: 200, phase: "PLAYING", roundNumber: 1 },
    ),
  ).toBe(true);
});

test("a payload without a server revision cannot replace one that has one", () => {
  expect(
    shouldApplySnapshot(
      { revision: 200, phase: "PLAYING", roundNumber: 1 },
      { phase: "BETTING", roundNumber: 1 },
    ),
  ).toBe(false);
});

test("client clock is ignored; only server revision numbers are compared", () => {
  const clientNow = Date.now() + 60_000;
  expect(
    shouldApplySnapshot(
      { revision: 400, phase: "PLAYING", roundNumber: 1 },
      { revision: 300, phase: "BETTING", roundNumber: 1 },
    ),
  ).toBe(false);
  expect(clientNow).toBeGreaterThan(400);
});

test("prefers the newer round when timestamps match", () => {
  expect(
    shouldApplySnapshot(
      { revision: 300, phase: "ROUND_COMPLETE", roundNumber: 1 },
      { revision: 300, phase: "BETTING", roundNumber: 2 },
    ),
  ).toBe(true);
  expect(
    shouldApplySnapshot(
      { revision: 300, phase: "BETTING", roundNumber: 2 },
      { revision: 300, phase: "ROUND_COMPLETE", roundNumber: 1 },
    ),
  ).toBe(false);
});

test("a lower Poker turn cannot reverse the current actor or street", () => {
  expect(
    shouldApplySnapshot(
      { revision: 400, phase: "FLOP", roundNumber: 2, turnNumber: 4 },
      { revision: 400, phase: "PRE_FLOP", roundNumber: 2, turnNumber: 1 },
    ),
  ).toBe(false);
  expect(
    shouldApplySnapshot(
      { revision: 400, phase: "PRE_FLOP", roundNumber: 2, turnNumber: 1 },
      { revision: 400, phase: "FLOP", roundNumber: 2, turnNumber: 4 },
    ),
  ).toBe(true);
});
