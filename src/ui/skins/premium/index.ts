"use client";

import "./premium.css";
import { createElement } from "react";
import type { JetonBroSkin } from "../types";
import { PremiumBlackjackPlayer as PlayerTable } from "./components/PremiumBlackjackPlayer";
import { PremiumBlackjackDealer as BankTable } from "./components/PremiumBlackjackDealer";
import { PremiumBlackjackWaiting as WaitingTable } from "./components/PremiumBlackjackWaiting";
import { PremiumPokerDealer as PokerDealer } from "./components/PremiumPokerDealer";
import { PremiumPokerPlayer as PokerPlayer } from "./components/PremiumPokerPlayer";
import { PremiumHome as Home } from "./components/PremiumHome";
import { PremiumCreateTable as CreateTable } from "./components/PremiumCreateTable";
import { PremiumShell } from "./components/PremiumShell";
import { CasinoDock } from "./components/primitives/CasinoDock";

/** Setup adapter — same props as registry interface; unused until Milestone 2. */
const SetupTable: JetonBroSkin["SetupTable"] = ({ view, onCommand, notice }) =>
  createElement(BankTable, {
    view: {
      role: "BANK",
      phase: "TABLE_SETUP",
      tableName: view.tableName,
      title: "",
      copy: "",
      phaseLabel: "TABLE SETUP",
      primaryAction: { id: "nextHand", label: "START BETTING", enabled: view.canStartBetting },
      boxes: [],
      players: view.members
        .filter((m) => !m.isBankDealer)
        .map((m) => ({
          userId: m.userId,
          name: m.name,
          available: m.available ?? { millis: "0", label: "0" },
          locked: { millis: "0", label: "0" },
          status: "Waiting",
          boxes: [],
        })),
      playerCount: view.members.filter((m) => !m.isBankDealer).length,
      boxCount: 0,
      lockedOrdinary: { millis: "0", label: "0" },
      insurance: { window: "CLOSED", total: { millis: "0", label: "0" }, count: 0, resolution: null },
      actions: {
        dealCards: false,
        scheduleDeal: false,
        payoutPhase: false,
        nextHand: view.canStartBetting,
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
        switchGame: Boolean(view.canSwitchGame),
      },
      insuranceSettleActions: [],
      bettingCloseDeadlineAt: null,
      nextRoundDeadlineAt: null,
      hasValidBet: false,
      isOwner: view.isOwner,
      tableStatus: view.tableStatus,
      paused: view.paused,
      closePreview: view.closePreview,
      dealerName: view.bankName || view.ownerName,
      guestJoinUrl: view.guestJoinUrl,
      verifiedJoinUrl: view.verifiedJoinUrl,
      canStartBetting: view.canStartBetting,
      emailConfigured: view.emailConfigured,
      startingJetons: view.startingJetonsPerPlayer,
      gameSession: view.gameSession,
    },
    members: view.members,
    onCommand,
    notice,
  });

const Entry: JetonBroSkin["Entry"] = ({ title, copy, actionLabel, onSubmit, notice }) =>
  createElement(
    PremiumShell,
    {
      title,
      dock: createElement(CasinoDock, {
        primary: { label: actionLabel, onClick: () => void onSubmit({}) },
      }),
    },
    createElement(
      "div",
      { className: "pm-panel" },
      createElement("h1", null, title),
      createElement("p", null, copy),
      notice ? createElement("p", null, notice) : null,
    ),
  );

const PhaseZero: JetonBroSkin["PhaseZero"] = ({
  setup,
  waiting,
  poker,
  members,
  onCommand,
  notice,
  isBank,
  game,
}) => {
  if (game === "POKER" && poker) {
    return isBank
      ? createElement(PokerDealer, { view: poker, members, onCommand, notice })
      : createElement(PokerPlayer, { view: poker, onCommand, notice });
  }
  if (waiting && !isBank) return createElement(WaitingTable, { view: waiting });
  if (setup) return createElement(SetupTable, { view: setup, onCommand, notice });
  return null;
};

/**
 * Premium skin object — same component props as JetonBroSkin.
 * Not registered / not ACTIVE until Milestone 2 approval.
 */
export const premiumSkin = {
  id: "premium" as const,
  name: "Premium",
  PlayerTable,
  BankTable,
  SetupTable,
  WaitingTable,
  PokerDealer,
  PokerPlayer,
  Entry,
  Home,
  CreateTable,
  PhaseZero,
};

export type PremiumSkin = typeof premiumSkin;
export {
  PlayerTable,
  BankTable,
  WaitingTable,
  PokerDealer,
  PokerPlayer,
  Home,
  CreateTable,
};
