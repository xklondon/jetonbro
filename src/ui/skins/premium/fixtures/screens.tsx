"use client";

import { createElement, useState } from "react";
import type {
  BankTableView,
  BoxView,
  MemberView,
  PlayerTableView,
  PokerTableView,
  WaitingTableView,
} from "@/application/queries/views";
import { PremiumBlackjackDealer } from "../components/PremiumBlackjackDealer";
import { PremiumBlackjackPlayer } from "../components/PremiumBlackjackPlayer";
import { PremiumBlackjackWaiting } from "../components/PremiumBlackjackWaiting";
import { PremiumPokerDealer } from "../components/PremiumPokerDealer";
import { PremiumPokerPlayer } from "../components/PremiumPokerPlayer";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });
const noop: () => undefined = () => undefined;

const members: MemberView[] = [
  { userId: "d1", name: "Dee", email: "d@x.io", isOwner: true, isBankDealer: true, available: money("0") },
  { userId: "p1", name: "Sam", email: "s@x.io", isOwner: false, isBankDealer: false, available: money("100") },
  { userId: "p2", name: "Alex", email: "a@x.io", isOwner: false, isBankDealer: false, available: money("75") },
];

const box = (n: number, overrides: Partial<BoxView> = {}): BoxView => ({
  id: `b${n}`,
  playerId: overrides.playerId ?? "p1",
  playerName: overrides.playerName ?? "Sam",
  label: `BOX ${n}`,
  boxNumber: n,
  bet: money("25"),
  originalStake: money("25"),
  isDoubled: false,
  isSplit: false,
  insurance: null,
  insuranceMax: money("12.5", "12500"),
  insuranceResult: null,
  outcome: null,
  returned: null,
  payoutActions: [
    { outcome: "LOST", label: "LOST" },
    { outcome: "PUSH", label: "TIE" },
    { outcome: "BLACKJACK", label: "BJ" },
    { outcome: "WON", label: "WIN" },
  ],
  ...overrides,
});

const bankActions = (phase: BankTableView["phase"]): BankTableView["actions"] => ({
  dealCards: phase === "BETTING",
  scheduleDeal: phase === "BETTING",
  payoutPhase: phase === "PLAYING",
  nextHand: phase === "TABLE_SETUP" || phase === "PAYOUT" || phase === "ROUND_COMPLETE",
  scheduleNextRound: phase === "PAYOUT",
  openInsurance: phase === "PLAYING",
  closeInsurance: false,
  settleBoxes: phase === "PAYOUT",
  settleDealerWon: phase === "PAYOUT",
  settleInsurance: false,
  addPlayer: true,
  giveJetons: true,
  changeBank: true,
  saveTable: true,
  closeTable: true,
  switchGame: true,
});

function bank(phase: BankTableView["phase"], extra: Partial<BankTableView> = {}): BankTableView {
  const joined = [
    {
      userId: "p1",
      name: "Sam",
      available: money("100"),
      locked: money(phase === "TABLE_SETUP" ? "0" : "25"),
      status: "Waiting",
      boxes: phase === "TABLE_SETUP" ? [] : [box(1), box(2, { id: "b2", playerId: "p2", playerName: "Alex", bet: money("50") })],
    },
  ];
  return {
    role: "BANK",
    phase,
    tableName: "EMERALD SALON",
    title: "",
    copy: "",
    phaseLabel: phase,
    primaryAction:
      phase === "TABLE_SETUP"
        ? { id: "nextHand", label: "START BETTING", enabled: Boolean(extra.players?.length ?? joined.length) }
        : phase === "BETTING"
          ? { id: "dealCards", label: "DEAL CARDS", enabled: true }
          : phase === "PLAYING"
            ? { id: "payoutPhase", label: "ENTER PAYOUT", enabled: true }
            : { id: "nextHand", label: "START BETTING", enabled: true },
    boxes: phase === "TABLE_SETUP" ? [] : [box(1), box(2, { id: "b2", playerId: "p2", playerName: "Alex", bet: money("50") })],
    players: joined,
    playerCount: joined.length,
    boxCount: phase === "TABLE_SETUP" ? 0 : 2,
    lockedOrdinary: money(phase === "TABLE_SETUP" ? "0" : "75"),
    insurance: { window: "CLOSED", total: money("0"), count: 0, resolution: null },
    actions: bankActions(phase),
    insuranceSettleActions: [],
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    hasValidBet: phase !== "TABLE_SETUP",
    isOwner: true,
    tableStatus: phase === "TABLE_SETUP" ? "SETUP" : "ACTIVE",
    paused: false,
    closePreview: null,
    dealerName: "Dee",
    dealerHand:
      phase === "PLAYING" || phase === "PAYOUT"
        ? { ranks: ["K", "7"], complete: phase === "PAYOUT", label: "17", suggestedOutcome: null, canEdit: phase === "PLAYING" }
        : undefined,
    guestJoinUrl: "http://localhost/join/guest/fixture",
    verifiedJoinUrl: "http://localhost/join/verified/fixture",
    canStartBetting: true,
    startingJetons: money("100"),
    ...extra,
  };
}

function player(phase: PlayerTableView["phase"], boxes: BoxView[]): PlayerTableView {
  return {
    role: "PLAYER",
    phase,
    tableName: "EMERALD SALON",
    title: "",
    copy: "",
    available: money(phase === "BETTING" && boxes.some((b) => b.bet.label !== "0") ? "75" : "100"),
    boxes,
    insuranceWindowOpen: false,
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    actions: {
      bet: phase === "BETTING",
      retract: phase === "BETTING",
      addBox: phase === "BETTING",
      removeEmptyBox: false,
      double: phase === "PLAYING",
      split: phase === "PLAYING",
      insurance: false,
    },
    dealerHand:
      phase === "PLAYING" || phase === "PAYOUT"
        ? { ranks: ["A"], complete: false, label: "11", suggestedOutcome: null, canEdit: false }
        : undefined,
  };
}

function pokerSeat(
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

function poker(extra: Partial<PokerTableView> = {}): PokerTableView {
  return {
    role: "POKER_PLAYER",
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "",
    tableName: "WALNUT ROOM",
    copy: "",
    isOwner: false,
    pot: money("60"),
    potPaid: false,
    toCall: money("10"),
    contribution: money("0", "0"),
    available: money("95"),
    smallBlind: money("5"),
    bigBlind: money("10"),
    streetWager: money("10"),
    viewerStatus: "ACTIVE",
    seats: [
      pokerSeat("v", "Vi", 0, { isActor: true, isDealer: true, streetContribution: money("0", "0") }),
      pokerSeat("s", "Sam", 1, { isSmallBlind: true, streetContribution: money("5") }),
      pokerSeat("a", "Alex", 2, { isBigBlind: true, streetContribution: money("10") }),
      pokerSeat("b", "Blair", 3, { streetContribution: money("20") }),
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
    streetRail: [
      { id: "PRE_FLOP", state: "current" },
      { id: "FLOP", state: "next" },
      { id: "TURN", state: "next" },
      { id: "RIVER", state: "next" },
    ],
    ...extra,
  };
}

export const PREMIUM_FIXTURE_IDS = [
  "01-bj-dealer-setup-empty",
  "02-bj-dealer-setup-joined",
  "03-bj-dealer-betting-two-boxes",
  "04-bj-dealer-playing",
  "05-bj-dealer-payout",
  "06-bj-player-betting-one-box",
  "07-bj-player-betting-two-boxes",
  "08-bj-player-playing",
  "09-bj-player-payout",
  "10-poker-heads-up-preflop",
  "11-poker-three-player-flop",
  "12-poker-hand-complete",
  "13-poker-setup-starting-stack",
  "14-bj-player-betting-no-stake",
] as const;

export type PremiumFixtureId = (typeof PREMIUM_FIXTURE_IDS)[number];

function PlayerFixture({ view }: { view: PlayerTableView }) {
  const [selected, setSelected] = useState(view.boxes[0]?.id ?? null);
  return createElement(PremiumBlackjackPlayer, {
    view,
    selectedBoxId: selected,
    onSelectBox: setSelected,
    onCommand: noop,
  });
}

export function renderPremiumFixture(id: PremiumFixtureId) {
  switch (id) {
    case "01-bj-dealer-setup-empty":
      return createElement(PremiumBlackjackDealer, {
        view: bank("TABLE_SETUP", { players: [], playerCount: 0, canStartBetting: false, primaryAction: { id: "nextHand", label: "START BETTING", enabled: false } }),
        members,
        onCommand: noop,
      });
    case "02-bj-dealer-setup-joined":
      return createElement(PremiumBlackjackDealer, {
        view: bank("TABLE_SETUP"),
        members,
        onCommand: noop,
      });
    case "03-bj-dealer-betting-two-boxes":
      return createElement(PremiumBlackjackDealer, {
        view: bank("BETTING"),
        members,
        onCommand: noop,
      });
    case "04-bj-dealer-playing":
      return createElement(PremiumBlackjackDealer, {
        view: bank("PLAYING", {
          boxes: [
            box(1, { hand: { ranks: ["10", "8"], complete: false, label: "18", suggestedOutcome: null, canEdit: true } }),
            box(2, { id: "b2", playerId: "p2", playerName: "Alex", bet: money("50"), hand: { ranks: ["9", "7"], complete: false, label: "16", suggestedOutcome: null, canEdit: true } }),
          ],
        }),
        members,
        onCommand: noop,
      });
    case "05-bj-dealer-payout":
      return createElement(PremiumBlackjackDealer, {
        view: bank("PAYOUT"),
        members,
        onCommand: noop,
      });
    case "14-bj-player-betting-no-stake":
      return createElement(PlayerFixture, {
        view: player("BETTING", [box(1, { bet: money("0"), originalStake: money("0") })]),
      });
    case "06-bj-player-betting-one-box":
      return createElement(PlayerFixture, { view: player("BETTING", [box(1)]) });
    case "07-bj-player-betting-two-boxes":
      return createElement(PlayerFixture, {
        view: player("BETTING", [box(2, { id: "b2", bet: money("0") }), box(1)]),
      });
    case "08-bj-player-playing":
      return createElement(PlayerFixture, {
        view: player("PLAYING", [
          box(1, { hand: { ranks: ["K", "6"], complete: false, label: "16", suggestedOutcome: null, canEdit: true } }),
        ]),
      });
    case "09-bj-player-payout":
      return createElement(PlayerFixture, {
        view: player("PAYOUT", [box(1, { outcome: "WON", returned: money("50") })]),
      });
    case "10-poker-heads-up-preflop":
      return createElement(PremiumPokerPlayer, { view: poker(), onCommand: noop });
    case "11-poker-three-player-flop":
      return createElement(PremiumPokerDealer, {
        view: poker({
          role: "POKER_DEALER",
          phase: "FLOP",
          phaseLabel: "FLOP",
          isOwner: true,
          pot: money("45"),
          seats: [
            pokerSeat("v", "Dee", 0, { isDealer: true }),
            pokerSeat("s", "Sam", 1, { isSmallBlind: true, streetContribution: money("15"), isActor: true }),
            pokerSeat("t", "Tom", 2, { isBigBlind: true, streetContribution: money("15") }),
          ],
          currentActorName: "Sam",
          currentActorId: "s",
          canDealStreet: true,
          nextStreetLabel: "DEAL TURN",
          streetRail: [
            { id: "PRE_FLOP", state: "done" },
            { id: "FLOP", state: "current" },
            { id: "TURN", state: "next" },
            { id: "RIVER", state: "next" },
          ],
          communityCards: [
            { rank: "A", suit: "s", label: "As" },
            { rank: "K", suit: "h", label: "Kh" },
            { rank: "2", suit: "d", label: "2d" },
          ],
          legalActions: [],
          waitingCopy: "TURN · Sam",
        }),
        members,
        onCommand: noop,
      });
    case "12-poker-hand-complete":
      return createElement(PremiumPokerDealer, {
        view: poker({
          role: "POKER_DEALER",
          phase: "HAND_COMPLETE",
          phaseLabel: "HAND COMPLETE",
          isOwner: true,
          pot: money("60"),
          potPaid: true,
          seats: [
            pokerSeat("v", "Dee", 0, { isDealer: true }),
            pokerSeat("s", "Sam", 1, { status: "FOLDED" }),
          ],
          winners: [{ userId: "v", name: "Dee", amount: money("60") }],
          canNextHand: true,
          currentActorName: null,
          currentActorId: null,
          waitingCopy: null,
          legalActions: [],
          streetRail: [
            { id: "PRE_FLOP", state: "done" },
            { id: "FLOP", state: "done" },
            { id: "TURN", state: "done" },
            { id: "RIVER", state: "done" },
            { id: "SHOWDOWN", state: "done" },
          ],
        }),
        members,
        onCommand: noop,
      });
    case "13-poker-setup-starting-stack":
      return createElement(PremiumPokerPlayer, {
        view: poker({
          phase: "POKER_SETUP",
          phaseLabel: "TABLE SETUP",
          pot: money("0", "0"),
          toCall: money("0", "0"),
          available: money("100"),
          seats: [
            pokerSeat("v", "Vi", 0, { available: money("100") }),
            pokerSeat("s", "Sam", 1, { available: money("100") }),
          ],
          legalActions: [],
          currentActorName: null,
          currentActorId: null,
          waitingCopy: "Waiting for Players",
          canNextHand: false,
          streetRail: [
            { id: "PRE_FLOP", state: "next" },
            { id: "FLOP", state: "next" },
          ],
        }),
        onCommand: noop,
      });
    default:
      return null;
  }
}

/** Waiting fixture available for contact sheet extras */
export function waitingFixture(): WaitingTableView {
  return {
    role: "WAITING",
    phase: "TABLE_SETUP",
    tableName: "EMERALD SALON",
    game: "Blackjack",
    gameId: "BLACKJACK",
    available: money("100"),
    copy: "",
    bankName: "Dee",
  };
}

export function PremiumWaitingFixture() {
  return createElement(PremiumBlackjackWaiting, { view: waitingFixture() });
}
