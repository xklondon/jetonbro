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
    { outcome: "LOST", label: "LOST · return 0", title: "LOST", returnLine: "0", swipeLabel: "LOSS · 0" },
    { outcome: "PUSH", label: "STAND OFF · return 25", title: "STAND OFF", returnLine: "25", swipeLabel: "STAND OFF · return 25" },
    { outcome: "BLACKJACK", label: "BLACKJACK · return 62.5", title: "BLACKJACK", returnLine: "62.5", swipeLabel: "BLACKJACK · return 62.5" },
    { outcome: "WON", label: "WON · return 50", title: "WON", returnLine: "50", swipeLabel: "WIN +50" },
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
    dealerName: "Alex",
    bankroll: {
      mode: "OPEN",
      available: { millis: "0", label: "0" },
      reserved: { millis: "0", label: "0" },
      total: { millis: "0", label: "0" },
      canToggle: true,
      lockedReason: null,
      canCoverMore: true,
    },
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
  expect(html).toContain("DEAL CARDS NOW closes Betting and starts Playing.");
  expect(html.indexOf("CURRENT PHASE:")).toBeLessThan(html.indexOf("DEAL CARDS NOW"));
  expect(html.indexOf("DEAL CARDS NOW")).toBeLessThan(html.indexOf("ON TABLE"));
  expect(html).toContain('data-blackjack-box-row="true"');
  expect(html).toContain('data-dealer-box="true"');
  expect(html).toContain(">DEALER<");
  expect(html).not.toContain("betting-spot");
  expect(html).not.toContain("class=\"box is-compact");
});

test("Bank betting shows waiting copy until the first locked bet", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        hasValidBet: false,
        waitingForFirstBet: true,
        actions: { ...bankView({}).actions, dealCards: false, scheduleDeal: false, switchGame: true },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("WAITING FOR THE FIRST BET");
  expect(html).toContain("OPEN BANK");
  expect(html).toContain("LIMITED BANK");
  expect(html).toContain("Unlimited");
  expect(html).toContain("SWITCH GAME");
  expect(html).toContain("+ PLAYER");
  expect(html).toContain("GIVE JETONS");
  expect(html).toContain('data-table-name="Salon"');
  expect(html).not.toContain("xklondon");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>DEAL CARDS NOW/);
});

test("funding toggle stays visible but locked after a stake exists", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        bankroll: {
          mode: "LIMITED",
          available: { millis: "462500", label: "462.5" },
          reserved: { millis: "37500", label: "37.5" },
          total: { millis: "500000", label: "500" },
          canToggle: false,
          lockedReason: "Funding is locked for this round",
          canCoverMore: true,
        },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("OPEN BANK");
  expect(html).toContain("LIMITED BANK");
  expect(html).toContain("462.5 available · 37.5 reserved");
  expect(html).toContain("Funding is locked for this round");
  expect(html).toMatch(/funding-switch[^>]*disabled/);
});

test("Bank playing shows an open Insurance window as a side pot", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        phase: "PLAYING",
        phaseLabel: "PLAYING",
        primaryAction: { id: "payoutPhase", label: "PAYOUT PHASE", enabled: true },
        dealerHand: { ranks: [], complete: false, label: "", suggestedOutcome: null, canEdit: true },
        boxes: [box({ hand: { ranks: [], complete: false, label: "", suggestedOutcome: null, canEdit: true } })],
        players: [
          {
            userId: "p1",
            name: "Alex",
            available: { millis: "100000", label: "100" },
            locked: { millis: "25000", label: "25" },
            status: "In play",
            boxes: [box({ hand: { ranks: [], complete: false, label: "", suggestedOutcome: null, canEdit: true } })],
          },
        ],
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
          settleDealerWon: false,
          settleInsurance: false,
          addPlayer: false,
          giveJetons: false,
          changeBank: false,
          saveTable: true,
          closeTable: false,
          switchGame: false,
        },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("PLAYING");
  expect(html).toContain("PAYOUT PHASE");
  expect(html).toContain("PAYOUT PHASE moves Playing to Payout.");
  expect(html).toContain("INSURANCE SIDE POT · OPEN · 1 bet");
  expect(html).toContain('data-dealer-box="true"');
  expect(html).toContain(">DEALER<");
  expect(html).toContain("+ CARDS");
  expect(html).not.toContain("+ ADD CARDS");
  expect(html).not.toContain("bj-rail");
  expect(html).not.toContain("table-rail");
  expect(html).not.toContain("Deal cards");
  expect(html).not.toContain("OPEN BANK");
  expect(html).not.toContain("LIMITED BANK");
  expect(html).toContain('data-blackjack-box-row="true"');
  expect(html).not.toContain("class=\"box is-compact");
  expect(html).not.toContain("betting-spot");
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
          settleDealerWon: true,
          settleInsurance: true,
          addPlayer: false,
          giveJetons: false,
          changeBank: false,
          saveTable: true,
          closeTable: false,
          switchGame: false,
        },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("PAYOUT");
  expect(html).toContain("NEXT ROUND NOW");
  expect(html).toContain("IN 7 SECONDS");
  expect(html).toContain("next-round-row");
  expect(html).toContain('data-dealer-box="true"');
  expect(html).toContain("DEALER WON");
  expect(html).toContain("dealer-list");
  expect(html).not.toContain("dealer-grid");
  expect(html).not.toContain("bj-rail");
  expect(html).not.toContain("table-rail");
  expect(html).toContain("Box 2");
  expect(html).toContain("payout-reveal win");
  expect(html).toContain("payout-reveal loss");
  expect(html).toContain(">WON<");
  expect(html).toContain(">LOST<");
  expect(html).toContain("LOST");
  expect(html).toContain("STAND OFF");
  expect(html).toContain("WON");
  expect(html.indexOf("rail-title\">LOST")).toBeLessThan(html.indexOf("rail-title\">STAND OFF"));
  expect(html.indexOf("rail-title\">STAND OFF")).toBeLessThan(html.indexOf("rail-title\">BLACKJACK"));
  expect(html.indexOf("rail-title\">BLACKJACK")).toBeLessThan(html.indexOf("rail-title\">WON"));
  expect(html).toContain("Dealer Blackjack");
  expect(html).not.toContain("Deal cards");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>NEXT ROUND NOW/);
  expect(html).not.toContain("outcome-celebration");
  expect(html).not.toContain("WINNER!");
  expect(html).not.toContain("OPEN BANK");
  expect(html).toContain('data-blackjack-box-row="true"');
  expect(html).toContain('data-box-phase="PAYOUT"');
  expect(html).not.toContain("class=\"box is-compact");
  expect(html).not.toContain("betting-spot");
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
          settleDealerWon: false,
          settleInsurance: false,
          addPlayer: false,
          giveJetons: false,
          changeBank: false,
          saveTable: true,
          closeTable: false,
          switchGame: false,
        },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("Won · 50");
  expect(html).not.toContain("payout-access");
});

test("ROUND_COMPLETE keeps the dealer box and one compact next-round row", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        phase: "ROUND_COMPLETE",
        phaseLabel: "ROUND_COMPLETE",
        primaryAction: { id: "nextHand", label: "NEXT ROUND NOW", enabled: true },
        dealerHand: { ranks: ["K", "7"], complete: true, label: "17", suggestedOutcome: null, canEdit: false },
        dealerName: "Alex",
        actions: {
          ...bankView({}).actions,
          dealCards: false,
          scheduleDeal: false,
          nextHand: true,
          scheduleNextRound: true,
        },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain('data-dealer-box="true"');
  expect(html).toContain(">DEALER<");
  expect(html).toContain("next-round-row");
  expect(html).toContain("NEXT ROUND NOW");
  expect(html).toContain("IN 7 SECONDS");
  expect(html).not.toContain("NEXT ROUND IN 7 SECONDS");
  expect(html).toContain('data-dealer-cards="true"');
  expect(html).not.toContain("bj-rail");
  expect(html).not.toContain("DEALER WON");
  expect(html).toContain('data-blackjack-box-row="true"');
  expect(html).toContain('data-box-phase="ROUND_COMPLETE"');
  expect(html).not.toContain("class=\"box is-compact");
});

test("entered cards and compact + CARDS sit inside the dealer and player boxes", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bankView({
        phase: "PLAYING",
        phaseLabel: "PLAYING",
        primaryAction: { id: "payoutPhase", label: "PAYOUT PHASE", enabled: true },
        dealerHand: { ranks: ["A", "6"], complete: false, label: "Soft 17", suggestedOutcome: null, canEdit: true },
        dealerName: "Alex",
        boxes: [box({ hand: { ranks: ["10", "9"], complete: false, label: "19", suggestedOutcome: null, canEdit: true } })],
        players: [
          {
            userId: "p1",
            name: "Alex",
            available: { millis: "100000", label: "100" },
            locked: { millis: "25000", label: "25" },
            status: "In play",
            boxes: [box({ hand: { ranks: ["10", "9"], complete: false, label: "19", suggestedOutcome: null, canEdit: true } })],
          },
        ],
        actions: {
          ...bankView({}).actions,
          dealCards: false,
          scheduleDeal: false,
          payoutPhase: true,
        },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  const dealer = html.indexOf('data-dealer-box="true"');
  const playerBox = html.indexOf('data-blackjack-box-row="true"');
  expect(dealer).toBeGreaterThan(-1);
  expect(playerBox).toBeGreaterThan(-1);
  expect(html.indexOf("data-dealer-cards")).toBeGreaterThan(dealer);
  expect(html.lastIndexOf("data-box-cards")).toBeGreaterThan(playerBox);
  expect(html.indexOf("Soft 17")).toBeGreaterThan(dealer);
  expect(html.indexOf("HAND COMPLETE")).toBeGreaterThan(playerBox);
  expect(html.indexOf("DEALER COMPLETE")).toBeGreaterThan(dealer);
  expect(html).toContain('data-box-phase="PLAYING"');
  expect(html).not.toContain("rank-tray");
  expect(html).not.toContain("+ ADD CARDS");
  expect(html).not.toContain('class="community-cards"');
  expect(html).not.toContain("class=\"box is-compact");
});

test("Dealer uses the same compact box row in every live phase", () => {
  const phases = ["BETTING", "PLAYING", "PAYOUT", "ROUND_COMPLETE"] as const;
  for (const phase of phases) {
    const settled = phase === "ROUND_COMPLETE" ? box({ outcome: "WON", returned: { millis: "50000", label: "50" } }) : box({ insurance: null });
    const html = renderToStaticMarkup(
      createElement(ClassicBankTable, {
        view: bankView({
          phase,
          phaseLabel: phase,
          dealerHand: { ranks: phase === "BETTING" ? [] : ["K"], complete: phase === "ROUND_COMPLETE", label: phase === "BETTING" ? "" : "10", suggestedOutcome: null, canEdit: phase === "PLAYING" },
          boxes: [settled, box({ id: "2", boxNumber: 2, label: "Box 2", insurance: null, outcome: settled.outcome, returned: settled.returned })],
          players: [
            {
              userId: "p1",
              name: "Alex",
              available: { millis: "100000", label: "100" },
              locked: { millis: "25000", label: "25" },
              status: "In play",
              boxes: [settled, box({ id: "2", boxNumber: 2, label: "Box 2", insurance: null, outcome: settled.outcome, returned: settled.returned })],
            },
          ],
          actions: {
            ...bankView({}).actions,
            settleBoxes: phase === "PAYOUT",
            settleDealerWon: phase === "PAYOUT",
            dealCards: phase === "BETTING",
            payoutPhase: phase === "PLAYING",
            nextHand: phase === "ROUND_COMPLETE",
          },
        }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html.match(/data-blackjack-box-row="true"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain(`data-box-phase="${phase}"`);
    expect(html).toContain('data-dealer-box="true"');
    expect(html).toContain(">DEALER<");
    expect(html).not.toContain("betting-spot");
    expect(html).not.toContain("class=\"box is-compact");
    expect(html.match(/data-table-name="/g)?.length).toBe(1);
    if (phase === "ROUND_COMPLETE") expect(html).toContain("Won · 50");
    if (phase === "PAYOUT") expect(html).toContain("payout-access");
  }
});

