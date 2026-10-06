import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PokerTableView } from "@/application/queries/views";
import { addChipToAmount } from "@/ui/core/poker-chip-action";
import { selectTableBoard } from "@/ui/core/table-board";
import { pokerPhaseCopy, pokerStartHandNotice } from "@/ui/core/phase-copy";
import { tabletopSkin } from "./index";
import { pokerSeatPosition, pokerWagerPosition } from "./components/primitives/PokerSeat";
import { ownerChrome } from "./components/owner-chrome";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });
const noop = () => undefined;

function seat(
  userId: string,
  name: string,
  orderIndex: number,
  extra: Partial<PokerTableView["seats"][number]> = {},
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
    ...extra,
  };
}

function poker(extra: Partial<PokerTableView> = {}): PokerTableView {
  return {
    role: "POKER_PLAYER",
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "Texas Hold’em · PRE-FLOP",
    tableName: "Felt",
    copy: "YOUR TURN",
    isOwner: false,
    pot: money("15"),
    potPaid: false,
    toCall: money("10"),
    contribution: money("0", "0"),
    available: money("100"),
    smallBlind: money("5"),
    bigBlind: money("10"),
    streetWager: money("10"),
    viewerStatus: "ACTIVE",
    seats: [
      seat("owner", "Owner", 0, { isDealer: true, isActor: true, streetContribution: money("10") }),
      seat("sam", "Sam", 1, { isSmallBlind: true, streetContribution: money("5") }),
    ],
    pots: [],
    legalActions: [
      { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
      { type: "CALL", amount: money("10"), label: "CALL 10" },
      { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE" },
    ],
    currentActorName: "Owner",
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
    canAddPlayer: false,
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
    streetRail: [
      { id: "PRE_FLOP", state: "current" },
      { id: "FLOP", state: "next" },
      { id: "TURN", state: "next" },
      { id: "RIVER", state: "next" },
      { id: "SHOWDOWN", state: "next" },
    ],
    ...extra,
  };
}

describe("Poker oval surface (Dealer = Player anatomy)", () => {
  it("routes Poker Phase 0 to shared Poker boards, not BJ PhaseZero ledger", () => {
    expect(
      selectTableBoard({
        isOwner: true,
        game: "POKER",
        phase: "TABLE_SETUP",
        poker: { phase: "POKER_SETUP" },
        setup: { setupCompleted: true },
      }),
    ).toBe("POKER_DEALER");
    expect(
      selectTableBoard({
        isOwner: false,
        isSeatedPlayer: true,
        game: "POKER",
        phase: "TABLE_SETUP",
        poker: { phase: "POKER_SETUP" },
        setup: { setupCompleted: true },
      }),
    ).toBe("POKER_PLAYER");
  });

  it("Dealer and Player Phase 0 share oval rail, felt name, no centre divider or STREET labels", () => {
    const setupView = poker({
      role: "POKER_DEALER",
      isOwner: true,
      phase: "POKER_SETUP",
      phaseLabel: "POKER_SETUP",
      legalActions: [],
      waitingCopy: null,
      currentActorId: null,
      seats: [],
      streetRail: [],
      canAddPlayer: true,
      toCall: money("0", "0"),
      pot: money("0", "0"),
    });
    const dealer = renderToStaticMarkup(
      createElement(tabletopSkin.PokerDealer, { view: setupView, members: [], onCommand: noop }),
    );
    const player = renderToStaticMarkup(
      createElement(tabletopSkin.PokerPlayer, {
        view: { ...setupView, role: "POKER_PLAYER", isOwner: false, canAddPlayer: false },
        onCommand: noop,
      }),
    );
    for (const html of [dealer, player]) {
      expect(html).toContain('data-poker-rail="oval"');
      expect(html).toContain('data-centre-divider="absent"');
      expect(html).toContain("TABLE SETUP");
      expect(html).toContain("Waiting for Players");
      expect(html).not.toContain("POKER SETUP");
      expect(html).not.toMatch(/STREET\s+\d/i);
      expect(html).not.toContain("tt-setup-ledger");
      expect(html.match(/Felt/g)?.length ?? 0).toBeLessThanOrEqual(2);
    }
    expect(dealer).toContain("START HAND");
    expect(dealer).toContain("ADD PLAYER");
    expect(player).not.toContain("START HAND");
    expect(player).not.toContain("ADD PLAYER");
  });

  it("START HAND seat notice is compact once near the dock", () => {
    const html = renderToStaticMarkup(
      createElement(tabletopSkin.PokerDealer, {
        view: poker({
          role: "POKER_DEALER",
          isOwner: true,
          phase: "POKER_SETUP",
          legalActions: [],
          seats: [seat("owner", "Owner", 0)],
          streetRail: [],
          canAddPlayer: true,
        }),
        members: [],
        onCommand: noop,
        notice: "Texas Hold’em needs at least two Players.",
      }),
    );
    expect(html).toContain('data-poker-seat-hint="true"');
    expect(html).toContain("Add at least two Players to start a Poker hand.");
    expect(html).not.toContain('class="tt-error"');
    expect(html.match(/Add at least two Players/g)?.length).toBe(1);
  });

  it("Create Table suppresses premature player-count error", () => {
    const html = renderToStaticMarkup(
      createElement(tabletopSkin.CreateTable, {
        defaultTableName: "Draft",
        onBack: noop,
        onCreate: async () => undefined,
        notice: "Texas Hold’em needs at least two Players.",
      }),
    );
    expect(html).toContain("START TABLE");
    expect(html).not.toContain("needs at least two");
    expect(html).not.toContain("Add at least two Players");
    expect(html).not.toContain('class="tt-error"');
  });

  it("live seats show inward wager chips, never STREET N text", () => {
    const html = renderToStaticMarkup(createElement(tabletopSkin.PokerPlayer, { view: poker(), onCommand: noop }));
    expect(html).toContain('data-street-commit="true"');
    expect(html).toContain('data-wager-for="owner"');
    expect(html).not.toMatch(/STREET\s+\d/i);
    expect(html).toContain("TO CALL");
    expect(html).not.toContain("TO CALL 0");
    expect(html).not.toContain("CALL 0");
  });

  it("Owner switch badge targets the opposite game only when change is legal", () => {
    const on = ownerChrome(true, true, "POKER", { changeDealer: true, changeGame: true }, noop, noop);
    expect(on.find((b) => b.id === "game-switch")?.label).toBe("BLACKJACK");
    const off = ownerChrome(true, true, "POKER", { changeDealer: true, changeGame: false }, noop, noop);
    expect(off.find((b) => b.id === "game-switch")).toBeUndefined();
    const dealerNotOwner = ownerChrome(false, true, "POKER", { changeDealer: false, changeGame: true }, noop, noop);
    expect(dealerNotOwner.find((b) => b.id === "game-switch")).toBeUndefined();
  });

  it("seat layout responds to player count with viewer near bottom", () => {
    const two = [pokerSeatPosition(0, 2, 0), pokerSeatPosition(1, 2, 0)];
    expect(two[0]!.top).toContain("84");
    expect(two[1]!.top).toContain("12");
    const four = [0, 1, 2, 3].map((i) => pokerSeatPosition(i, 4, 0));
    expect(four.map((p) => p.left).join("|")).not.toEqual(two.map((p) => p.left).join("|"));
    const wager = pokerWagerPosition(0, 2, 0);
    expect(Number.parseFloat(String(wager.top))).toBeLessThan(Number.parseFloat(String(two[0]!.top)));
  });

  it("phase copy never duplicates primary street as a second heading", () => {
    const copy = pokerPhaseCopy({ phase: "PRE_FLOP", isActor: true });
    expect(JSON.stringify(copy).match(/PRE-FLOP/g)?.length).toBe(1);
    expect(pokerStartHandNotice("POKER_SEATS")).toMatch(/Add at least two/);
  });

  it("tap and drag staging share addChipToAmount; tray uses Pointer Events", () => {
    expect(addChipToAmount("0", "5")).toBe("5");
    expect(addChipToAmount(addChipToAmount("0", "5"), "10")).toBe("15");
    const tray = readFileSync(join(process.cwd(), "src/ui/skins/tabletop/components/primitives/JetonTray.tsx"), "utf8");
    expect(tray).toContain("onPointerDown");
    expect(tray).toContain("setPointerCapture");
    expect(tray).toContain("lockScroll");
    expect(tray).not.toContain("ondragstart=");
    expect(tray).toContain('data-jeton-dragging="true"');
  });
});
