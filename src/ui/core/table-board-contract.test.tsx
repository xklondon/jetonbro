import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { selectTableBoard } from "./table-board";
import { ClassicBankTable } from "@/ui/skins/classic/components/ClassicBankTable";
import { ClassicPlayerTable } from "@/ui/skins/classic/components/ClassicPlayerTable";
import { ClassicPhaseZero } from "@/ui/skins/classic/components/ClassicPhaseZero";
import { ClassicWaitingTable } from "@/ui/skins/classic/components/ClassicWaitingTable";
import { ClassicPokerDealer } from "@/ui/skins/classic/components/ClassicPokerDealer";
import { ClassicPokerPlayer } from "@/ui/skins/classic/components/ClassicPokerPlayer";
import { ClassicInviteMask } from "@/ui/skins/classic/components/ClassicInvitePanel";
import type { BankTableView, BoxView, MemberView, PlayerTableView, PokerTableView, SetupTableView } from "@/application/queries/views";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

const box = (overrides: Partial<BoxView> = {}): BoxView => ({
  id: "1",
  playerId: "p1",
  playerName: "Casey",
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
  payoutActions: [
    { outcome: "LOST", label: "LOST", title: "LOST", returnLine: "0", swipeLabel: "LOSS" },
    { outcome: "PUSH", label: "STAND OFF", title: "STAND OFF", returnLine: "25", swipeLabel: "PUSH" },
    { outcome: "BLACKJACK", label: "BLACKJACK", title: "BLACKJACK", returnLine: "62.5", swipeLabel: "BJ" },
    { outcome: "WON", label: "WON", title: "WON", returnLine: "50", swipeLabel: "WIN" },
  ],
  ...overrides,
});

const members: MemberView[] = [
  {
    userId: "owner",
    name: "Alex",
    email: "alex@example.com",
    isOwner: true,
    isBankDealer: true,
    available: { millis: "0", label: "0" },
  },
  {
    userId: "p1",
    name: "Casey",
    email: "",
    isOwner: false,
    isBankDealer: false,
    available: { millis: "100000", label: "100" },
  },
];

const setup: SetupTableView = {
  role: "SETUP",
  phase: "TABLE_SETUP",
  tableName: "Salon",
  game: "Blackjack",
  gameOptions: [],
  ownerName: "Alex",
  bankName: "Alex",
  startingJetonsPerPlayer: money("100"),
  seats: [],
  members,
  invitations: [],
  joinUrl: "http://127.0.0.1:3000/join/verified/t",
  guestJoinUrl: "http://127.0.0.1:3000/join/guest/g",
  verifiedJoinUrl: "http://127.0.0.1:3000/join/verified/t",
  minBet: null,
  maxBet: null,
  blackjackPayout: "THREE_TWO",
  maxBoxesPerPlayer: 3,
  insuranceEnabled: true,
  bankMayDistributeJetons: true,
  canStartBetting: true,
  startBlockedReason: null,
  isOwner: true,
  setupCompleted: true,
  tableStatus: "SETUP",
  paused: false,
  closePreview: null,
};

function playerView(phase: PlayerTableView["phase"], extra: Partial<PlayerTableView> = {}): PlayerTableView {
  return {
    role: "PLAYER",
    phase,
    tableName: "Salon",
    title: phase,
    copy: "",
    available: money("75"),
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
      insurance: Boolean(extra.insuranceWindowOpen),
    },
    boxes: [box({ label: "YOUR BOX 1" })],
    ...extra,
  };
}

function bank(phase: BankTableView["phase"], extra: Partial<BankTableView> = {}): BankTableView {
  return {
    role: "BANK",
    phase,
    tableName: "Salon",
    title: phase,
    copy: "",
    phaseLabel: phase,
    primaryAction:
      phase === "BETTING"
        ? { id: "dealCards", label: "DEAL CARDS", enabled: true }
        : phase === "PLAYING"
          ? { id: "payoutPhase", label: "ENTER PAYOUT", enabled: true }
          : { id: "nextHand", label: "START BETTING", enabled: false },
    boxes: [box({ label: "1" })],
    playerCount: 1,
    boxCount: 1,
    lockedOrdinary: money("25"),
    insurance: { window: "CLOSED", total: money("0", "0"), count: 0, resolution: null },
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    hasValidBet: true,
    players: [
      {
        userId: "p1",
        name: "Casey",
        available: money("75"),
        locked: money("25"),
        status: "In play",
        boxes: [box({ label: "1" })],
      },
    ],
    isOwner: true,
    tableStatus: "ACTIVE",
    paused: false,
    closePreview: null,
    dealerName: "Alex",
    bankroll: {
      mode: "OPEN",
      available: money("0", "0"),
      reserved: money("0", "0"),
      total: money("0", "0"),
      canToggle: true,
      lockedReason: null,
      canCoverMore: true,
    },
    actions: {
      dealCards: phase === "BETTING",
      scheduleDeal: phase === "BETTING",
      payoutPhase: phase === "PLAYING",
      nextHand: phase === "PAYOUT",
      scheduleNextRound: false,
      openInsurance: phase === "PLAYING",
      closeInsurance: false,
      settleBoxes: phase === "PAYOUT",
      settleDealerWon: phase === "PAYOUT",
      settleInsurance: phase === "PAYOUT",
      addPlayer: false,
      giveJetons: phase === "BETTING",
      changeBank: false,
      saveTable: true,
      closeTable: false,
      switchGame: false,
    },
    insuranceSettleActions: [
      { id: "DEALER_BLACKJACK", label: "INSURANCE WON" },
      { id: "NO_DEALER_BLACKJACK", label: "INSURANCE LOST" },
    ],
    ...extra,
  };
}

test("Owner/Dealer Phase 0 is the Dealer board, never the Player tray", () => {
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: true,
      isSeatedPlayer: false,
      game: "BLACKJACK",
      phase: "TABLE_SETUP",
      setup: { setupCompleted: true },
    }),
  ).toBe("PHASE_ZERO_DEALER");
  const html = renderToStaticMarkup(
    createElement(ClassicPhaseZero, {
      setup,
      waiting: null,
      poker: null,
      members,
      onCommand: () => undefined,
      isOwner: true,
      isBank: true,
      viewerId: "owner",
      game: "BLACKJACK",
    }),
  );
  expect(html).toContain('data-table-board="PHASE_ZERO_DEALER"');
  expect(html).toContain("START BETTING");
  expect(html).toContain("ADD PLAYER");
  expect(html).not.toContain("YOUR JETONS");
  expect(html).not.toContain("PLACE BET");
});

test("Guest Player Phase 0 is the Player waiting board", () => {
  expect(
    selectTableBoard({
      isOwner: false,
      isDealer: false,
      isSeatedPlayer: true,
      game: "BLACKJACK",
      phase: "TABLE_SETUP",
    }),
  ).toBe("PHASE_ZERO_PLAYER");
  const html = renderToStaticMarkup(
    createElement(ClassicWaitingTable, {
      view: {
        role: "WAITING",
        phase: "TABLE_SETUP",
        tableName: "Salon",
        game: "Blackjack",
        available: money("100"),
        copy: "Waiting for the table to open betting.",
        ownerName: "Alex",
        bankName: "Alex",
      },
    }),
  );
  expect(html).toContain('data-table-board="PHASE_ZERO_PLAYER"');
  expect(html).toContain("YOUR JETONS");
  expect(html).toContain("Waiting for the table to open betting.");
  expect(html).not.toContain("WAITING FOR PLAYERS");
  expect(html).not.toContain("START BETTING");
  expect(html).not.toContain("ADD PLAYER");
  expect(html).not.toContain("DEAL CARDS");
});

test("Blackjack Dealer and Player boards keep exclusive controls by phase", () => {
  const bettingDealer = renderToStaticMarkup(
    createElement(ClassicBankTable, { view: bank("BETTING"), members, onCommand: () => undefined }),
  );
  expect(bettingDealer).toContain('data-table-board="BLACKJACK_DEALER"');
  expect(bettingDealer).toContain("DEAL CARDS");
  expect(bettingDealer).toContain("ADD PLAYER");
  expect(bettingDealer).not.toContain("START BETTING");
  expect(bettingDealer).not.toContain("YOUR JETONS");
  expect(bettingDealer).not.toContain("PLACE BET");

  const bettingPlayer = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: playerView("BETTING"),
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(bettingPlayer).toContain('data-table-board="BLACKJACK_PLAYER"');
  expect(bettingPlayer).toContain("PLACE BET");
  expect(bettingPlayer).toContain("YOUR JETONS");
  expect(bettingPlayer).not.toContain("START BETTING");
  expect(bettingPlayer).not.toContain("DEAL CARDS");

  const playingDealer = renderToStaticMarkup(
    createElement(ClassicBankTable, { view: bank("PLAYING"), members, onCommand: () => undefined }),
  );
  expect(playingDealer).toContain("ENTER PAYOUT");
  expect(playingDealer).not.toContain("YOUR JETONS");

  const playingPlayer = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: playerView("PLAYING"),
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(playingPlayer).toContain("2×");
  expect(playingPlayer).not.toContain("ENTER PAYOUT");
  expect(playingPlayer).not.toContain("START BETTING");

  const insuranceDealer = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bank("PLAYING", { insurance: { window: "OPEN", total: money("0", "0"), count: 0, resolution: null } }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(insuranceDealer).toContain("INSURANCE");
  expect(insuranceDealer).not.toContain("YOUR JETONS");

  const insurancePlayer = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: playerView("PLAYING", { insuranceWindowOpen: true, actions: { bet: false, retract: false, addBox: false, removeEmptyBox: false, double: true, split: true, insurance: true } }),
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(insurancePlayer).toContain("INSURANCE");
  expect(insurancePlayer).not.toContain("START BETTING");
  expect(insurancePlayer).not.toContain("CLOSE INSURANCE");

  const payoutDealer = renderToStaticMarkup(
    createElement(ClassicBankTable, { view: bank("PAYOUT"), members, onCommand: () => undefined }),
  );
  expect(payoutDealer).toContain("WON");
  expect(payoutDealer).not.toContain("YOUR JETONS");

  const payoutPlayer = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: playerView("PAYOUT"),
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(payoutPlayer).toContain("YOUR JETONS");
  expect(payoutPlayer).not.toContain("START BETTING");
  expect(payoutPlayer).not.toContain("2×");
});

test("Owner only Phase 0 stays on the admin board, not the Player tray", () => {
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: false,
      isSeatedPlayer: true,
      game: "BLACKJACK",
      phase: "TABLE_SETUP",
      setup: { setupCompleted: true },
    }),
  ).toBe("PHASE_ZERO_DEALER");
  const html = renderToStaticMarkup(
    createElement(ClassicPhaseZero, {
      setup: { ...setup, bankName: "Blair", isOwner: true },
      waiting: null,
      poker: null,
      members: [
        { ...members[0]!, isBankDealer: false },
        { userId: "blair", name: "Blair", email: "", isOwner: false, isBankDealer: true, available: money("100") },
        members[1]!,
      ],
      onCommand: () => undefined,
      isOwner: true,
      isBank: false,
      viewerId: "owner",
      game: "BLACKJACK",
    }),
  );
  expect(html).toContain('data-table-board="PHASE_ZERO_DEALER"');
  expect(html).toContain("DEALER");
  expect(html).toContain("Casey");
  expect(html).not.toContain("DEALER · Blair");
  expect(html).toContain("ADD PLAYER");
  expect(html).not.toContain("START BETTING");
  expect(html).not.toContain("YOUR JETONS");
});

test("Owner/Dealer who is also seated still renders the Dealer board", () => {
  expect(
    selectTableBoard({
      isOwner: true,
      isDealer: true,
      isSeatedPlayer: true,
      game: "BLACKJACK",
      phase: "BETTING",
    }),
  ).toBe("BLACKJACK_DEALER");
});

test("invitation mask expands only one method", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicInviteMask, {
      open: true,
      onClose: () => undefined,
      guestJoinUrl: "http://127.0.0.1:3000/join/guest/g",
      verifiedJoinUrl: "http://127.0.0.1:3000/join/verified/v",
      emailConfigured: true,
      startingJetons: "100",
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("GUEST QR");
  expect(html).toContain("VERIFIED QR");
  expect(html).toContain("EMAIL");
  expect(html).toContain("Join this table without email. Starts with 100 jetons.");
  expect(html).toContain("Copy Link");
  expect(html).toContain("/join/guest/g");
  expect(html).not.toContain("Confirm email to become a verified user");
  expect(html).not.toContain("Player email");
});

test("Poker Dealer and Player boards stay unmerged", () => {
  const view: PokerTableView = {
    role: "POKER_PLAYER",
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "Texas Hold’em · PRE-FLOP",
    tableName: "Hold em",
    copy: "YOUR TURN",
    isOwner: true,
    pot: money("15"),
    potPaid: false,
    toCall: money("10"),
    contribution: money("0", "0"),
    available: money("100"),
    smallBlind: money("5"),
    bigBlind: money("10"),
    streetWager: money("10"),
    viewerStatus: "ACTIVE",
    seats: [],
    pots: [],
    legalActions: [{ type: "FOLD", amount: money("0", "0"), label: "FOLD" }],
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
    streetRail: [{ id: "PRE-FLOP", state: "current" }],
  };
  const dealer = renderToStaticMarkup(
    createElement(ClassicPokerDealer, { view, members, onCommand: () => undefined }),
  );
  expect(dealer).toContain("DEAL FLOP");
  const player = renderToStaticMarkup(
    createElement(ClassicPokerPlayer, {
      view: { ...view, isOwner: false, viewerId: "p1", legalActions: [{ type: "FOLD", amount: money("0", "0"), label: "FOLD" }] },
      onCommand: () => undefined,
    }),
  );
  expect(player).toContain("YOUR JETONS");
  expect(player).not.toContain("DEAL FLOP");
});
