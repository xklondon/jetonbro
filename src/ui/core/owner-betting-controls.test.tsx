import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ClassicBankTable } from "@/ui/skins/classic/components/ClassicBankTable";
import { ClassicPlayerTable } from "@/ui/skins/classic/components/ClassicPlayerTable";
import { blackjackOwnerMenu } from "@/ui/core/blackjack-phase-controls";
import type { BankTableView, BoxView, MemberView, PlayerTableView } from "@/application/queries/views";

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
    name: "Sam",
    email: "sam@example.com",
    isOwner: false,
    isBankDealer: false,
    available: { millis: "100000", label: "100" },
  },
];

const box: BoxView = {
  id: "1",
  playerId: "p1",
  playerName: "Sam",
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
  payoutActions: [],
};

function bank(overrides: Partial<BankTableView> = {}): BankTableView {
  return {
    role: "BANK",
    phase: "BETTING",
    tableName: "Salon",
    title: "Take bets",
    copy: "Close when ready",
    phaseLabel: "BETTING",
    primaryAction: { id: "dealCards", label: "DEAL CARDS", enabled: true },
    boxes: [box],
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
        name: "Sam",
        available: { millis: "100000", label: "100" },
        locked: { millis: "25000", label: "25" },
        status: "Betting",
        boxes: [box],
      },
    ],
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
      switchGame: true,
    },
    insuranceSettleActions: [],
    ...overrides,
  };
}

function player(overrides: Partial<PlayerTableView> = {}): PlayerTableView {
  return {
    role: "PLAYER",
    phase: "BETTING",
    tableName: "Salon",
    title: "Place your bets",
    copy: "",
    available: { millis: "75000", label: "75" },
    insuranceWindowOpen: false,
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    isOwner: false,
    canSwitchGame: false,
    actions: {
      bet: true,
      retract: true,
      addBox: true,
      removeEmptyBox: false,
      double: false,
      split: false,
      insurance: false,
    },
    boxes: [box],
    ...overrides,
  };
}

test("Owner sees Change Dealer and Change Game during eligible Betting", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, { view: bank(), members, onCommand: () => undefined }),
  );
  expect(html).toContain('data-owner-change-dealer="true"');
  expect(html).toContain('data-owner-change-game="true"');
  expect(html).toContain("DEAL CARDS");
  expect(html).toContain("ADD PLAYER");
  expect(html.indexOf("DEAL CARDS")).toBeLessThan(html.indexOf("ADD PLAYER"));
  expect(html).not.toMatch(/data-dealer-dock[\s\S]*Change Dealer/);
  expect(html).not.toMatch(/data-dealer-dock[\s\S]*Change Game/);
});

test("Dealer who is not Owner does not see Owner controls", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bank({
        isOwner: false,
        actions: { ...bank().actions, changeBank: false, switchGame: false },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain('data-owner-change-dealer="false"');
  expect(html).toContain('data-owner-change-game="false"');
});

test("Player does not see Owner controls", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: player(),
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
      members,
    }),
  );
  expect(html).not.toContain("data-owner-menu");
  expect(html).not.toContain("Change Dealer");
  expect(html).not.toContain("Change Game");
});

test("Owner Player surface exposes the same Betting menu flags", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: player({ isOwner: true, canSwitchGame: true }),
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
      members,
    }),
  );
  expect(html).toContain('data-owner-change-dealer="true"');
  expect(html).toContain('data-owner-change-game="true"');
});

test("Owner controls are absent during unsafe Playing and Payout", () => {
  expect(blackjackOwnerMenu({ isOwner: true, phase: "PLAYING", changeDealer: true, changeGame: true })).toEqual({
    changeDealer: false,
    changeGame: false,
  });
  expect(blackjackOwnerMenu({ isOwner: true, phase: "PAYOUT", changeDealer: true, changeGame: true })).toEqual({
    changeDealer: false,
    changeGame: false,
  });
  const playing = renderToStaticMarkup(
    createElement(ClassicBankTable, {
      view: bank({
        phase: "PLAYING",
        actions: { ...bank().actions, changeBank: false, switchGame: false, dealCards: false, payoutPhase: true },
      }),
      members,
      onCommand: () => undefined,
    }),
  );
  expect(playing).toContain('data-owner-change-dealer="false"');
  expect(playing).toContain('data-owner-change-game="false"');
});

test("Switch Game stays on the existing confirmation path and commands", () => {
  const bankSource = readFileSync(join(process.cwd(), "src/ui/skins/classic/components/ClassicBankTable.tsx"), "utf8");
  const playerSource = readFileSync(join(process.cwd(), "src/ui/skins/classic/components/ClassicPlayerTable.tsx"), "utf8");
  for (const source of [bankSource, playerSource]) {
    expect(source).toContain('setSheet("game")');
    expect(source).toContain("Switch game");
    expect(source).toContain("SWITCH TO TEXAS HOLD’EM");
    expect(source).toContain('onCommand("switchGame"');
    expect(source).toContain('onCommand("assignBank"');
  }
});
