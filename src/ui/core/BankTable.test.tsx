import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ClassicBankTable } from "@/ui/skins/classic/components/ClassicBankTable";
import type { BankTableView, BoxView, MemberView } from "@/application/queries/views";

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
  insurance: { millis: "12500", label: "12.5" },
  insuranceMax: { millis: "12500", label: "12.5" },
  insuranceResult: null,
  outcome: null,
  returned: null,
  payoutActions: [
    { outcome: "WON", label: "Win · return 50", swipeLabel: "WIN +50" },
    { outcome: "PUSH", label: "Push · return 25", swipeLabel: "Push · return 25" },
    { outcome: "LOST", label: "Lose · return 0", swipeLabel: "LOSS · 0" },
    { outcome: "BLACKJACK", label: "Blackjack · return 62.5", swipeLabel: "Blackjack · return 62.5" },
  ],
  ...overrides,
});

const members: MemberView[] = [
  {
    userId: "p1",
    name: "Alex",
    email: "alex@example.com",
    isOwner: false,
    isBankDealer: false,
    available: { millis: "100000", label: "100" },
  },
];

function bankView(overrides: Partial<BankTableView>): BankTableView {
  return {
    role: "BANK",
    phase: "BETTING",
    tableName: "Salon",
    title: "Take bets",
    copy: "Close when ready",
    phaseLabel: "BETTING",
    primaryAction: { id: "dealCards", label: "DEAL CARDS NOW", enabled: true },
    boxes: [box({ insurance: null })],
    playerCount: 1,
    boxCount: 1,
    lockedOrdinary: { millis: "25000", label: "25" },
    insurance: { window: "CLOSED", total: { millis: "0", label: "0" }, count: 0, resolution: null },
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    hasValidBet: true,
    players: [
      {
        userId: "p1",
        name: "Alex",
        available: { millis: "100000", label: "100" },
        locked: { millis: "25000", label: "25" },
        status: "Betting",
        boxes: [box({ insurance: null })],
      },
    ],
    isOwner: true,
    tableStatus: "ACTIVE",
    paused: false,
    closePreview: null,
    actions: {
      dealCards: true,
      scheduleDeal: true,
      payoutPhase: false,
      nextHand: false,
      scheduleNextRound: false,
      openInsurance: false,
      closeInsurance: false,
      settleBoxes: false,
      settleInsurance: false,
      addPlayer: true,
      giveJetons: true,
      changeBank: true,
      saveTable: true,
      closeTable: false,
    },
    insuranceSettleActions: [
      { id: "DEALER_BLACKJACK", label: "Dealer Blackjack" },
      { id: "NO_DEALER_BLACKJACK", label: "No Blackjack" },
    ],
    ...overrides,
  };
}

test("Bank betting keeps deal controls at the top", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, { view: bankView({}), members, onCommand: () => undefined }),
  );
  expect(html).toContain("CURRENT PHASE:");
  expect(html).toContain("BETTING");
  expect(html).toContain("DEAL CARDS NOW");
  expect(html).toContain("DEAL IN 7 SECONDS");
  expect(html.indexOf("CURRENT PHASE:")).toBeLessThan(html.indexOf("DEAL CARDS NOW"));
  expect(html.indexOf("DEAL CARDS NOW")).toBeLessThan(html.indexOf("ON TABLE"));
});

test("Bank playing shows an open Insurance window as a side pot", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        phase: "PLAYING",
        phaseLabel: "PLAYING",
        primaryAction: { id: "payoutPhase", label: "Payout phase", enabled: true },
        insurance: { window: "OPEN", total: { millis: "12500", label: "12.5" }, count: 1, resolution: null },
        actions: {
          dealCards: false,
          scheduleDeal: false,
          payoutPhase: true,
          nextHand: false,
          scheduleNextRound: false,
          openInsurance: false,
          closeInsurance: true,
          settleBoxes: false,
          settleInsurance: false,
          addPlayer: false,
          giveJetons: false,
          changeBank: false,
          saveTable: true,
          closeTable: false,
        },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("PLAYING");
  expect(html).toContain("Payout phase");
  expect(html).toContain("INSURANCE SIDE POT · OPEN · 1 bet");
  expect(html).not.toContain("Deal cards");
});

test("Bank payout keeps next hand locked while boxes and Insurance are unresolved", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        phase: "PAYOUT",
        phaseLabel: "PAYOUT",
        title: "Settle the round",
        primaryAction: { id: "nextHand", label: "NEXT ROUND NOW", enabled: false },
        boxes: [box()],
        players: [
          {
            userId: "p1",
            name: "Alex",
            available: { millis: "100000", label: "100" },
            locked: { millis: "25000", label: "25" },
            status: "Awaiting payout",
            boxes: [box(), box({ id: "2", boxNumber: 2, label: "Box 2", isSplit: true })],
          },
        ],
        insurance: { window: "CLOSED", total: { millis: "12500", label: "12.5" }, count: 1, resolution: null },
        actions: {
          dealCards: false,
          scheduleDeal: false,
          payoutPhase: false,
          nextHand: false,
          scheduleNextRound: false,
          openInsurance: false,
          closeInsurance: false,
          settleBoxes: true,
          settleInsurance: true,
          addPlayer: false,
          giveJetons: false,
          changeBank: false,
          saveTable: true,
          closeTable: false,
        },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("PAYOUT");
  expect(html).toContain("NEXT ROUND NOW");
  expect(html).toContain("NEXT ROUND IN 7 SECONDS");
  expect(html).toContain("dealer-list");
  expect(html).not.toContain("dealer-grid");
  expect(html).toContain("Box 2");
  expect(html).toContain("WIN +50");
  expect(html).toContain("LOSS · 0");
  expect(html).toContain("Push · return 25");
  expect(html).toContain("Blackjack · return 62.5");
  expect(html).toContain("Dealer Blackjack");
  expect(html).not.toContain("Deal cards");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>NEXT ROUND NOW/);
});

test("resolved boxes keep row state without payout controls", () => {
  const resolved = box({ outcome: "WON", returned: { millis: "50000", label: "50" } });
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        phase: "PAYOUT",
        phaseLabel: "PAYOUT",
        boxes: [resolved],
        players: [
          {
            userId: "p1",
            name: "Alex",
            available: { millis: "100000", label: "100" },
            locked: { millis: "0", label: "0" },
            status: "Settled",
            boxes: [resolved],
          },
        ],
        actions: {
          dealCards: false,
          scheduleDeal: false,
          payoutPhase: false,
          nextHand: false,
          scheduleNextRound: false,
          openInsurance: false,
          closeInsurance: false,
          settleBoxes: true,
          settleInsurance: false,
          addPlayer: false,
          giveJetons: false,
          changeBank: false,
          saveTable: true,
          closeTable: false,
        },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("Win · 50");
  expect(html).not.toContain("payout-access");
});
