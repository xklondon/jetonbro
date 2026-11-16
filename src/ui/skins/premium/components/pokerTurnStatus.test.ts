import { describe, expect, it } from "vitest";
import { formatPokerTurnStatus } from "./pokerTurnStatus";

describe("formatPokerTurnStatus", () => {
  it("appends CHECK when YOUR TURN and no outstanding call", () => {
    expect(formatPokerTurnStatus("YOUR TURN", null)).toBe("YOUR TURN · CHECK");
    expect(formatPokerTurnStatus("YOUR TURN", "0")).toBe("YOUR TURN · CHECK");
  });

  it("appends TO CALL N from authoritative toCall label", () => {
    expect(formatPokerTurnStatus("YOUR TURN", "5")).toBe("YOUR TURN · TO CALL 5");
    expect(formatPokerTurnStatus("YOUR TURN", "10")).toBe("YOUR TURN · TO CALL 10");
  });

  it("leaves waiting / setup status unchanged", () => {
    expect(formatPokerTurnStatus("TURN · Sam", "10")).toBe("TURN · Sam");
    expect(formatPokerTurnStatus("Waiting for Players", null)).toBe("Waiting for Players");
    expect(formatPokerTurnStatus("HAND COMPLETE", null)).toBe("HAND COMPLETE");
  });
});
