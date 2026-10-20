import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MemberView, PokerTableView } from "@/application/queries/views";
import { PremiumPokerDealer } from "./PremiumPokerDealer";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

const members: MemberView[] = [
  {
    userId: "owner",
    name: "xklondon",
    email: "x@t.test",
    isOwner: true,
    isBankDealer: true,
    available: money("99"),
  },
  {
    userId: "k",
    name: "K",
    email: "k@t.test",
    isOwner: false,
    isBankDealer: false,
    available: money("98"),
  },
];

function seat(
  userId: string,
  name: string,
  orderIndex: number,
  o: Partial<PokerTableView["seats"][number]> = {},
): PokerTableView["seats"][number] {
  return {
    userId,
    name,
    available: money("99"),
    contribution: money("1"),
    streetContribution: money("1"),
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

function dealerView(extra: Partial<PokerTableView> = {}): PokerTableView {
  return {
    role: "POKER_DEALER",
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "",
    tableName: "XKLONDON’S TABLE",
    copy: "",
    isOwner: true,
    pot: money("3"),
    potPaid: false,
    toCall: money("1"),
    contribution: money("1"),
    available: money("99"),
    smallBlind: money("1"),
    bigBlind: money("2"),
    streetWager: money("2"),
    viewerStatus: "ACTIVE",
    seats: [
      seat("owner", "xklondon", 0, {
        isActor: true,
        isDealer: true,
        isSmallBlind: true,
        streetContribution: money("1"),
      }),
      seat("k", "K", 1, { isBigBlind: true, streetContribution: money("2"), available: money("98") }),
    ],
    pots: [],
    legalActions: [
      { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
      { type: "CALL", amount: money("1"), label: "CALL 1" },
      { type: "RAISE", amount: money("98"), raiseTo: money("4"), label: "RAISE" },
    ],
    currentActorName: "xklondon",
    currentActorId: "owner",
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
    viewerId: "owner",
    communityCards: [],
    canEditCommunity: false,
    canEditHole: false,
    streetRail: [],
    ...extra,
  };
}

describe("PremiumPokerDealer setup wiring", () => {
  it("opens invite mask and uses canonical start/invite commands", () => {
    const source = readFileSync(join(__dirname, "PremiumPokerDealer.tsx"), "utf8");
    expect(source).toContain("PremiumInviteMask");
    expect(source).toContain("setInviteOpen(true)");
    expect(source).not.toContain("onClick: () => undefined");
    expect(source).toContain('onCommand("startTexasHoldem")');
    expect(source).toContain('onCommand("startNextPokerHand")');
    expect(source).toContain('onCommand("advancePokerStreet")');
    expect(source).toContain('variant={compactDock ? "setup" : "default"}');
    expect(source).toContain("ownerSeated");
    expect(source).toContain("pokerTrayChipAct");
    expect(source).toContain("compactDock");
  });

  it("setup dock has START HAND / ADD PLAYER without AVAILABLE overlap", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPokerDealer, {
        view: dealerView({
          phase: "POKER_SETUP",
          legalActions: [],
          currentActorId: null,
          seats: [
            seat("owner", "xklondon", 0, { status: "WAITING" }),
            seat("k", "K", 1, { status: "WAITING", available: money("100") }),
          ],
        }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain("START HAND");
    expect(html).toContain("ADD PLAYER");
    expect(html).not.toContain("AVAILABLE");
    expect(html).not.toContain('data-jeton-tray="true"');
  });

  it("HAND_COMPLETE dock keeps START HAND without AVAILABLE or tray", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPokerDealer, {
        view: dealerView({
          phase: "HAND_COMPLETE",
          legalActions: [],
          currentActorId: null,
          canNextHand: true,
          canAddPlayer: true,
          pot: money("0", "0"),
        }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain("START HAND");
    expect(html).toContain("ADD PLAYER");
    expect(html).not.toContain("AVAILABLE");
    expect(html).not.toContain('data-jeton-tray="true"');
  });

  it("shows tray + Fold/Call for seated dealer when it is their turn", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPokerDealer, {
        view: dealerView(),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain('data-table-board="POKER_DEALER"');
    expect(html).toContain('data-owner-badge="true"');
    expect(html).toContain('data-dealer-badge="true"');
    expect(html).toContain('data-jeton-tray="true"');
    expect(html).toContain("has-visible-tray");
    expect(html).not.toContain("no-visible-tray");
    expect(html).toContain("AVAILABLE");
    expect(html.match(/AVAILABLE/g)?.length).toBe(1);
    expect(html.match(/data-casino-jeton="true"/g)?.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain('aria-label="Add 5 jetons"');
    expect(html).toContain("FOLD");
    expect(html).toContain("CALL 1");
    expect(html).toContain("RAISE 4");
    expect(html).toContain('data-pot-chips="true"');
    expect(html).toContain('data-pot-amount="3"');
    expect(html).not.toContain('data-street-wager="true"');
  });

  it("keeps tray visible but shows waiting hint when another player acts", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPokerDealer, {
        view: dealerView({
          currentActorId: "k",
          currentActorName: "K",
          legalActions: [],
          seats: [
            seat("owner", "xklondon", 0, { isDealer: true, isSmallBlind: true }),
            seat("k", "K", 1, { isActor: true, isBigBlind: true }),
          ],
        }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain('data-jeton-tray="true"');
    expect(html).toContain("has-visible-tray");
    expect(html).toContain("TURN · K");
    expect(html).not.toContain(">FOLD<");
    expect(html).toContain("AVAILABLE");
    expect(html.match(/Add 5 jetons"/g)?.length).toBe(1);
    expect(html).toMatch(/disabled="" aria-label="Add 5 jetons"/);
  });

  it("never hardcodes showTray false (screenshot empty-dock regression)", () => {
    const source = readFileSync(join(__dirname, "PremiumPokerDealer.tsx"), "utf8");
    expect(source).toContain('onCommand("pokerAct"');
    expect(source).toContain("visiblePokerLegalActions");
    expect(source).toContain("pokerTrayChipAct");
    expect(source).toContain("pokerDockTrio");
    expect(source).toContain("PremiumGiveJetonsMask");
    expect(source).toContain("showTray={showTray}");
    expect(source).not.toContain("showTray={false}");
  });

  it("setup dock exposes BUY-IN when giveJetons is allowed", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumPokerDealer, {
        view: dealerView({
          phase: "POKER_SETUP",
          legalActions: [],
          currentActorId: null,
          canGiveJetons: true,
          seats: [
            seat("owner", "xklondon", 0, { status: "WAITING" }),
            seat("k", "K", 1, { status: "WAITING", available: money("100") }),
          ],
        }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain("BUY-IN");
  });
});
