import { describe, expect, it } from "vitest";
import { nextHandRotation } from "./rotation";

const seats = [
  { playerId: "a", orderIndex: 0 },
  { playerId: "b", orderIndex: 1 },
  { playerId: "c", orderIndex: 2 },
];

describe("nextHandRotation", () => {
  it("rotates the button and blinds for three players", () => {
    const next = nextHandRotation(seats, "a", () => 100_000n);
    expect(next.dealerPlayerId).toBe("b");
    expect(next.smallBlindPlayerId).toBe("c");
    expect(next.bigBlindPlayerId).toBe("a");
  });

  it("uses heads-up blinds (dealer posts SB)", () => {
    const next = nextHandRotation(
      [
        { playerId: "a", orderIndex: 0 },
        { playerId: "b", orderIndex: 1 },
      ],
      "a",
      () => 100_000n,
    );
    expect(next.headsUp).toBe(true);
    expect(next.dealerPlayerId).toBe("b");
    expect(next.smallBlindPlayerId).toBe("b");
    expect(next.bigBlindPlayerId).toBe("a");
  });

  it("skips broke seats when choosing the next dealer", () => {
    const next = nextHandRotation(seats, "a", (id) => (id === "b" ? 0n : 100_000n));
    expect(next.headsUp).toBe(true);
    expect(next.dealerPlayerId).toBe("c");
    expect(next.smallBlindPlayerId).toBe("c");
    expect(next.bigBlindPlayerId).toBe("a");
  });
});
