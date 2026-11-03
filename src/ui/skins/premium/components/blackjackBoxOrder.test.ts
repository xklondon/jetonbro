import { describe, expect, it } from "vitest";
import type { BoxView } from "@/application/queries/views";
import { orderBoxesForFelt } from "./blackjackBoxOrder";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

function box(partial: Partial<BoxView> & Pick<BoxView, "id" | "playerId" | "boxNumber">): BoxView {
  return {
    playerName: "P",
    label: `Box ${partial.boxNumber}`,
    bet: money("10"),
    originalStake: money("10"),
    isDoubled: false,
    isSplit: false,
    parentBoxId: null,
    insurance: null,
    insuranceMax: money("0"),
    insuranceResult: null,
    outcome: null,
    returned: null,
    payoutActions: [],
    ...partial,
  };
}

describe("orderBoxesForFelt", () => {
  it("keeps split children immediately beside their parent", () => {
    const ordered = orderBoxesForFelt([
      box({ id: "root", playerId: "p1", boxNumber: 1 }),
      box({ id: "other", playerId: "p1", boxNumber: 3 }),
      box({ id: "split", playerId: "p1", boxNumber: 2, isSplit: true, parentBoxId: "root" }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["root", "split", "other"]);
  });

  it("keeps each player's boxes together newest-player-left", () => {
    const ordered = orderBoxesForFelt([
      box({ id: "a1", playerId: "a", boxNumber: 1, playerName: "A" }),
      box({ id: "b1", playerId: "b", boxNumber: 4, playerName: "B" }),
      box({ id: "a2", playerId: "a", boxNumber: 2, isSplit: true, parentBoxId: "a1", playerName: "A" }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["b1", "a1", "a2"]);
  });
});
