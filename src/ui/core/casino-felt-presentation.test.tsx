import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ClassicBankTable } from "@/ui/skins/classic/components/ClassicBankTable";
import { ClassicPhaseZero } from "@/ui/skins/classic/components/ClassicPhaseZero";
import { ClassicPlayerTable } from "@/ui/skins/classic/components/ClassicPlayerTable";
import { ClassicSetupTable } from "@/ui/skins/classic/components/ClassicSetupTable";
import { ClassicWaitingTable } from "@/ui/skins/classic/components/ClassicWaitingTable";
import type { BankTableView, BoxView, MemberView, PlayerTableView, SetupTableView } from "@/application/queries/views";

const members: MemberView[] = [
  {
    userId: "p1",
    name: "Alex",
    email: "alex@example.com",
    isOwner: true,
    isBankDealer: true,
    available: { millis: "0", label: "0" },
  },
];

const box = (overrides: Partial<BoxView> = {}): BoxView => ({
  id: "1",
  playerId: "p1",
  playerName: "Alex",
  label: "1",
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
    { outcome: "PUSH", label: "STAND OFF", title: "STAND OFF", returnLine: "25", swipeLabel: "STAND OFF" },
    { outcome: "BLACKJACK", label: "BLACKJACK", title: "BLACKJACK", returnLine: "62.5", swipeLabel: "BLACKJACK" },
    { outcome: "WON", label: "WON", title: "WON", returnLine: "50", swipeLabel: "WIN" },
  ],
  ...overrides,
});

function setupView(overrides: Partial<SetupTableView> = {}): SetupTableView {
  return {
    role: "SETUP",
    phase: "TABLE_SETUP",
    tableName: "Alex's table",
    game: "Blackjack",
    gameOptions: [
      { id: "BLACKJACK", label: "Blackjack", available: true },
      { id: "POKER", label: "Poker · Coming later", available: false },
    ],
    ownerName: "Alex",
    bankName: "Alex",
    startingJetonsPerPlayer: { millis: "100000", label: "100" },
    seats: [{ id: "bank", name: "Alex", status: "Bank / Dealer" }],
    members,
    invitations: [],
    joinUrl: null,
    guestJoinUrl: null,
    verifiedJoinUrl: null,
    minBet: null,
    maxBet: null,
    blackjackPayout: "THREE_TWO",
    maxBoxesPerPlayer: 3,
    insuranceEnabled: true,
    bankMayDistributeJetons: true,
    canStartBetting: false,
    startBlockedReason: "Waiting for a player to join",
    isOwner: true,
    setupCompleted: true,
    tableStatus: "SETUP",
    paused: false,
    closePreview: null,
    ...overrides,
  };
}

function bankView(overrides: Partial<BankTableView>): BankTableView {
  return {
    role: "BANK",
    phase: "BETTING",
    tableName: "Salon",
    title: "Take bets",
    copy: "Close when ready",
    phaseLabel: "BETTING",
    primaryAction: { id: "dealCards", label: "DEAL CARDS", enabled: true },
    boxes: [box()],
    playerCount: 1,
    boxCount: 1,
    lockedOrdinary: { millis: "25000", label: "25" },
    insurance: { window: "CLOSED", total: { millis: "0", label: "0" }, count: 0, resolution: null },
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    hasValidBet: true,
    players: [{ userId: "p1", name: "Alex", available: { millis: "100000", label: "100" }, locked: { millis: "25000", label: "25" }, status: "Betting", boxes: [box()] }],
    isOwner: true,
    tableStatus: "ACTIVE",
    paused: false,
    closePreview: null,
    dealerName: "Alex",
    actions: {
      dealCards: true,
      scheduleDeal: true,
      payoutPhase: false,
      nextHand: false,
      scheduleNextRound: false,
      openInsurance: false,
      closeInsurance: false,
      settleBoxes: false,
      settleDealerWon: false,
      settleInsurance: false,
      addPlayer: true,
      giveJetons: true,
      changeBank: true,
      saveTable: true,
      closeTable: false,
      switchGame: false,
    },
    insuranceSettleActions: [
      { id: "DEALER_BLACKJACK", label: "INSURANCE WON" },
      { id: "NO_DEALER_BLACKJACK", label: "INSURANCE LOST" },
    ],
    ...overrides,
  };
}

function dockHtml(html: string) {
  const start = html.indexOf('data-dealer-dock="true"');
  expect(start).toBeGreaterThan(-1);
  return html.slice(start);
}

test("Phase 0 uses the shared 65/35 Dealer dock", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicSetupTable, {
      view: setupView(),
      onCommand: () => undefined,
    }),
  );
  const dock = dockHtml(html);
  expect(html).toContain('data-dock-columns="2"');
  expect(dock.indexOf("START BETTING")).toBeLessThan(dock.indexOf("ADD PLAYER"));
  expect(html).toMatch(/<button[^>]*disabled[^>]*>START BETTING/);
  expect(html).toMatch(/data-add-player="true"[^>]*>ADD PLAYER/);
  expect(html).not.toContain("class=\"dealer-secondary\"");
  expect(html).not.toContain("phase-zero-meta");
  expect(html).not.toContain("cloth-name-rule");
  expect(html.match(/data-table-name=/g)?.length).toBe(1);
  expect(html).toMatch(/data-table-name="Alex[^"]*table"/);
  expect(html).not.toContain("Owner · Alex");
  expect(html).not.toContain("DEALER · Alex");
  expect(html).not.toContain("Blackjack · Owner");
});

test("Dealer phase dock matrix stays on one shared bottom row", () => {
  const betting = renderToStaticMarkup(
    createElement(ClassicBankTable, { view: bankView({}), members, onCommand: () => undefined }),
  );
  expect(betting).toContain('data-dock-columns="2"');
  expect(dockHtml(betting).indexOf("DEAL CARDS")).toBeLessThan(dockHtml(betting).indexOf("ADD PLAYER"));

  const playing = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        phase: "PLAYING",
        phaseLabel: "PLAYING",
        primaryAction: { id: "payoutPhase", label: "ENTER PAYOUT", enabled: true },
        actions: { ...bankView({}).actions, dealCards: false, addPlayer: false, payoutPhase: true, openInsurance: true },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(playing).toContain('data-dock-columns="2"');
  expect(dockHtml(playing).indexOf("ENTER PAYOUT")).toBeLessThan(dockHtml(playing).indexOf("OPEN INSURANCE"));
  expect(playing).not.toContain("ADD PLAYER");

  const insurance = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        phase: "PLAYING",
        phaseLabel: "INSURANCE OPEN",
        primaryAction: { id: "payoutPhase", label: "ENTER PAYOUT", enabled: true },
        insurance: { window: "OPEN", total: { millis: "12500", label: "12.5" }, count: 1, resolution: null },
        actions: { ...bankView({}).actions, dealCards: false, addPlayer: false, payoutPhase: true, closeInsurance: true, openInsurance: false },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(insurance).toContain('data-dock-columns="2"');
  expect(dockHtml(insurance).indexOf("ENTER PAYOUT")).toBeLessThan(dockHtml(insurance).indexOf("CLOSE INSURANCE"));
  expect(insurance).not.toContain("OPEN INSURANCE");

  const payout = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        phase: "PAYOUT",
        phaseLabel: "PAYOUT",
        primaryAction: { id: "nextHand", label: "START BETTING", enabled: false },
        actions: { ...bankView({}).actions, dealCards: false, addPlayer: false, settleBoxes: true, nextHand: false },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(payout).toContain('data-dock-columns="1"');
  expect(payout).toContain("START BETTING");
  expect(payout).not.toContain("ADD PLAYER");
  expect(payout).not.toContain("OPEN INSURANCE");
});

test("felt name is printed once without title ornaments or metadata", () => {
  const dealer = renderToStaticMarkup(
    createElement(ClassicBankTable, { view: bankView({}), members, onCommand: () => undefined }),
  );
  const waiting = renderToStaticMarkup(
    createElement(ClassicWaitingTable, {
      view: {
        role: "WAITING",
        phase: "TABLE_SETUP",
        tableName: "Salon",
        game: "Blackjack",
        available: { millis: "100000", label: "100" },
        copy: "Waiting for the table to open betting.",
        ownerName: "Alex",
        bankName: "Alex",
      },
    }),
  );
  const phaseZero = renderToStaticMarkup(
    createElement(ClassicPhaseZero, {
      setup: setupView(),
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
  for (const html of [dealer, waiting, phaseZero]) {
    expect(html.match(/data-table-name=/g)?.length).toBe(1);
    expect(html).not.toContain("cloth-name-rule");
    expect(html).not.toContain("phase-zero-meta");
    expect(html).not.toContain("ledger-avatar");
  }
  expect(dealer).toContain("dealer-positions");
  expect(dealer).toContain('data-dealer-position="true"');
  expect(dealer).not.toContain("dealer-grid");
  expect(dealer).not.toContain("Round complete");
});

test("Dealer payout controls stay a large 2x2 on a compact position", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        phase: "PAYOUT",
        phaseLabel: "PAYOUT",
        primaryAction: { id: "nextHand", label: "START BETTING", enabled: false },
        actions: { ...bankView({}).actions, dealCards: false, addPlayer: false, settleBoxes: true },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("payout-access");
  expect((html.match(/data-payout-action="true"/g) ?? []).length).toBe(4);
  expect(html.indexOf('rail-title">LOST')).toBeLessThan(html.indexOf('rail-title">STAND OFF'));
  expect(html.indexOf('rail-title">STAND OFF')).toBeLessThan(html.indexOf('rail-title">BLACKJACK'));
  expect(html.indexOf('rail-title">BLACKJACK')).toBeLessThan(html.indexOf('rail-title">WON'));
  const css = readFileSync(join(process.cwd(), "src/ui/skins/classic/blackjack-classic.css"), "utf8");
  expect(css).toContain("grid-template-columns: 1fr 1fr");
  expect(css).toContain("min-height: 44px");
});

test("Player box geometry stays fixed across slots", () => {
  const view: PlayerTableView = {
    role: "PLAYER",
    phase: "BETTING",
    tableName: "Salon",
    title: "Place bets",
    copy: "",
    available: { millis: "75000", label: "75" },
    insuranceWindowOpen: false,
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    actions: { bet: true, retract: true, addBox: true, removeEmptyBox: false, double: false, split: false, insurance: false },
    boxes: [box({ label: "YOUR BOX 1" })],
  };
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view,
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("data-box-stage");
  expect(html).toContain('data-box-slot="1"');
  expect(html).toContain("BOX 1");
  expect(html).toContain('data-table-name="Salon"');
});
