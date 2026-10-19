import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PokerTableView } from "@/application/queries/views";
import { PremiumPokerPlayer } from "./PremiumPokerPlayer";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

function seat(
  userId: string,
  name: string,
  orderIndex: number,
  o: Partial<PokerTableView["seats"][number]> = {},
): PokerTableView["seats"][number] {
  return {
    userId,
    name,
    available: money("100"),
    contribution: money("0", "0"),
    streetContribution: money("0", "0"),
    toCall: money("0", "0"),
    status: "ACTIVE",
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    isActor: false,
    sittingOut: false,
    orderIndex,
    hasHoleCards: false,
    holeCards: null,
    ...o,
  };
}

function view(extra: Partial<PokerTableView> = {}): PokerTableView {
  return {
    role: "POKER_PLAYER",
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "",
    tableName: "WALNUT",
    copy: "",
    isOwner: false,
    pot: money("15"),
    potPaid: false,
    toCall: money("10"),
    contribution: money("0", "0"),
    available: money("95"),
    smallBlind: money("5"),
    bigBlind: money("10"),
    streetWager: money("10"),
    viewerStatus: "ACTIVE",
    seats: [
      seat("v", "Vi", 0, { isActor: true, isDealer: true }),
      seat("s", "Sam", 1, { isBigBlind: true, streetContribution: money("10") }),
    ],
    pots: [],
    legalActions: [
      { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
      { type: "CALL", amount: money("10"), label: "CALL 10" },
      { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE" },
    ],
    currentActorName: "Vi",
    currentActorId: "v",
    waitingCopy: "YOUR TURN",
    winners: [],
    canDealStreet: false,
    nextStreetLabel: "DEAL FLOP",
    canAward: false,
    canNextHand: false,
    canScheduleNextHand: false,
    nextHandDeadlineAt: null,
    canSwitchGame: true,
    switchBlockedReason: null,
    canAddPlayer: true,
    canGiveJetons: true,
    canReorderSeats: false,
    streetComplete: false,
    allInRunout: false,
    turnNumber: 1,
    handNumber: 1,
    viewerId: "v",
    communityCards: [],
    canEditCommunity: false,
    canEditHole: false,
    streetRail: [],
    ...extra,
  };
}

describe("PremiumPokerPlayer live tray", () => {
  it("shows denomination tray, AVAILABLE once, and Fold/Call when actor", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPokerPlayer, { view: view(), onCommand: () => undefined }),
    );
    expect(html).toContain('data-jeton-tray="true"');
    expect(html).toContain('data-casino-jeton="true"');
    expect(html).toContain("AVAILABLE");
    expect(html.match(/AVAILABLE/g)?.length).toBe(1);
    expect(html).toContain("FOLD");
    expect(html).toContain("CALL 10");
    expect(html).toContain('data-pot-chips="true"');
    expect(html).toContain('data-pot-amount="15"');
    expect(html).not.toContain('data-street-wager="true"');
    expect(html).not.toContain('data-header-balance="true"');
  });

  it("keeps tray populated but disables actions when waiting on another actor", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPokerPlayer, {
        view: view({
          currentActorId: "s",
          currentActorName: "Sam",
          legalActions: [],
          seats: [
            seat("v", "Vi", 0, { isDealer: true }),
            seat("s", "Sam", 1, { isActor: true, isBigBlind: true }),
          ],
        }),
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain('data-jeton-tray="true"');
    expect(html).toContain("TURN · Sam");
    expect(html).not.toContain(">FOLD<");
    expect(html).not.toContain(">CALL");
    expect(html).toContain("disabled");
  });

  it("wires raise chips through pokerAct with raise-to minimum", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(__dirname, "PremiumPokerPlayer.tsx"), "utf8");
    expect(source).toContain('onCommand("pokerAct"');
    expect(source).toContain("visiblePokerLegalActions");
    expect(source).toContain("pokerTrayEnabled");
    expect(source).toContain("raiseTo?.label");
    expect(source).toContain("Math.max(chip, min)");
  });

  it("setup dock omits AVAILABLE (balance stays on seat)", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPokerPlayer, {
        view: view({
          phase: "POKER_SETUP",
          legalActions: [],
          currentActorId: null,
          seats: [
            seat("v", "Vi", 0, { status: "WAITING" }),
            seat("s", "Sam", 1, { status: "WAITING" }),
          ],
        }),
        onCommand: () => undefined,
      }),
    );
    expect(html).not.toContain("AVAILABLE");
    expect(html).not.toContain('data-jeton-tray="true"');
  });
});
