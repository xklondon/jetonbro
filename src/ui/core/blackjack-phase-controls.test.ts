import { expect, test } from "vitest";
import {
  blackjackOwnerMenu,
  blackjackDealerControls,
  blackjackDealerSetupControls,
  blackjackPhaseInstruction,
  blackjackPhaseLabel,
  blackjackPlayerControls,
  playerBoxSlotIndex,
  playerBoxSlots,
} from "./blackjack-phase-controls";
import type { BankTableView, BoxView, PlayerTableView } from "@/application/queries/views";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

const box = (overrides: Partial<BoxView> = {}): BoxView => ({
  id: "1",
  playerId: "p1",
  playerName: "Casey",
  label: "YOUR BOX 1",
  boxNumber: 1,
  bet: money("25"),
  originalStake: money("25"),
  isDoubled: false,
  isSplit: false,
  insurance: null,
  insuranceMax: money("12.5"),
  insuranceResult: null,
  outcome: null,
  returned: null,
  payoutActions: [],
  ...overrides,
});

function player(phase: PlayerTableView["phase"], extra: Partial<PlayerTableView> = {}): PlayerTableView {
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
      insurance: false,
    },
    boxes: [box()],
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
        ? { id: "dealCards", label: "CLOSE BETTING", enabled: true }
        : phase === "PLAYING"
          ? { id: "payoutPhase", label: "ENTER PAYOUT", enabled: true }
          : { id: "nextHand", label: "START NEXT ROUND", enabled: false },
    boxes: [box({ label: "1" })],
    playerCount: 1,
    boxCount: 1,
    lockedOrdinary: money("25"),
    insurance: { window: "CLOSED", total: money("0", "0"), count: 0, resolution: null },
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    hasValidBet: true,
    players: [],
    isOwner: true,
    tableStatus: "ACTIVE",
    paused: false,
    closePreview: null,
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
      addPlayer: phase === "BETTING",
      giveJetons: phase === "BETTING",
      changeBank: false,
      saveTable: true,
      closeTable: false,
      switchGame: false,
    },
    insuranceSettleActions: [],
    ...extra,
  };
}

test("role and phase copy stays compact and never uses Waiting for players during Betting", () => {
  expect(blackjackPhaseLabel({ role: "DEALER", phase: "TABLE_SETUP" })).toBe("Table setup");
  expect(blackjackPhaseLabel({ role: "PLAYER", phase: "TABLE_SETUP" })).toBe("Waiting for the table to open betting.");
  expect(blackjackPhaseLabel({ role: "DEALER", phase: "BETTING" })).toBe("BETTING");
  expect(blackjackPhaseLabel({ role: "PLAYER", phase: "BETTING" })).toBe("BETTING");
  expect(blackjackPhaseLabel({ role: "PLAYER", phase: "BETTING", hasStake: true })).toBe("BETTING");
  expect(blackjackPhaseInstruction({ role: "PLAYER", phase: "TABLE_SETUP" })).not.toMatch(/waiting for players/i);
  expect(blackjackPhaseInstruction({ role: "PLAYER", phase: "BETTING" })).not.toMatch(/waiting for players/i);
  expect(blackjackPhaseInstruction({ role: "DEALER", phase: "TABLE_SETUP" })).not.toMatch(/waiting for players/i);
});

test("Dealer Phase 0 / Betting / Playing / Payout labels follow the canonical matrix", () => {
  expect(blackjackPhaseLabel({ role: "DEALER", phase: "TABLE_SETUP" })).toBe("Table setup");
  const betting = blackjackDealerControls(bank("BETTING"));
  expect(betting.phaseLabel).toBe("BETTING");
  expect(betting.primary?.label).toBe("DEAL CARDS");
  expect(betting.showAddPlayer).toBe(true);
  const playing = blackjackDealerControls(bank("PLAYING"));
  expect(playing.phaseLabel).toBe("PLAYING");
  expect(playing.primary?.label).toBe("ENTER PAYOUT");
  expect(playing.insurance?.label).toBe("OPEN INSURANCE");
  expect(playing.showAddPlayer).toBe(false);
  const insOpen = blackjackDealerControls(
    bank("PLAYING", {
      insurance: { window: "OPEN", total: money("0", "0"), count: 0, resolution: null },
      actions: { ...bank("PLAYING").actions, openInsurance: false, closeInsurance: true },
    }),
  );
  expect(insOpen.insurance?.label).toBe("CLOSE INSURANCE");
  expect(insOpen.insurance?.id).toBe("closeInsurance");
  const payout = blackjackDealerControls(bank("PAYOUT"));
  expect(payout.phaseLabel).toBe("PAYOUT");
  expect(payout.primary?.label).toBe("START BETTING");
  expect(payout.primary?.enabled).toBe(false);
  expect(payout.primary?.command).toBe("startNextRound");
  const ready = blackjackDealerControls(
    bank("PAYOUT", { primaryAction: { id: "nextHand", label: "START NEXT ROUND", enabled: true } }),
  );
  expect(ready.primary?.enabled).toBe(true);
  const setup = blackjackDealerSetupControls(false);
  expect(setup.primary?.label).toBe("START BETTING");
  expect(setup.primary?.enabled).toBe(false);
  expect(setup.showAddPlayer).toBe(true);
  expect(blackjackDealerSetupControls(true).primary?.enabled).toBe(true);
});

test("Player controls are legal-only by phase", () => {
  const betting = blackjackPlayerControls(player("BETTING"), box());
  expect(betting.placeBet).toBe(true);
  expect(betting.retract).toBe(true);
  expect(betting.addBox).toBe(true);
  expect(betting.double).toBe(false);
  expect(betting.insurance).toBe(false);
  expect(betting.trayEnabled).toBe(true);
  const empty = blackjackPlayerControls(player("BETTING"), box({ bet: money("0", "0") }));
  expect(empty.retract).toBe(false);
  const noBox = blackjackPlayerControls(player("BETTING", { actions: { ...player("BETTING").actions, addBox: false } }), box());
  expect(noBox.addBox).toBe(false);
  const playing = blackjackPlayerControls(player("PLAYING"), box());
  expect(playing.placeBet).toBe(false);
  expect(playing.addBox).toBe(false);
  expect(playing.double).toBe(true);
  expect(playing.split).toBe(true);
  expect(playing.insurance).toBe(false);
  expect(playing.trayEnabled).toBe(false);
  const ins = blackjackPlayerControls(
    player("PLAYING", { insuranceWindowOpen: true, actions: { ...player("PLAYING").actions, insurance: true } }),
    box(),
  );
  expect(ins.phaseLabel).toBe("INSURANCE OPEN");
  expect(ins.insurance).toBe(true);
  expect(ins.double).toBe(true);
  const payout = blackjackPlayerControls(player("PAYOUT"), box());
  expect(payout.payoutIdle).toBe(true);
  expect(payout.placeBet).toBe(false);
  expect(payout.double).toBe(false);
  expect(payout.insurance).toBe(false);
  expect(payout.trayEnabled).toBe(false);
});

test("Owner dealer/game chrome is interactive only at safe Blackjack boundaries", () => {
  expect(
    blackjackOwnerMenu({ isOwner: true, phase: "BETTING", changeDealer: true, changeGame: true, payoutResolved: false }),
  ).toEqual({ changeDealer: true, changeGame: true });
  expect(
    blackjackOwnerMenu({ isOwner: true, phase: "PLAYING", changeDealer: true, changeGame: true }),
  ).toEqual({ changeDealer: false, changeGame: false });
  expect(
    blackjackOwnerMenu({
      isOwner: true,
      phase: "PAYOUT",
      changeDealer: true,
      changeGame: true,
      payoutResolved: false,
    }),
  ).toEqual({ changeDealer: false, changeGame: false });
  expect(
    blackjackOwnerMenu({
      isOwner: true,
      phase: "PAYOUT",
      changeDealer: true,
      changeGame: true,
      payoutResolved: true,
    }),
  ).toEqual({ changeDealer: true, changeGame: true });
  expect(
    blackjackOwnerMenu({ isOwner: false, phase: "BETTING", changeDealer: true, changeGame: true }),
  ).toEqual({ changeDealer: false, changeGame: false });
});

test("three-slot stage centres Box 1 then fills left then right", () => {
  expect(playerBoxSlotIndex(1)).toBe(1);
  expect(playerBoxSlotIndex(2)).toBe(0);
  expect(playerBoxSlotIndex(3)).toBe(2);
  const one = playerBoxSlots([box({ boxNumber: 1 })]);
  expect(one.slots[0]).toBeNull();
  expect(one.slots[1]?.boxNumber).toBe(1);
  expect(one.slots[2]).toBeNull();
  const two = playerBoxSlots([box({ id: "1", boxNumber: 1 }), box({ id: "2", boxNumber: 2 })]);
  expect(two.slots[0]?.id).toBe("2");
  expect(two.slots[1]?.id).toBe("1");
  expect(two.slots[2]).toBeNull();
});
