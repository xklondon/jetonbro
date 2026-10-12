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
    expect(source).toContain("SWITCH TO TEXAS HOLD’EM");
    expect(source).toContain('onCommand("assignBank"');
  });
});
