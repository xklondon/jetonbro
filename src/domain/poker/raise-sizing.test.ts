import { describe, expect, it } from "vitest";
import {
  isFullRaise,
  minBetSize,
  minRaiseTo,
  nextLastRaiseSize,
  raiseIncrement,
} from "./raise-sizing";

const j = (n: number) => BigInt(n) * 1000n;

describe("NLHE minimum raise sizing (BB = 10)", () => {
  const bb = j(10);

  it("pre-flop start: open to 10 → min raise-to 20", () => {
    // Street wager already at BB; last increment is BB.
    expect(minRaiseTo(bb, bb)).toBe(j(20));
  });

  it("opening bet of 25 establishes increment 25 → min raise-to 50", () => {
    expect(minBetSize(bb, bb)).toBe(j(10));
    expect(isFullRaise(j(25), 0n, bb)).toBe(true);
    const last = nextLastRaiseSize(j(25), 0n, bb);
    expect(last).toBe(j(25));
    expect(minRaiseTo(j(25), last)).toBe(j(50));
  });

  it("raise 10 → 30 updates increment to 20 → next min raise-to 50", () => {
    expect(isFullRaise(j(30), j(10), j(10))).toBe(true);
    const last = nextLastRaiseSize(j(30), j(10), j(10));
    expect(last).toBe(j(20));
    expect(raiseIncrement(j(30), j(10))).toBe(j(20));
    expect(minRaiseTo(j(30), last)).toBe(j(50));
    // Must NOT double the raise-to (would be 60).
    expect(minRaiseTo(j(30), last)).not.toBe(j(60));
  });

  it("raise 30 → 40 is not a full raise when last increment was 20", () => {
    expect(isFullRaise(j(40), j(30), j(20))).toBe(false);
    expect(nextLastRaiseSize(j(40), j(30), j(20))).toBe(j(20));
    expect(minRaiseTo(j(40), j(20))).toBe(j(60));
  });

  it("raise 40 → 65 (increment 25) → next min raise-to 90", () => {
    const last = nextLastRaiseSize(j(65), j(40), j(20));
    expect(last).toBe(j(25));
    expect(minRaiseTo(j(65), last)).toBe(j(90));
  });

  it("short all-in below full raise keeps the prior increment", () => {
    // Facing 10 with last full = 10; all-in to 15 is short.
    expect(isFullRaise(j(15), j(10), j(10))).toBe(false);
    expect(nextLastRaiseSize(j(15), j(10), j(10))).toBe(j(10));
    // Next full raise must still add at least 10 over the current 15 wager.
    expect(minRaiseTo(j(15), j(10))).toBe(j(25));
  });

  it("successive full raises never replace increment with the absolute raise-to", () => {
    let street = j(10);
    let last = j(10);
    // open-raise to 25
    last = nextLastRaiseSize(j(25), street, last);
    street = j(25);
    expect(last).toBe(j(15));
    expect(minRaiseTo(street, last)).toBe(j(40));
    // raise to 40
    last = nextLastRaiseSize(j(40), street, last);
    street = j(40);
    expect(last).toBe(j(15));
    expect(minRaiseTo(street, last)).toBe(j(55));
    // raise to 70
    last = nextLastRaiseSize(j(70), street, last);
    street = j(70);
    expect(last).toBe(j(30));
    expect(minRaiseTo(street, last)).toBe(j(100));
  });
});
