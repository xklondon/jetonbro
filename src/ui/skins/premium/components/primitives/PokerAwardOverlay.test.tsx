import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PokerTableView } from "@/application/queries/views";
import { PokerAwardOverlay } from "./PokerAwardOverlay";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

function awardView(overrides: Partial<PokerTableView> = {}): PokerTableView {
  return {
    role: "POKER_DEALER",
    phase: "SHOWDOWN",
    phaseLabel: "SHOWDOWN",
    headline: "",
    tableName: "Award",
    copy: "",
    isOwner: true,
    pot: money("100"),
    potPaid: false,
    toCall: money("0", "0"),
    contribution: money("0", "0"),
    available: money("0", "0"),
    smallBlind: money("5"),
    bigBlind: money("10"),
    streetWager: money("0", "0"),
    viewerStatus: "ACTIVE",
    seats: [
      {
        userId: "a",
        name: "Ada",
        available: money("0", "0"),
        contribution: money("50"),
        streetContribution: money("0", "0"),
        toCall: money("0", "0"),
        status: "ACTIVE",
        isDealer: true,
        isSmallBlind: false,
        isBigBlind: false,
        isActor: false,
        sittingOut: false,
        orderIndex: 0,
        hasHoleCards: false,
        holeCards: null,
      },
      {
        userId: "b",
        name: "Bea",
        available: money("0", "0"),
        contribution: money("50"),
        streetContribution: money("0", "0"),
        toCall: money("0", "0"),
        status: "ACTIVE",
        isDealer: false,
        isSmallBlind: false,
        isBigBlind: false,
        isActor: false,
        sittingOut: false,
        orderIndex: 1,
        hasHoleCards: false,
        holeCards: null,
      },
    ],
    pots: [
      {
        index: 0,
        amount: money("100"),
        cap: money("50"),
        eligiblePlayerIds: ["a", "b"],
        winnerPlayerIds: [],
      },
    ],
    legalActions: [],
    currentActorName: null,
    currentActorId: null,
    waitingCopy: null,
    winners: [],
    canDealStreet: false,
    nextStreetLabel: null,
    canAward: true,
    canNextHand: false,
    canScheduleNextHand: false,
    nextHandDeadlineAt: null,
    canSwitchGame: false,
    switchBlockedReason: null,
    canAddPlayer: false,
    canGiveJetons: false,
    canReorderSeats: false,
    streetComplete: true,
    allInRunout: false,
    turnNumber: 1,
    handNumber: 1,
    viewerId: "owner",
    communityCards: [],
    canEditCommunity: false,
    canEditHole: false,
    streetRail: [],
    ...overrides,
  };
}

describe("PokerAwardOverlay", () => {
  it("shows AWARD POT for one winner with payout preview", () => {
    const html = renderToStaticMarkup(
      createElement(PokerAwardOverlay, {
        view: awardView(),
        winners: { 0: ["a"] },
        onToggle: () => undefined,
        onConfirm: () => undefined,
        onClear: () => undefined,
      }),
    );
    expect(html).toContain("AWARD POT");
    expect(html).toContain('data-award-mode="award"');
    expect(html).toContain('data-award-preview="true"');
    expect(html).toContain("Ada · 100");
    expect(html).not.toContain("SPLIT POT");
  });

  it("shows SPLIT POT for tied winners with equal shares", () => {
    const html = renderToStaticMarkup(
      createElement(PokerAwardOverlay, {
        view: awardView(),
        winners: { 0: ["a", "b"] },
        onToggle: () => undefined,
        onConfirm: () => undefined,
        onClear: () => undefined,
      }),
    );
    expect(html).toContain("SPLIT POT");
    expect(html).toContain('data-award-mode="split"');
    expect(html).toContain("Ada · 50");
    expect(html).toContain("Bea · 50");
  });

  it("labels MAIN and SIDE pots independently when both exist", () => {
    const html = renderToStaticMarkup(
      createElement(PokerAwardOverlay, {
        view: awardView({
          pots: [
            {
              index: 0,
              amount: money("60"),
              cap: money("20"),
              eligiblePlayerIds: ["a", "b"],
              winnerPlayerIds: [],
            },
            {
              index: 1,
              amount: money("40"),
              cap: money("40"),
              eligiblePlayerIds: ["b"],
              winnerPlayerIds: [],
            },
          ],
        }),
        winners: { 0: ["a"], 1: ["b"] },
        onToggle: () => undefined,
        onConfirm: () => undefined,
        onClear: () => undefined,
      }),
    );
    expect(html).toContain("MAIN POT");
    expect(html).toContain("SIDE POT 1");
    expect(html).toContain("AWARD POT");
  });
});
