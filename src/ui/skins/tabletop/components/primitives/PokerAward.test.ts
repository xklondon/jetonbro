import { describe, expect, it } from "vitest";
import type { PokerTableView } from "@/application/queries/views";
import { nextHandPreview } from "@/ui/skins/tabletop/components/primitives/PokerAward";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

function seat(userId: string, name: string, orderIndex: number, flags: Partial<{ isDealer: boolean; isSmallBlind: boolean; isBigBlind: boolean }> = {}) {
  return {
    userId,
    name,
    available: money("100"),
    contribution: money("0", "0"),
    streetContribution: money("0", "0"),
    toCall: money("0", "0"),
    status: "ACTIVE" as const,
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    isActor: false,
    sittingOut: false,
    orderIndex,
    hasHoleCards: false,
    holeCards: null,
    ...flags,
  };
}

describe("nextHandPreview", () => {
  it("rotates heads-up Dealer/SB/BB from domain helpers", () => {
    const view = {
      phase: "HAND_COMPLETE",
      seats: [seat("a", "Ada", 0, { isDealer: true, isSmallBlind: true }), seat("b", "Bea", 1, { isBigBlind: true })],
    } as PokerTableView;
    expect(nextHandPreview(view)).toEqual({ dealer: "Bea", sb: "Bea", bb: "Ada" });
  });

  it("rotates three-handed blinds left of the next dealer", () => {
    const view = {
      phase: "HAND_COMPLETE",
      seats: [
        seat("a", "Ada", 0, { isDealer: true }),
        seat("b", "Bea", 1, { isSmallBlind: true }),
        seat("c", "Cid", 2, { isBigBlind: true }),
      ],
    } as PokerTableView;
    expect(nextHandPreview(view)).toEqual({ dealer: "Bea", sb: "Cid", bb: "Ada" });
  });

  it("returns null outside Hand Complete", () => {
    const view = {
      phase: "PRE_FLOP",
      seats: [seat("a", "Ada", 0, { isDealer: true }), seat("b", "Bea", 1)],
    } as PokerTableView;
    expect(nextHandPreview(view)).toBeNull();
  });
});
