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
    { outcome: "WON", label: "Won" },
    { outcome: "PUSH", label: "Push" },
    { outcome: "LOST", label: "Lost" },
    { outcome: "BLACKJACK", label: "Blackjack" },
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
    hasValidBet: true,
    actions: {
      dealCards: true,
      scheduleDeal: true,
      payoutPhase: false,
      nextHand: false,
      openInsurance: false,
      closeInsurance: false,
      settleBoxes: false,
      settleInsurance: false,
      addPlayer: true,
      giveJetons: true,
      changeBank: true,
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
          openInsurance: false,
          closeInsurance: true,
          settleBoxes: false,
          settleInsurance: false,
          addPlayer: false,
          giveJetons: false,
          changeBank: false,
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
        primaryAction: { id: "nextHand", label: "Start next hand", enabled: false },
        boxes: [box()],
        insurance: { window: "CLOSED", total: { millis: "12500", label: "12.5" }, count: 1, resolution: null },
        actions: {
          dealCards: false,
          scheduleDeal: false,
          payoutPhase: false,
          nextHand: false,
          openInsurance: false,
          closeInsurance: false,
          settleBoxes: true,
          settleInsurance: true,
          addPlayer: false,
          giveJetons: false,
          changeBank: false,
        },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("PAYOUT");
  expect(html).toContain("Start next hand");
  expect(html).toContain("Won");
  expect(html).toContain("Dealer Blackjack");
  expect(html).not.toContain("Deal cards");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>Start next hand/);
});
