import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BankTableView, MemberView } from "@/application/queries/views";
import { PremiumBlackjackDealer } from "./PremiumBlackjackDealer";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

const members: MemberView[] = [
  {
    userId: "owner-1",
    name: "Owner",
    email: "owner@test.local",
    isOwner: true,
    isBankDealer: true,
    available: money("500"),
  },
  {
    userId: "p1",
    name: "Casey",
    email: "casey@test.local",
    isOwner: false,
    isBankDealer: false,
    available: money("100"),
  },
];

function bank(overrides: Partial<BankTableView> = {}): BankTableView {
  return {
    role: "BANK",
    phase: "BETTING",
    tableName: "Emerald",
    title: "",
    copy: "",
    phaseLabel: "BETTING",
    primaryAction: { id: "dealCards", label: "DEAL CARDS", enabled: true },
    boxes: [
      {
        id: "b1",
        playerId: "p1",
        playerName: "Casey",
        label: "Box 1",
        boxNumber: 1,
        bet: money("25"),
        originalStake: money("25"),
        isDoubled: false,
        isSplit: false,
        insurance: null,
        insuranceMax: money("0"),
        insuranceResult: null,
        outcome: null,
        returned: null,
        payoutActions: [],
      },
    ],
    players: [
      {
        userId: "p1",
        name: "Casey",
        available: money("75"),
        locked: money("25"),
        status: "Ready",
        boxes: [],
      },
    ],
    playerCount: 1,
    boxCount: 1,
    lockedOrdinary: money("25"),
    insurance: { window: "CLOSED", total: money("0"), count: 0, resolution: null },
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
      closeTable: true,
      switchGame: true,
    },
    insuranceSettleActions: [],
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    hasValidBet: true,
    allBetsConfirmed: true,
    isOwner: true,
    tableStatus: "ACTIVE",
    paused: false,
    closePreview: null,
    dealerName: "Owner",
    canSwitchGame: true,
    guestJoinUrl: "https://example.test/g",
    verifiedJoinUrl: "https://example.test/v",
    ...overrides,
  };
}

describe("PremiumBlackjackDealer owner chrome", () => {
  it("setup after allocation shows seat jetons on the felt", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackDealer, {
        view: bank({
          phase: "TABLE_SETUP",
          boxes: [],
          players: [
            {
              userId: "p1",
              name: "Casey",
              available: money("100"),
              locked: money("0"),
              status: "Joined",
              boxes: [],
            },
          ],
          primaryAction: { id: "openBetting", label: "OPEN BETTING", enabled: true },
          actions: {
            ...bank().actions,
            dealCards: false,
            giveJetons: true,
          },
          hasValidBet: false,
        }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain('data-box-available="true"');
    expect(html).toContain("AVAILABLE");
    expect(html).toContain("Casey");
    expect(html).not.toContain('data-seat-bankroll="true"');
    expect(html).not.toContain("STACK");
  });

  it("shows Change Game in Betting tray and interactive Owner/Dealer badges", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackDealer, {
        view: bank(),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain('data-change-game="true"');
    expect(html).toContain("CHANGE GAME");
    expect(html).toContain('data-owner-badge="true"');
    expect(html).toContain('data-dealer-badge="true"');
    expect(html).toContain('data-owner-change-dealer="true"');
    expect(html).toContain('data-owner-change-game="true"');
    expect(html).toContain("ADD PLAYER");
  });

  it("keeps Change Game visible but blocked until payout boxes are settled", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackDealer, {
        view: bank({
          phase: "PAYOUT",
          primaryAction: { id: "nextHand", label: "START BETTING", enabled: false },
          actions: {
            ...bank().actions,
            dealCards: false,
            switchGame: false,
            settleBoxes: true,
            addPlayer: false,
            nextHand: false,
            changeBank: false,
          },
          canSwitchGame: false,
          switchBlockedReason: "Finish or clear the current hand before switching games",
          boxes: [
            {
              ...bank().boxes[0]!,
              outcome: null,
            },
            {
              ...bank().boxes[0]!,
              id: "b2",
              boxNumber: 2,
              label: "Box 2",
              outcome: null,
            },
          ],
        }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain("ADD PLAYER");
    expect(html).toContain("CHANGE GAME");
    expect(html).toContain('data-change-game-blocked="true"');
    expect(html).toContain("Finish or clear the current hand before switching games");
    expect(html).toContain('data-owner-change-game="false"');
    expect(html).toContain('data-payout-resolved="false"');
  });

  it("enables Change Game after every box is settled", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackDealer, {
        view: bank({
          phase: "PAYOUT",
          primaryAction: { id: "nextHand", label: "START BETTING", enabled: true },
          actions: {
            ...bank().actions,
            dealCards: false,
            switchGame: true,
            settleBoxes: true,
            nextHand: true,
            changeBank: true,
          },
          canSwitchGame: true,
          boxes: [
            { ...bank().boxes[0]!, outcome: "WON" },
            { ...bank().boxes[0]!, id: "b2", boxNumber: 2, label: "Box 2", outcome: "LOST" },
          ],
        }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain('data-owner-change-game="true"');
    expect(html).toContain('data-payout-resolved="true"');
    expect(html).not.toContain('data-change-game-blocked="true"');
  });

  it("uses the existing switchGame blinds / seat-order command path", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/ui/skins/premium/components/PremiumBlackjackDealer.tsx"), "utf8");
    expect(source).toContain('onCommand("switchGame"');
    expect(source).toContain("smallBlind");
    expect(source).toContain("bigBlind");
    expect(source).toContain("seatOrder");
    expect(source).toContain("CONFIRM CHANGE");
    expect(source).toContain("resetBalances");
    expect(source).toContain('onCommand("assignBank"');
  });

  it("wires settleInsurance through the payout overlay when insurance is unresolved", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackDealer, {
        view: bank({
          phase: "PAYOUT",
          primaryAction: { id: "nextHand", label: "START BETTING", enabled: false },
          actions: {
            ...bank().actions,
            dealCards: false,
            settleBoxes: true,
            settleInsurance: true,
            nextHand: false,
            addPlayer: false,
          },
          boxes: [
            {
              ...bank().boxes[0]!,
              outcome: "LOST",
              insurance: money("12.5"),
              insuranceResult: null,
            },
          ],
          insurance: { window: "CLOSED", total: money("12.5"), count: 1, resolution: null },
          insuranceSettleActions: [
            { id: "DEALER_BLACKJACK", label: "INSURANCE WON" },
            { id: "NO_DEALER_BLACKJACK", label: "INSURANCE LOST" },
          ],
        }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain('data-insurance-action="won"');
    expect(html).toContain('data-insurance-action="lost"');
    expect(html).toContain("INS PLACED");
    expect(html).toContain('data-insurance-pending="true"');
  });

  it("uses the existing settleInsurance command path", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/ui/skins/premium/components/PremiumBlackjackDealer.tsx"), "utf8");
    expect(source).toContain('onCommand("settleInsurance"');
    expect(source).toContain("resolution");
  });

  it("DEAL CARDS readiness is advisory blue/orange and stays actionable when unconfirmed", () => {
    const ready = renderToStaticMarkup(
      createElement(PremiumBlackjackDealer, {
        view: bank({ allBetsConfirmed: true }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(ready).toContain("DEAL CARDS");
    expect(ready).toContain('data-bj-phase-action="deal-cards"');
    expect(ready).toContain('data-bj-bets-ready="true"');
    expect(ready).toContain('data-bj-dealer-slots="true"');
    expect(ready).toContain('data-bj-slot="right"');
    expect(ready).not.toMatch(/data-bj-phase-action="deal-cards"[^>]*disabled/);
    expect(ready).not.toContain("DEALER CARDS");
    expect(ready).not.toContain('data-bj-inline-cards="true"');
    expect(ready).not.toContain("ADD CARDS");

    const pending = renderToStaticMarkup(
      createElement(PremiumBlackjackDealer, {
        view: bank({ allBetsConfirmed: false }),
        members,
        onCommand: () => undefined,
      }),
    );
    expect(pending).toContain("DEAL CARDS");
    expect(pending).toContain('data-bj-bets-ready="false"');
    expect(pending).toContain('data-bj-dealer-slots="true"');
    expect(pending).not.toMatch(/data-bj-phase-action="deal-cards"[^>]*disabled/);
    expect(pending).not.toContain("DEALER CARDS");
  });

  it("keeps the progression button in the fixed right slot across phases", () => {
    const phases: Array<Partial<BankTableView>> = [
      {
        phase: "TABLE_SETUP",
        primaryAction: { id: "openBetting", label: "START HAND", enabled: true },
        actions: { ...bank().actions, dealCards: false },
        boxes: [],
        hasValidBet: false,
      },
      { phase: "BETTING", allBetsConfirmed: true },
      {
        phase: "PLAYING",
        primaryAction: { id: "enterPayout", label: "ENTER PAYOUT", enabled: true },
        actions: { ...bank().actions, dealCards: false, payoutPhase: true },
      },
      {
        phase: "ROUND_COMPLETE",
        primaryAction: { id: "nextHand", label: "START NEXT ROUND", enabled: true },
        actions: { ...bank().actions, dealCards: false, nextHand: true },
      },
    ];
    for (const overrides of phases) {
      const html = renderToStaticMarkup(
        createElement(PremiumBlackjackDealer, {
          view: bank(overrides),
          members,
          onCommand: () => undefined,
        }),
      );
      expect(html).toContain('data-bj-dealer-slots="true"');
      expect(html).toContain('data-bj-slot="right"');
      expect(html).toMatch(/data-bj-slot="right"[^>]*>[\s\S]*?data-bj-phase-action=/);
    }
  });
});
