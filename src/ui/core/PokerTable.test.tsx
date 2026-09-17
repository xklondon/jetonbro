import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ClassicPokerDealer } from "@/ui/skins/classic/components/ClassicPokerDealer";
import { ClassicPokerPlayer } from "@/ui/skins/classic/components/ClassicPokerPlayer";
import { ClassicPlayerTable } from "@/ui/skins/classic/components/ClassicPlayerTable";
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
  expect(html).toContain("SB ·");
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
  expect(folded).toContain("Folded");
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
    expect(html.indexOf("YOUR JETONS")).toBeLessThan(html.indexOf("AVAILABLE"));
    expect(html.indexOf("data-player-wallet")).toBeLessThan(html.indexOf("Add 25 jetons"));
  }
  expect(pokerActor).toContain("data-game-controls");
  expect(pokerActor.indexOf("data-game-controls")).toBeLessThan(pokerActor.indexOf("data-player-wallet"));
  expect(bj).toContain("data-game-controls");
  expect(bj.indexOf("data-game-controls")).toBeLessThan(bj.indexOf("data-player-wallet"));
  expect(pokerWaiting).not.toContain("data-actor-controls");
});
