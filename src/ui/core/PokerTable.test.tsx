import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ClassicPokerDealer } from "@/ui/skins/classic/components/ClassicPokerDealer";
import { ClassicPokerPlayer } from "@/ui/skins/classic/components/ClassicPokerPlayer";
import { ClassicPlayerTable } from "@/ui/skins/classic/components/ClassicPlayerTable";
import { PokerFelt } from "@/ui/skins/classic/components/PokerFelt";
import type { PlayerTableView, PokerLegalActionView, PokerTableView } from "@/application/queries/views";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

const legal: PokerLegalActionView[] = [
  { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
  { type: "CALL", amount: money("10"), label: "CALL 10" },
  { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE" },
  { type: "ALL_IN", amount: money("100"), label: "ALL IN" },
];

function pokerView(overrides: Partial<PokerTableView> = {}): PokerTableView {
  return {
    role: "POKER_PLAYER",
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "Texas Hold’em · PRE-FLOP",
    tableName: "Hold em table",
    copy: "YOUR TURN",
    isOwner: false,
    pot: money("15"),
    toCall: money("10"),
    contribution: money("0", "0"),
    available: money("100"),
    smallBlind: money("5"),
    bigBlind: money("10"),
    streetWager: money("10"),
    viewerStatus: "ACTIVE",
    seats: [
      {
        userId: "owner",
        name: "Owner",
        available: money("100"),
        contribution: money("0", "0"),
        streetContribution: money("0", "0"),
        toCall: money("10"),
        status: "ACTIVE",
        isDealer: true,
        isSmallBlind: false,
        isBigBlind: false,
        isActor: true,
        sittingOut: false,
        orderIndex: 0,
        hasHoleCards: false,
        holeCards: null,
      },
      {
        userId: "sam",
        name: "Sam",
        available: money("95"),
        contribution: money("5"),
        streetContribution: money("5"),
        toCall: money("5"),
        status: "ACTIVE",
        isDealer: false,
        isSmallBlind: true,
        isBigBlind: false,
        isActor: false,
        sittingOut: false,
        orderIndex: 1,
        hasHoleCards: false,
        holeCards: null,
      },
    ],
    pots: [],
    legalActions: legal,
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
    canSwitchGame: false,
    switchBlockedReason: null,
    canAddPlayer: false,
    canGiveJetons: false,
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
      { id: "DEAL", state: "done" },
      { id: "PRE-FLOP", state: "current" },
      { id: "FLOP", state: "next" },
      { id: "TURN", state: "next" },
      { id: "RIVER", state: "next" },
      { id: "SHOWDOWN", state: "next" },
    ],
    ...overrides,
  };
}

test("Poker dealer is a seated player with the Blackjack jeton tray and disabled DEAL FLOP until the street is matched", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicPokerDealer, {
      view: pokerView({
        role: "POKER_DEALER",
        isOwner: true,
        canAddPlayer: true,
        canGiveJetons: false,
      }),
      members: [],
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("YOUR TURN");
  expect(html).toContain("data-turn-state");
  expect(html).toContain("Add 25 jetons");
  expect(html).toContain("FOLD");
  expect(html).toContain("CALL 10");
  expect(html).toContain("RAISE");
  expect(html).not.toContain("RAISE TO");
  expect(html).not.toContain("CONFIRM RAISE");
  expect(html).toContain("ALL IN");
  expect(html).toContain("data-drop-pot");
  expect(html).toContain("SB");
  expect(html).toContain("TO CALL 10");
  expect(html).not.toContain("SB 5");
  expect(html).not.toContain("CURRENT BET");
  expect(html).not.toContain("TO CALL 0");
  expect(html).not.toContain("Move up");
  expect(html).toContain("dealer-badge");
  expect(html).toContain("is-dealer");
  expect(html).toContain("Waiting for bets to match");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>DEAL FLOP/);
});

test("the next actor sees legal actions and the waiting player does not", () => {
  const actor = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: pokerView({
        viewerId: "sam",
        currentActorId: "sam",
        waitingCopy: "YOUR TURN",
        contribution: money("5"),
        legalActions: legal,
        seats: pokerView().seats.map((seat) => ({ ...seat, isActor: seat.userId === "sam" })),
      }),
      onCommand: () => undefined,
    }),
  );
  expect(actor).toContain("YOUR TURN");
  expect(actor).toContain("FOLD");
  expect(actor).toContain("CALL 10");
  expect(actor).toContain("Add 25 jetons");
  expect(actor).not.toContain("DEAL FLOP");

  const waiting = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: pokerView({
        viewerId: "sam",
        currentActorId: "owner",
        waitingCopy: "Waiting for Owner",
        legalActions: [],
      }),
      onCommand: () => undefined,
    }),
  );
  expect(waiting).toContain("Waiting for Owner");
  expect(waiting).toContain("YOUR JETONS");
  expect(waiting).toContain("AVAILABLE");
  expect(waiting).toContain("data-player-wallet");
  expect(waiting).toContain("Add 25 jetons");
  expect(waiting).not.toContain("data-actor-controls");
  expect(waiting).not.toMatch(/>CALL 10</);
  expect(waiting).not.toContain("data-owner-controls");
});

test("folded and all-in players keep the wallet but no actor controls", () => {
  const folded = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: pokerView({
        viewerId: "sam",
        viewerStatus: "FOLDED",
        legalActions: [],
        waitingCopy: "Waiting for Owner",
        seats: pokerView().seats.map((seat) =>
          seat.userId === "sam" ? { ...seat, status: "FOLDED", isActor: false } : seat,
        ),
      }),
      onCommand: () => undefined,
    }),
  );
  expect(folded).toContain("data-player-wallet");
  expect(folded).toContain("FOLDED");
  expect(folded).not.toContain("data-actor-controls");
  expect(folded).toMatch(/<button[^>]*disabled[^>]*aria-label="Add 5 jetons"/);

  const allIn = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: pokerView({
        viewerId: "sam",
        viewerStatus: "ALL_IN",
        legalActions: [],
        waitingCopy: "Waiting for Owner",
        seats: pokerView().seats.map((seat) =>
          seat.userId === "sam" ? { ...seat, status: "ALL_IN", isActor: false } : seat,
        ),
      }),
      onCommand: () => undefined,
    }),
  );
  expect(allIn).toContain("ALL IN");
  expect(allIn).not.toContain("data-actor-controls");
});

test("Blackjack and Poker player wallets share the same tray structure", () => {
  const pokerWaiting = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: pokerView({ legalActions: [] }),
      onCommand: () => undefined,
    }),
  );
  const pokerActor = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: pokerView({
        viewerId: "owner",
        currentActorId: "owner",
        waitingCopy: "YOUR TURN",
        legalActions: legal,
      }),
      onCommand: () => undefined,
    }),
  );
  const blackjack: PlayerTableView = {
    role: "PLAYER",
    phase: "BETTING",
    tableName: "Salon",
    title: "Place your bets",
    copy: "Select a box",
    available: { millis: "75000", label: "75" },
    insuranceWindowOpen: false,
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    actions: {
      bet: true,
      retract: true,
      addBox: true,
      removeEmptyBox: false,
      double: false,
      split: false,
      insurance: false,
    },
    boxes: [
      {
        id: "1",
        playerId: "p1",
        playerName: "Alex",
        label: "YOUR BOX 1",
        boxNumber: 1,
        bet: { millis: "0", label: "0" },
        originalStake: { millis: "0", label: "0" },
        isDoubled: false,
        isSplit: false,
        insurance: null,
        insuranceMax: { millis: "0", label: "0" },
        insuranceResult: null,
        outcome: null,
        returned: null,
        payoutActions: [],
        hand: { ranks: [], complete: false, label: "", suggestedOutcome: null, canEdit: false },
      },
    ],
  };
  const bj = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: blackjack,
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  for (const html of [pokerWaiting, pokerActor, bj]) {
    expect(html).toContain("data-player-wallet");
    expect(html).toContain("Add 25 jetons");
    expect(html).toContain("YOUR JETONS");
    expect(html).toContain("AVAILABLE");
    expect(html).not.toContain("AVAILABLE VALUE");
    const wallet = html.slice(html.indexOf("data-player-wallet"));
    expect(wallet.indexOf("YOUR JETONS")).toBeLessThan(wallet.indexOf("AVAILABLE"));
    expect(html.indexOf("data-player-wallet")).toBeLessThan(html.indexOf("Add 25 jetons"));
  }
  expect(pokerActor).toContain("data-game-controls");
  expect(pokerActor.indexOf("data-game-controls")).toBeLessThan(pokerActor.indexOf("data-player-wallet"));
  expect(bj).toContain("data-game-controls");
  expect(bj.indexOf("data-game-controls")).toBeLessThan(bj.indexOf("data-player-wallet"));
  expect(pokerWaiting).not.toContain("data-actor-controls");
});

test("POKER SETUP shows DEAL CARDS only on the owner dock and keeps seat order off the felt", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicPokerDealer, {
      view: pokerView({
        role: "POKER_DEALER",
        phase: "POKER_SETUP",
        phaseLabel: "POKER SETUP",
        headline: "Texas Hold’em · POKER SETUP",
        isOwner: true,
        legalActions: [],
        currentActorId: null,
        waitingCopy: null,
        nextStreetLabel: null,
        canReorderSeats: true,
        canAddPlayer: true,
        canGiveJetons: true,
        canSwitchGame: true,
        pot: money("0", "0"),
        toCall: money("0", "0"),
        seats: pokerView().seats.map((seat) => ({
          ...seat,
          isActor: false,
          isDealer: false,
          isSmallBlind: false,
          isBigBlind: false,
          status: "WAITING",
          streetContribution: money("0", "0"),
        })),
      }),
      members: [],
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("DEAL CARDS");
  expect(html).not.toContain("START TEXAS HOLD");
  expect(html).not.toContain("Move up");
  expect(html).not.toContain("Move down");
  expect(html).not.toContain("+ PLAYER");
  expect(html).not.toContain("GIVE JETONS");
  expect(html).not.toContain("TO CALL");
});

test("owner and player share the same felt projection", () => {
  const seats = pokerView().seats;
  const ownerFelt = renderToStaticMarkup(
    createElement(PokerFelt, {
      view: pokerView({
        role: "POKER_DEALER",
        isOwner: true,
        canDealStreet: true,
        nextStreetLabel: "DEAL FLOP",
        canAddPlayer: true,
        legalActions: [],
        seats,
      }),
    }),
  );
  const playerFelt = renderToStaticMarkup(
    createElement(PokerFelt, {
      view: pokerView({
        role: "POKER_PLAYER",
        isOwner: false,
        canDealStreet: false,
        nextStreetLabel: null,
        legalActions: [],
        seats,
      }),
    }),
  );
  expect(ownerFelt).toBe(playerFelt);
  expect(ownerFelt).toContain("YOUR TURN");
  expect(ownerFelt).toContain("Waiting");
  expect(ownerFelt).toContain("STREET");
  expect(ownerFelt).toContain("AVAILABLE");
  expect(ownerFelt).not.toContain("Main pot");
  expect(ownerFelt).not.toContain("xklondon");
  expect(ownerFelt).not.toContain("data-rail=\"DEAL\"");
  expect(ownerFelt).toContain('data-table-name="Hold em table"');
  expect(ownerFelt).not.toContain("poker-rail");
  expect(ownerFelt).toContain('data-card-editor="closed"');
  expect(ownerFelt).not.toContain("data-card-sheet");
});

test("owner and player share the same street rail with the current stop highlighted", () => {
  const view = pokerView({
    phase: "RIVER",
    phaseLabel: "RIVER",
    streetRail: [
      { id: "DEAL", state: "done" },
      { id: "PRE-FLOP", state: "done" },
      { id: "FLOP", state: "done" },
      { id: "TURN", state: "done" },
      { id: "RIVER", state: "current" },
      { id: "SHOWDOWN", state: "next" },
    ],
  });
  const owner = renderToStaticMarkup(
    createElement(ClassicPokerDealer, {
      view: { ...view, role: "POKER_DEALER", isOwner: true, legalActions: [] },
      members: [],
      onCommand: () => undefined,
    }),
  );
  const player = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: { ...view, role: "POKER_PLAYER", isOwner: false, legalActions: [] },
      onCommand: () => undefined,
    }),
  );
  expect(owner).toContain('data-rail="RIVER" data-rail-state="current"');
  expect(player).toContain('data-rail="RIVER" data-rail-state="current"');
  expect(owner).toContain('data-rail="SHOWDOWN" data-rail-state="next"');
  expect(player).toContain("poker-street-rail");
  expect(owner).toContain("class=\"dock");
  expect(owner).not.toContain('data-rail="DEAL"');
  expect(owner).toContain('data-table-name="Hold em table"');
  expect(owner.match(/data-table-name="/g)?.length).toBe(1);
  expect(player.match(/data-table-name="/g)?.length).toBe(1);
});

test("community cards are public while hole values stay on the owning seat only", () => {
  const seats = pokerView().seats.map((seat) =>
    seat.userId === "sam"
      ? {
          ...seat,
          hasHoleCards: true,
          holeCards: null,
        }
      : {
          ...seat,
          hasHoleCards: true,
          holeCards: [
            { rank: "A", suit: "S", label: "A♠" },
            { rank: "K", suit: "H", label: "K♥" },
          ],
        },
  );
  const html = renderToStaticMarkup(
    createElement(PokerFelt, {
      view: pokerView({
        communityCards: [
          { rank: "Q", suit: "D", label: "Q♦" },
          { rank: "J", suit: "C", label: "J♣" },
          { rank: "10", suit: "S", label: "10♠" },
        ],
        seats,
        viewerId: "owner",
      }),
    }),
  );
  expect(html).toContain("data-community-cards");
  expect(html).toContain("data-card=\"QD\"");
  expect(html).toContain("data-hole-cards=\"own\"");
  expect(html).toContain("data-card=\"AS\"");
  expect(html).toContain("HOLE CARDS IN");
  expect(html).not.toMatch(/data-player-id="sam"[\s\S]*data-card="AS"/);
  expect(html).not.toContain("+ HOLE CARDS");
  expect(html).not.toContain("data-card-sheet");
});

test("Blackjack optional ranks render as larger cards inside the betting box", () => {
  const blackjack: PlayerTableView = {
    role: "PLAYER",
    phase: "PLAYING",
    tableName: "Salon",
    title: "Play your hands",
    copy: "Select a box",
    available: { millis: "75000", label: "75" },
    insuranceWindowOpen: false,
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    actions: {
      bet: false,
      retract: false,
      addBox: false,
      removeEmptyBox: false,
      double: true,
      split: true,
      insurance: false,
    },
    boxes: [
      {
        id: "1",
        playerId: "p1",
        playerName: "Alex",
        label: "YOUR BOX 1",
        boxNumber: 1,
        bet: { millis: "25000", label: "25" },
        originalStake: { millis: "25000", label: "25" },
        isDoubled: false,
        isSplit: false,
        insurance: null,
        insuranceMax: { millis: "12500", label: "12.5" },
        insuranceResult: null,
        outcome: null,
        returned: null,
        payoutActions: [],
        hand: { ranks: ["A", "K"], complete: false, label: "21", suggestedOutcome: null, canEdit: true },
      },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: blackjack,
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  const box = html.slice(html.indexOf("class=\"box"), html.indexOf("data-game-controls"));
  expect(box).toContain("data-box-cards");
  expect(box).toContain("data-card=\"A\"");
  expect(box).toContain("playing-card is-box");
  expect(html).toContain("class=\"dock");
  expect(html.indexOf("data-box-cards")).toBeLessThan(html.indexOf("data-game-controls"));
  expect(html.indexOf("data-box-cards")).toBeLessThan(html.indexOf("card-assist"));
});

test("poker setup prints the live table name on the cloth and hides D/SB/BB before Deal Cards", () => {
  const html = renderToStaticMarkup(
    createElement(PokerFelt, {
      view: pokerView({
        phase: "POKER_SETUP",
        phaseLabel: "POKER SETUP",
        pot: money("0", "0"),
        toCall: money("0", "0"),
        legalActions: [],
        currentActorId: null,
        waitingCopy: null,
        seats: pokerView().seats.map((seat) => ({
          ...seat,
          isActor: false,
          isDealer: false,
          isSmallBlind: false,
          isBigBlind: false,
          status: "WAITING",
        })),
      }),
    }),
  );
  expect(html).not.toContain("xklondon");
  expect(html).not.toContain("dealer-badge");
  expect(html).not.toContain("blind-badge");
  expect(html).not.toContain("data-community-cards");
  expect(html).toContain("Waiting");
  expect(html).toContain('data-table-name="Hold em table"');
});

test("Poker card assistance stays collapsed until opened and keeps hole ranks private", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: pokerView({
        canEditHole: true,
        canEditCommunity: false,
        viewerId: "owner",
        seats: pokerView().seats.map((seat) =>
          seat.userId === "owner"
            ? { ...seat, hasHoleCards: false, holeCards: null }
            : { ...seat, hasHoleCards: true, holeCards: null },
        ),
      }),
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("+ HOLE CARDS");
  expect(html).not.toContain("+ BOARD CARDS");
  expect(html).toContain('data-card-editor="closed"');
  expect(html).not.toContain("data-card-sheet");
  expect(html).toContain("HOLE CARDS IN");
  expect(html).not.toContain("Community cards");
  expect(html.match(/data-table-name="/g)?.length).toBe(1);
});

test("CALL matches the owed amount and never renders CALL 0", () => {
  const matched = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: pokerView({
        available: money("100"),
        toCall: money("10"),
        legalActions: legal,
      }),
      onCommand: () => undefined,
    }),
  );
  expect(matched).toContain("TO CALL 10");
  expect(matched).toContain("CALL 10");
  expect(matched).not.toContain("CALL 0");

  const empty = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: pokerView({
        available: money("0", "0"),
        toCall: money("10"),
        viewerStatus: "ACTIVE",
        legalActions: [
          { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
          { type: "CALL", amount: money("0", "0"), label: "CALL 0" },
          { type: "BET", amount: money("0", "0"), label: "BET" },
          { type: "RAISE", amount: money("0", "0"), label: "RAISE" },
        ],
      }),
      onCommand: () => undefined,
    }),
  );
  expect(empty).toContain("TO CALL 10");
  expect(empty).toContain("FOLD");
  expect(empty).not.toContain("CALL 0");
  expect(empty).not.toContain(">CALL 10<");
  expect(empty).not.toContain(">BET<");
  expect(empty).not.toContain(">RAISE<");
});


