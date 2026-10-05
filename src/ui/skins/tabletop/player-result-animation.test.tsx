import { describe, expect, it } from "vitest";
import { nextCelebrateClass } from "./components/primitives/result-celebrate";

describe("Player result celebrate state machine", () => {
  it("skips celebration on first mount with settled outcome (refresh)", () => {
    expect(nextCelebrateClass(undefined, "WON")).toEqual({ nextPrev: "WON", celebrate: null });
    expect(nextCelebrateClass(undefined, "BLACKJACK")).toEqual({ nextPrev: "BLACKJACK", celebrate: null });
  });

  it("emits one-shot class when outcome newly arrives", () => {
    expect(nextCelebrateClass(null, "WON")).toEqual({ nextPrev: "WON", celebrate: "is-celebrate-won" });
    expect(nextCelebrateClass(null, "LOST")).toEqual({ nextPrev: "LOST", celebrate: "is-celebrate-lost" });
    expect(nextCelebrateClass(null, "PUSH")).toEqual({ nextPrev: "PUSH", celebrate: "is-celebrate-push" });
    expect(nextCelebrateClass(null, "BLACKJACK")).toEqual({ nextPrev: "BLACKJACK", celebrate: "is-celebrate-blackjack" });
  });

  it("does not retrigger on identical outcome", () => {
    expect(nextCelebrateClass("WON", "WON")).toEqual({ nextPrev: "WON", celebrate: null });
    expect(nextCelebrateClass("BLACKJACK", "BLACKJACK")).toEqual({ nextPrev: "BLACKJACK", celebrate: null });
  });

  it("resets when outcome clears", () => {
    expect(nextCelebrateClass("WON", null)).toEqual({ nextPrev: null, celebrate: null });
  });
});
