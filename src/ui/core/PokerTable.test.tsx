import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ClassicPokerDealer } from "@/ui/skins/classic/components/ClassicPokerDealer";
import { ClassicPokerPlayer } from "@/ui/skins/classic/components/ClassicPokerPlayer";
import type { PokerLegalActionView, PokerTableView } from "@/application/queries/views";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

const legal: PokerLegalActionView[] = [
  { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
  { type: "CALL", amount: money("10"), label: "CALL 10" },
  { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE TO" },
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
  expect(html).toContain("RAISE TO");
  expect(html).toContain("ALL IN");
  expect(html).toContain("data-drop-pot");
  expect(html).toContain("SB ·");
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
  expect(waiting).toContain("Add 25 jetons");
  expect(waiting).not.toContain(">FOLD<");
  expect(waiting).not.toContain("CALL 10");
});
