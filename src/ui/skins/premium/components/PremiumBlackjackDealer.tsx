"use client";

import { useState, type ReactNode } from "react";
import type { BankTableView, BoxView, MemberView } from "@/application/queries/views";
import type { BoxOutcome } from "@/domain/blackjack/payouts";
import { blackjackDealerControls, blackjackOwnerMenu } from "@/ui/core/blackjack-phase-controls";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { orderBoxesForFelt } from "./blackjackBoxOrder";
import { PremiumCelebrationSettings } from "./PremiumCelebrationSettings";
import { PremiumGiveJetonsMask } from "./PremiumGiveJetonsMask";
import { PremiumInviteMask } from "./PremiumInviteMask";
import { PremiumShell } from "./PremiumShell";
import { CasinoConsole } from "./primitives/CasinoConsole";
import { BlackjackTable } from "./primitives/BlackjackTable";
import { BlackjackBox, setupSeatBox } from "./primitives/BlackjackBox";
import { BlackjackPayoutOverlay } from "./primitives/BlackjackSettlementBar";

type Sheet = "closed" | "menu" | "dealer" | "pick" | "poker" | "exit";

function activeBoxes(view: BankTableView): BoxView[] {
  const fromPlayers = view.players.flatMap((player) => player.boxes);
  return fromPlayers.length > 0 ? fromPlayers : view.boxes;
}

function seated(view: BankTableView) {
  return view.players.filter((player) => Boolean(player.userId));
}

function boxesReady(view: BankTableView) {
  const boxes = activeBoxes(view);
  return boxes.length > 0 && boxes.every((box) => Boolean(box.outcome));
}

/** Setup: one visible box per joined player (factual boxes when present). */
function setupDisplayBoxes(view: BankTableView): BoxView[] {
  const joined = seated(view);
  if (joined.length === 0) return [];
  const out: BoxView[] = [];
  let n = 1;
  for (const player of joined) {
    if (player.boxes.length > 0) {
      out.push(...orderBoxesForFelt(player.boxes));
      n = Math.max(n, ...player.boxes.map((b) => b.boxNumber + 1));
    } else {
      out.push(setupSeatBox(player, n));
      n += 1;
    }
  }
  return orderBoxesForFelt(out);
}

export function PremiumBlackjackDealer({
  view,
  members,
  onCommand,
  notice,
}: {
  view: BankTableView;
  members: MemberView[];
  onCommand: CommandHandler;
  notice?: string | null;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);
  const [fxSettingsOpen, setFxSettingsOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>("closed");
  const [smallBlind, setSmallBlind] = useState("1");
  const [bigBlind, setBigBlind] = useState("2");
  const [resetBalances, setResetBalances] = useState(false);
  const [dealerId, setDealerId] = useState(
    () => members.find((member) => member.isBankDealer)?.userId ?? members[0]?.userId ?? "",
  );
  const controls = blackjackDealerControls(view);
  const joined = seated(view);
  const boxes = activeBoxes(view);
  const staged = orderBoxesForFelt(boxes);
  const setup = view.phase === "TABLE_SETUP";
  const payout = view.phase === "PAYOUT";
  const roundComplete = view.phase === "ROUND_COMPLETE";
  const betweenHands = payout || roundComplete;
  const betting = view.phase === "BETTING";
  const play = betting || view.phase === "PLAYING";
  const payoutResolved = boxesReady(view);
  const ownerMenu = blackjackOwnerMenu({
    isOwner: view.isOwner,
    phase: view.phase,
    changeDealer: view.actions.changeBank || setup,
    changeGame: view.actions.switchGame || Boolean(view.canSwitchGame),
    insuranceOpen: view.insurance.window === "OPEN",
    payoutResolved,
  });
  const phaseCopy = blackjackPhaseCopy({
    role: "DEALER",
    phase: view.phase,
    insuranceOpen: view.insurance.window === "OPEN",
    seatedPlayerCount: joined.length,
  });

  // Owner INVITE stays available between hands / betting / payout — server still enforces owner-only.
  const showAddPlayer = Boolean(view.isOwner && (setup || betting || betweenHands));
  const showGiveJetons = Boolean(view.isOwner && view.actions.giveJetons && (setup || betting));
  const showSaveTable = Boolean(view.isOwner && view.actions.saveTable && (setup || betting));
  /** Tray Change Game: Setup / between hands; during BETTING the trio is ADD / TOP UP / SAVE — Change Game stays on badge + owner menu. */
  const showChangeGame =
    view.isOwner &&
    (setup || betweenHands) &&
    (ownerMenu.changeGame || payout);
  const changeGameEnabled = ownerMenu.changeGame;
  const changeGameReason =
    !changeGameEnabled && payout
      ? view.switchBlockedReason || "Settle every box before switching games"
      : null;

  function openChangeGame() {
    if (!changeGameEnabled) return;
    setResetBalances(false);
    setSheet("pick");
  }

  const showExit = Boolean(view.actions.leaveTable && (setup || view.phase === "ROUND_COMPLETE"));

  function openDealer() {
    if (!ownerMenu.changeDealer) return;
    setDealerId(members.find((member) => member.isBankDealer)?.userId ?? members[0]?.userId ?? "");
    setSheet("dealer");
  }

  function openOwnerMenu() {
    setSheet("menu");
  }

  const badges = (
    <>
      {view.isOwner ? (
        <button
          type="button"
          className="pm-badge is-action"
          data-owner-badge="true"
          aria-label="Owner menu"
          onClick={openOwnerMenu}
        >
          OWNER
        </button>
      ) : null}
      <button
        type="button"
        className={`pm-badge${ownerMenu.changeDealer ? " is-action" : ""}`}
        data-dealer-badge="true"
        data-owner-change-dealer={ownerMenu.changeDealer ? "true" : "false"}
        aria-label={ownerMenu.changeDealer ? "Change dealer" : "Dealer"}
        disabled={!ownerMenu.changeDealer}
        onClick={openDealer}
      >
        DEALER
      </button>
      {view.isOwner && (ownerMenu.changeGame || payout) ? (
        <button
          type="button"
          className={`pm-badge is-action${changeGameEnabled ? "" : " is-disabled"}`}
          data-owner-change-game={changeGameEnabled ? "true" : "false"}
          data-change-game-badge="true"
          aria-label={
            changeGameEnabled
              ? "Switch to Poker"
              : changeGameReason ?? "Change game unavailable"
          }
          title={changeGameReason ?? undefined}
          disabled={!changeGameEnabled}
          onClick={openChangeGame}
        >
          {changeGameEnabled ? "POKER" : "GAME"}
        </button>
      ) : null}
      {showSaveTable && betting ? (
        <button
          type="button"
          className="pm-badge is-action"
          data-save-table-badge="true"
          aria-label="Save table"
          onClick={() => void onCommand("saveTable")}
        >
          SAVE
        </button>
      ) : null}
    </>
  );

  let layer: ReactNode = null;
  if (setup) {
    const seats = setupDisplayBoxes(view);
    const shownAvailable = new Set<string>();
    layer =
      seats.length > 0 ? (
        seats.map((box) => {
          const player = joined.find((item) => item.userId === box.playerId);
          const showAvailableOnce = Boolean(player?.userId) && !shownAvailable.has(player!.userId);
          if (showAvailableOnce && player?.userId) shownAvailable.add(player.userId);
          return (
            <BlackjackBox
              key={box.id}
              box={box}
              showPlayerName
              bankroll={player?.available ?? null}
              showAvailable={showAvailableOnce}
            />
          );
        })
      ) : (
        <p className="pm-bj-empty" data-dealer-empty="true">
          Waiting for players
        </p>
      );
  } else if (payout && boxes.length > 0) {
    layer = (
      <BlackjackPayoutOverlay
        boxes={boxes}
        enabled={controls.showPayoutResults}
        insuranceSettleEnabled={controls.showInsuranceSettle}
        onSettle={(boxId, outcome: BoxOutcome) => void onCommand("settleBox", { boxId, outcome })}
        onSettleInsurance={(resolution) => void onCommand("settleInsurance", { resolution })}
      />
    );
  } else if ((play || roundComplete) && staged.length > 0) {
    const shownAvailable = new Set<string>();
    layer = staged.map((box) => {
      const player = joined.find((item) => item.userId === box.playerId);
      const showAvailableOnce = Boolean(player?.userId) && !shownAvailable.has(player!.userId);
      if (showAvailableOnce && player?.userId) shownAvailable.add(player.userId);
      return (
        <BlackjackBox
          key={box.id}
          box={box}
          showPlayerName
          bankroll={player?.available ?? null}
          showAvailable={showAvailableOnce}
          nextRoundLabel={
            roundComplete && box.nextRoundBet?.label && box.nextRoundBet.label !== "0"
              ? box.nextRoundBet.label
              : null
          }
        />
      );
    });
  } else if (!setup) {
    layer = (
      <p className="pm-bj-empty" data-dealer-empty="true">
        Waiting for the first wager.
      </p>
    );
  }

  /*
   * Compact dealer trio — CasinoConsole dealerSlots paints tertiary|secondary|primary
   * as left|centre|right. BETTING target: ADD PLAYER | TOP UP | DEAL.
   * SAVE TABLE via SAVE badge + owner menu (no 4th slot / no tray growth).
   */
  const tertiary = showChangeGame
    ? {
        label: "CHANGE GAME",
        disabled: !changeGameEnabled,
        title: changeGameReason ?? undefined,
        onClick: openChangeGame,
      }
    : showAddPlayer
      ? { label: "ADD PLAYER", onClick: () => setInviteOpen(true) }
      : showGiveJetons
        ? { label: "TOP UP", onClick: () => setGiveOpen(true) }
        : showSaveTable
          ? { label: "SAVE TABLE", onClick: () => void onCommand("saveTable") }
          : showExit
            ? { label: "EXIT TABLE", onClick: () => setSheet("exit") }
            : null;

  const dockBanner =
    changeGameReason && showChangeGame && !changeGameEnabled ? (
      <div className="pm-bj-dock-banner" data-change-game-blocked="true">
        {changeGameReason}
      </div>
    ) : null;

  return (
    <PremiumShell
      title="JETONBRO"
      badges={badges}
      onMenu={view.isOwner ? openOwnerMenu : undefined}
      board="BLACKJACK_DEALER"
      dock={
        <CasinoConsole
          variant={setup ? "setup" : "blackjack"}
          dealerSlots
          notice={notice ? <div className="pm-console-notice">{notice}</div> : null}
          primary={
            controls.primary
              ? {
                  label: controls.primary.label,
                  disabled: !controls.primary.enabled,
                  betsReady:
                    controls.primary.id === "dealCards" ? Boolean(view.allBetsConfirmed) : undefined,
                  onClick: () => void onCommand(controls.primary!.command),
                }
              : null
          }
          secondary={
            // When Change Game occupies left (tertiary), keep ADD PLAYER in centre.
            showChangeGame && showAddPlayer
              ? { label: "ADD PLAYER", onClick: () => setInviteOpen(true) }
              : showGiveJetons && showAddPlayer
                ? { label: "TOP UP", onClick: () => setGiveOpen(true) }
                : controls.insurance
                  ? {
                      label: controls.insurance.label,
                      disabled: !controls.insurance.enabled,
                      onClick: () => void onCommand(controls.insurance!.command),
                    }
                  : showGiveJetons
                    ? { label: "TOP UP", onClick: () => setGiveOpen(true) }
                    : showSaveTable && !showAddPlayer
                      ? { label: "SAVE TABLE", onClick: () => void onCommand("saveTable") }
                      : null
          }
          tertiary={tertiary}
        />
      }
    >
      {dockBanner}
      <div
        hidden
        data-owner-menu="true"
        data-owner-change-dealer={ownerMenu.changeDealer ? "true" : "false"}
        data-owner-change-game={ownerMenu.changeGame ? "true" : "false"}
        data-payout-resolved={payoutResolved ? "true" : "false"}
      />
      <BlackjackTable
        tableName={view.tableName}
        phaseLabel={phaseCopy.primary}
        phaseInstruction={phaseCopy.instruction}
        dealerName={view.dealerName || "Dealer"}
        setup={setup}
        layout={payout ? "payout" : "play"}
      >
        {layer}
      </BlackjackTable>
      <PremiumInviteMask
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        guestJoinUrl={view.guestJoinUrl}
        verifiedJoinUrl={view.verifiedJoinUrl}
        emailConfigured={view.emailConfigured !== false}
        startingJetons={view.startingJetons?.label ?? "100"}
        members={members}
        onCommand={onCommand}
        notice={notice}
      />
      <PremiumGiveJetonsMask
        open={giveOpen}
        onClose={() => setGiveOpen(false)}
        members={members}
        onCommand={onCommand}
        title="TOP UP"
        notice={notice}
      />
      <PremiumCelebrationSettings
        open={fxSettingsOpen}
        onClose={() => setFxSettingsOpen(false)}
        prefs={view.outcomeFx}
        onCommand={onCommand}
      />
      {sheet !== "closed" ? (
        <div className="pm-sheet-mask" data-change-game-sheet={sheet === "pick" || sheet === "poker" ? "true" : undefined} role="dialog" aria-modal="true">
          <div className="pm-sheet">
            {sheet === "menu" ? (
              <>
                <h3>Table</h3>
                {ownerMenu.changeDealer ? (
                  <button type="button" className="pm-console-btn is-ghost" data-owner-change-dealer="true" onClick={openDealer}>
                    Change Dealer
                  </button>
                ) : null}
                {ownerMenu.changeGame ? (
                  <button type="button" className="pm-console-btn is-primary" data-owner-change-game="true" onClick={openChangeGame}>
                    Change Game
                  </button>
                ) : payout ? (
                  <button type="button" className="pm-console-btn is-ghost" disabled title={changeGameReason ?? undefined}>
                    Change Game
                  </button>
                ) : null}
                {changeGameReason && !ownerMenu.changeGame ? (
                  <p className="pm-sheet-hint" data-change-game-blocked="true">
                    {changeGameReason}
                  </p>
                ) : null}
                {showSaveTable ? (
                  <button
                    type="button"
                    className="pm-console-btn is-ghost"
                    data-save-table="true"
                    onClick={() => {
                      void onCommand("saveTable");
                      setSheet("closed");
                    }}
                  >
                    Save Table
                  </button>
                ) : null}
                <button
                  type="button"
                  className="pm-console-btn is-ghost"
                  data-celebration-settings-open="true"
                  onClick={() => {
                    setSheet("closed");
                    setFxSettingsOpen(true);
                  }}
                >
                  Result animations
                </button>
                <button type="button" className="pm-sheet-cancel" onClick={() => setSheet("closed")}>
                  Cancel
                </button>
              </>
            ) : null}
            {sheet === "dealer" ? (
              <>
                <h3>Assign Dealer</h3>
                <label className="pm-sheet-field">
                  Dealer
                  <select
                    aria-label="Dealer"
                    value={dealerId}
                    onChange={(event) => setDealerId(event.target.value)}
                  >
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="pm-console-btn is-primary"
                  onClick={() => {
                    void onCommand("assignBank", { userId: dealerId });
                    setSheet("closed");
                  }}
                >
                  Confirm dealer
                </button>
                <button type="button" className="pm-sheet-cancel" onClick={() => setSheet("menu")}>
                  Back
                </button>
              </>
            ) : null}
            {sheet === "pick" ? (
              <>
                <h3>Switch game</h3>
                <button type="button" className="pm-console-btn is-ghost" disabled>
                  Blackjack · current
                </button>
                <button
                  type="button"
                  className="pm-console-btn is-primary"
                  onClick={() => setSheet("poker")}
                >
                  Texas Hold’em
                </button>
                <button type="button" className="pm-sheet-cancel" onClick={() => setSheet("closed")}>
                  Cancel
                </button>
              </>
            ) : null}
            {sheet === "poker" ? (
              <>
                <h3>CHANGE GAME</h3>
                <p className="pm-sheet-hint">New game: POKER</p>
                <label className="pm-sheet-field">
                  Small blind
                  <input
                    value={smallBlind}
                    onChange={(event) => setSmallBlind(event.target.value)}
                    aria-label="Small blind"
                    inputMode="decimal"
                  />
                </label>
                <label className="pm-sheet-field">
                  Big blind
                  <input
                    value={bigBlind}
                    onChange={(event) => setBigBlind(event.target.value)}
                    aria-label="Big blind"
                    inputMode="decimal"
                  />
                </label>
                <label className="pm-sheet-check">
                  <input
                    type="checkbox"
                    checked={resetBalances}
                    onChange={(event) => setResetBalances(event.target.checked)}
                    data-reset-balances="true"
                  />
                  <span>RESET ALL PLAYER BALANCES to {view.startingJetons?.label ?? "100"}</span>
                </label>
                {resetBalances ? (
                  <p className="pm-sheet-warn">Every player will be reset to the starting allocation.</p>
                ) : null}
                <button
                  type="button"
                  className="pm-console-btn is-primary"
                  data-change-game-confirm="true"
                  onClick={() => {
                    void onCommand("switchGame", {
                      game: "POKER",
                      smallBlind,
                      bigBlind,
                      seatOrder: members.map((member) => member.userId).join(","),
                      resetBalances: resetBalances ? "true" : "false",
                    });
                    setSheet("closed");
                  }}
                >
                  CONFIRM CHANGE
                </button>
                <button type="button" className="pm-sheet-cancel" onClick={() => setSheet("pick")}>
                  Back
                </button>
              </>
            ) : null}
            {sheet === "exit" ? (
              <>
                <h3>Exit table?</h3>
                <p className="pm-sheet-hint">You will leave seating for future hands. Ledger history is kept.</p>
                <div className="pm-sheet-actions">
                  <button
                    type="button"
                    className="pm-console-btn is-primary"
                    data-exit-confirm="true"
                    onClick={() => {
                      void onCommand("leaveTable");
                      setSheet("closed");
                    }}
                  >
                    CONFIRM EXIT
                  </button>
                  <button type="button" className="pm-sheet-cancel" onClick={() => setSheet("closed")}>
                    CANCEL
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </PremiumShell>
  );
}
