import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  BankTableView,
  BoxView,
  MemberView,
  PlayerTableView,
  PokerTableView,
  SetupTableView,
  WaitingTableView,
} from "@/application/queries/views";
import { tabletopSkin } from "./index";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });
const noop = () => undefined;

const box = (n: number, overrides: Partial<BoxView> = {}): BoxView => ({
  id: `b${n}`,
  playerId: "p1",
  playerName: "Alex",
  label: `YOUR BOX ${n}`,
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
    { outcome: "LOST", label: "LOST", title: "LOST" },
    { outcome: "PUSH", label: "STAND OFF", title: "STAND OFF" },
    { outcome: "BLACKJACK", label: "BLACKJACK", title: "BLACKJACK" },
    { outcome: "WON", label: "WON", title: "WON" },
  ],
  ...overrides,
});

const members: MemberView[] = [
  { userId: "p1", name: "Alex", email: "a@x.io", isOwner: false, isBankDealer: false, available: money("100") },
  { userId: "d1", name: "Dee", email: "d@x.io", isOwner: true, isBankDealer: true, available: money("0") },
];

function player(phase: PlayerTableView["phase"], boxes: BoxView[], extra: Partial<PlayerTableView> = {}): PlayerTableView {
  return {
    role: "PLAYER",
    phase,
    tableName: "Salon",
    title: "",
    copy: "",
    available: money("75"),
    boxes,
    insuranceWindowOpen: false,
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    actions: { bet: phase === "BETTING", retract: phase === "BETTING", addBox: phase === "BETTING", removeEmptyBox: false, double: true, split: true, insurance: true },
    ...extra,
  };
}

function bank(phase: BankTableView["phase"], extra: Partial<BankTableView> = {}): BankTableView {
  return {
    role: "BANK",
    phase,
    tableName: "Salon",
    title: "",
    copy: "",
    phaseLabel: phase,
    primaryAction: { id: "dealCards", label: "DEAL CARDS", enabled: true },
    boxes: [],
    players: [
      { userId: "p1", name: "Alex", available: money("100"), locked: money("25"), status: "", boxes: [box(1), box(2, { id: "b9", playerId: "p2", playerName: "Jo" })] },
      { userId: "p3", name: "Mia", available: money("50"), locked: money("0"), status: "", boxes: [] },
    ],
    playerCount: 3,
    boxCount: 2,
    lockedOrdinary: money("50"),
    insurance: { window: "CLOSED", total: money("0"), count: 0, resolution: null },
    actions: {
      dealCards: true,
      scheduleDeal: true,
      payoutPhase: true,
      nextHand: false,
      scheduleNextRound: false,
      openInsurance: true,
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
    },
    insuranceSettleActions: [],
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    hasValidBet: true,
    isOwner: true,
    tableStatus: "ACTIVE",
    paused: false,
    closePreview: null,
    dealerName: "Dee",
    guestJoinUrl: "http://x/join/guest/t",
    verifiedJoinUrl: "http://x/join/verified/t",
    ...extra,
  };
}

function poker(extra: Partial<PokerTableView> = {}): PokerTableView {
  const seat = (userId: string, name: string, i: number, o: object = {}) => ({
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
    orderIndex: i,
    hasHoleCards: false,
    holeCards: null,
    ...o,
  });
  return {
    role: "POKER_PLAYER",
    phase: "PRE_FLOP",
    phaseLabel: "PRE_FLOP",
    headline: "",
    tableName: "Hold em",
    copy: "",
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
    seats: [seat("v", "Vi", 0, { isActor: true, isDealer: true }), seat("s", "Sam", 1, { isSmallBlind: true }), seat("t", "Tom", 2, { isBigBlind: true }), seat("u", "Uma", 3)],
    pots: [],
    legalActions: [
      { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
      { type: "CALL", amount: money("10"), label: "CALL 10" },
      { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE" },
      { type: "ALL_IN", amount: money("100"), label: "ALL IN" },
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
    ],
    ...extra,
  };
}

const setup = (extra: Partial<SetupTableView> = {}): SetupTableView => ({
  role: "SETUP",
  phase: "TABLE_SETUP",
  tableName: "Salon",
  game: "Blackjack",
  gameId: "BLACKJACK",
  gameOptions: [],
  ownerName: "Dee",
  bankName: "Dee",
  startingJetonsPerPlayer: money("100"),
  seats: [],
  members,
  invitations: [{ id: "i1", kind: "EMAIL", email: "j@x.io", pending: true }],
  joinUrl: null,
  guestJoinUrl: "http://x/join/guest/t",
  verifiedJoinUrl: "http://x/join/verified/t",
  minBet: null,
  maxBet: null,
  blackjackPayout: "THREE_TWO",
  maxBoxesPerPlayer: 3,
  insuranceEnabled: true,
  bankMayDistributeJetons: true,
  canStartBetting: true,
  startBlockedReason: null,
  isOwner: true,
  isBank: true,
  setupCompleted: true,
  tableStatus: "SETUP",
  paused: false,
  closePreview: null,
  ...extra,
});

const render = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe("tabletop skin renders", () => {
  it("Blackjack Player: tray, wallet, add box, insurance, play actions", () => {
    const html = render(
      createElement(tabletopSkin.PlayerTable, {
        view: player("BETTING", [box(1), box(2), box(3)]),
        selectedBoxId: "b1",
        onSelectBox: noop,
        onCommand: noop,
      }),
    );
    expect(html).toContain('data-skin="tabletop"');
    expect(html).toContain('data-table-board="BLACKJACK_PLAYER"');
    expect(html).toContain("ADD BOX");
    expect(html).toContain("PLACE BET");
    expect(html).toContain("RETRACT");
    expect(html).toContain("data-player-wallet");
    expect(html).toContain("data-jeton-tray");
    expect(html).toContain("YOUR JETONS");
    expect(html).toContain('data-box-id="b1"');
    expect(html).not.toContain("data-arc");
    expect(html).not.toMatch(/classic-skin/);

    const playing = render(
      createElement(tabletopSkin.PlayerTable, {
        view: player("PLAYING", [box(1)], { insuranceWindowOpen: true }),
        selectedBoxId: "b1",
        onSelectBox: noop,
        onCommand: noop,
      }),
    );
    expect(playing).toContain("2×");
    expect(playing).toContain("SPLIT");
    expect(playing).toContain("INSURANCE");
    expect(playing).toContain("+ CARD");
    expect(playing).toContain("UNDO");
    expect(playing).toContain('data-insurance-panel="true"');
    expect(playing).not.toContain("ADD BOX");
  });

  it("Blackjack Dealer: ledger, docks, payout labels, rules strip allowed", () => {
    const betting = render(createElement(tabletopSkin.BankTable, { view: bank("BETTING"), members, onCommand: noop }));
    expect(betting).toContain('data-skin="tabletop"');
    expect(betting).toContain('data-table-board="BLACKJACK_DEALER"');
    expect(betting).toContain("DEAL CARDS");
    expect(betting).toContain("ADD PLAYER");
    expect(betting).toContain("data-blackjack-box-row");
    expect(betting).toContain("Alex");
    expect(betting).toContain("Jo");
    expect(betting).not.toContain("Mia");
    expect(betting).toContain("Blackjack pays 3 to 2");
    expect(betting).toContain("Insurance pays 2 to 1");
    expect(betting).toContain("DEALER HAND");
    expect(betting).not.toContain("tt-dealer-summary");
    expect(betting).not.toContain("data-dealer-positions");
    expect(betting).not.toContain("data-payout-action");

    const payout = render(createElement(tabletopSkin.BankTable, { view: bank("PAYOUT"), members, onCommand: noop }));
    for (const label of ["LOST", "PUSH", "BLACKJACK", "WON"]) expect(payout).toContain(label);
    expect(payout).toContain("Set Box 1 result: Stand-off");
    expect(payout).toContain("data-payout-action");
    expect(payout).toContain("START BETTING");
    expect(payout).toContain("DEALER HAND");

    const playing = render(
      createElement(tabletopSkin.BankTable, {
        view: bank("PLAYING", {
          dealerHand: { ranks: [], complete: false, label: "", suggestedOutcome: null, canEdit: true },
          boxes: [box(1), box(2, { id: "b9", playerId: "p2", playerName: "Jo" })],
          players: [
            { userId: "p1", name: "Alex", available: money("100"), locked: money("25"), status: "", boxes: [box(1)] },
            {
              userId: "p2",
              name: "Jo",
              available: money("80"),
              locked: money("25"),
              status: "",
              boxes: [box(2, { id: "b9", playerId: "p2", playerName: "Jo" })],
            },
          ],
        }),
        members,
        onCommand: noop,
      }),
    );
    expect(playing).toContain("ENTER PAYOUT");
    expect(playing).toContain("OPEN INSURANCE");
    expect(playing).toContain("DEALER HAND");
    expect(playing).toContain("+ CARD");
    expect(playing).toContain('data-dealer-hand="true"');
    expect(playing).not.toContain('class="tt-dealer-summary');
  });

  it("Player privacy: own boxes only; Dealer sees all real boxes", () => {
    const playerHtml = render(
      createElement(tabletopSkin.PlayerTable, {
        view: player("BETTING", [box(1), box(2)]),
        selectedBoxId: "b1",
        onSelectBox: noop,
        onCommand: noop,
      }),
    );
    expect(playerHtml).toContain('data-box-id="b1"');
    expect(playerHtml).toContain('data-box-id="b2"');
    expect(playerHtml).not.toContain("Jo");
    expect(playerHtml).not.toContain("Mia");

    const dealerHtml = render(createElement(tabletopSkin.BankTable, { view: bank("BETTING"), members, onCommand: noop }));
    expect(dealerHtml).toContain("Alex");
    expect(dealerHtml).toContain("Jo");
    expect(dealerHtml).not.toContain("Mia");
    expect(dealerHtml).toContain('data-box-id="b1"');
    expect(dealerHtml).toContain('data-box-id="b9"');
    expect(dealerHtml).toContain('data-box-count="2"');
  });

  it("Phase 0, setup, waiting, entry, home and create render", () => {
    const phaseZero = render(
      createElement(tabletopSkin.PhaseZero, { setup: setup(), waiting: null, poker: null, members, onCommand: noop, isOwner: true, isBank: true, viewerId: "d1", game: "BLACKJACK" }),
    );
    expect(phaseZero).toContain('data-table-board="PHASE_ZERO_DEALER"');
    expect(phaseZero).toContain("START BETTING");
    expect(phaseZero).toContain("ADD PLAYER");
    expect(phaseZero).not.toContain("data-dealer-positions");

    expect(render(createElement(tabletopSkin.SetupTable, { view: setup({ setupCompleted: false }), onCommand: noop }))).toContain("START TABLE");
    expect(render(createElement(tabletopSkin.SetupTable, { view: setup(), onCommand: noop }))).toContain("START BETTING");

    const waiting: WaitingTableView = { role: "WAITING", phase: "TABLE_SETUP", tableName: "Salon", game: "Blackjack", available: money("100"), copy: "" };
    const waitingHtml = render(createElement(tabletopSkin.WaitingTable, { view: waiting }));
    expect(waitingHtml).toContain('data-table-board="PHASE_ZERO_PLAYER"');
    expect(waitingHtml).toContain("data-player-wallet");
    expect(waitingHtml).toContain("data-jeton-tray");

    const entry = render(createElement(tabletopSkin.Entry, { title: "Sign in", copy: "Email", actionLabel: "Send link", onSubmit: noop }));
    expect(entry).toContain("Send link");

    const home = render(
      createElement(tabletopSkin.Home, {
        displayName: "Dee",
        defaultTableName: "T",
        tables: [],
        onCreateTable: async () => undefined,
        onJoinTable: noop,
        onOpenTable: noop,
      }),
    );
    expect(home).toContain("SAVED TABLES");
    expect(home).toContain("CREATE TABLE");

    expect(render(createElement(tabletopSkin.CreateTable, { defaultTableName: "T", onBack: noop, onCreate: async () => undefined }))).toContain("START TABLE");
  });

  it("Poker Player and Dealer: seats, pot, actor actions, owner street control", () => {
    const player = render(createElement(tabletopSkin.PokerPlayer, { view: poker(), onCommand: noop }));
    expect(player).toContain('data-table-board="POKER_PLAYER"');
    expect(player).toContain('data-actor="true"');
    expect(player).toContain("CALL 10");
    expect(player).toContain("TO CALL");
    expect(player).toContain('data-dealer="true"');
    expect(player).toContain("SB");
    expect(player).toContain("BB");
    expect(player).toContain("data-player-wallet");
    expect(player).toContain("YOU ·");
    expect(player).not.toContain("DEAL FLOP");
    expect(player).not.toContain("POKER CLOTH");

    const owner = render(
      createElement(tabletopSkin.PokerDealer, { view: poker({ role: "POKER_DEALER", isOwner: true }), members, onCommand: noop }),
    );
    expect(owner).toContain('data-table-board="POKER_DEALER"');
    expect(owner).toContain("DEAL FLOP");
    expect(owner).toContain("Waiting for bets to match");
    expect(owner).toContain("OWNER");

    const setup = render(
      createElement(tabletopSkin.PokerDealer, {
        view: poker({
          role: "POKER_DEALER",
          isOwner: true,
          phase: "POKER_SETUP",
          phaseLabel: "POKER_SETUP",
          legalActions: [],
          waitingCopy: null,
          currentActorId: null,
          canAddPlayer: true,
          streetRail: [],
        }),
        members,
        onCommand: noop,
      }),
    );
    expect(setup).toContain("TABLE SETUP");
    expect(setup).toContain("Waiting for Players");
    expect(setup).toContain("START HAND");
    expect(setup).toContain("ADD PLAYER");
    expect(setup).toContain('data-poker-rail="oval"');
    expect(setup).toContain('data-centre-divider="absent"');
    expect(setup).not.toContain("POKER SETUP");
    expect(setup).not.toContain("TO CALL");
    expect(setup).not.toMatch(/STREET\s+\d/i);
    expect(setup).toContain('data-role-badge="game-switch"');
    expect(setup).toContain("BLACKJACK");
    expect(setup).not.toContain('data-role-badge="game"');

    const complete = render(
      createElement(tabletopSkin.PokerPlayer, {
        view: poker({
          phase: "HAND_COMPLETE",
          phaseLabel: "HAND_COMPLETE",
          potPaid: true,
          toCall: money("0", "0"),
          legalActions: [],
          waitingCopy: null,
          currentActorId: null,
          currentActorName: null,
          winners: [{ userId: "v", name: "Vi", amount: money("15") }],
          canNextHand: false,
          seats: [
            {
              userId: "v",
              name: "Vi",
              available: money("115"),
              contribution: money("0", "0"),
              streetContribution: money("0", "0"),
              toCall: money("0", "0"),
              status: "ACTIVE",
              isDealer: true,
              isSmallBlind: true,
              isBigBlind: false,
              isActor: false,
              sittingOut: false,
              orderIndex: 0,
              hasHoleCards: false,
              holeCards: null,
            },
            {
              userId: "s",
              name: "Sam",
              available: money("85"),
              contribution: money("0", "0"),
              streetContribution: money("0", "0"),
              toCall: money("0", "0"),
              status: "ACTIVE",
              isDealer: false,
              isSmallBlind: false,
              isBigBlind: true,
              isActor: false,
              sittingOut: false,
              orderIndex: 1,
              hasHoleCards: false,
              holeCards: null,
            },
          ],
        }),
        onCommand: noop,
      }),
    );
    expect(complete).toContain("HAND COMPLETE");
    expect(complete).toContain("WON 15");
    expect(complete).toContain('data-next-rotation="true"');
    expect(complete).toContain('data-hand-complete="true"');
    expect(complete).not.toContain("YOUR TURN");
    expect(complete).not.toContain("TO CALL");
    expect(complete).not.toContain("CALL 10");
    expect((complete.match(/WON 15/g) ?? []).length).toBe(1);
  });
});
