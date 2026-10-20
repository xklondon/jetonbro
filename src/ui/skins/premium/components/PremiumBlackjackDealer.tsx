"use client";

import { useState, type ReactNode } from "react";
import type { BankTableView, BoxView, MemberView } from "@/application/queries/views";
import type { BoxOutcome } from "@/domain/blackjack/payouts";
import { blackjackDealerControls, blackjackOwnerMenu } from "@/ui/core/blackjack-phase-controls";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumCelebrationSettings } from "./PremiumCelebrationSettings";
import { PremiumGiveJetonsMask } from "./PremiumGiveJetonsMask";
import { PremiumInviteMask } from "./PremiumInviteMask";
import { PremiumShell } from "./PremiumShell";
import { CasinoConsole } from "./primitives/CasinoConsole";
import { BlackjackTable } from "./primitives/BlackjackTable";
import { BlackjackBox, setupSeatBox } from "./primitives/BlackjackBox";
import { BlackjackPayoutOverlay } from "./primitives/BlackjackSettlementBar";

type Sheet = "closed" | "menu" | "dealer" | "pick" | "poker";

function activeBoxes(view: BankTableView): BoxView[] {
  const fromPlayers = view.players.flatMap((player) => player.boxes);
  return fromPlayers.length > 0 ? fromPlayers : view.boxes;
}

function seated(view: BankTableView) {
  return view.players.filter((player) => Boolean(player.userId));
}

function orderNewestLeft(boxes: BoxView[]) {
  return [...boxes].sort((a, b) => b.boxNumber - a.boxNumber);
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
      for (const box of orderNewestLeft(player.boxes)) out.push(box);
      n = Math.max(n, ...player.boxes.map((b) => b.boxNumber + 1));
    } else {
      out.push(setupSeatBox(player, n));
      n += 1;
    }
  }
  return orderNewestLeft(out);
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
  const [dealerId, setDealerId] = useState(
    () => members.find((member) => member.isBankDealer)?.userId ?? members[0]?.userId ?? "",
  );
  const controls = blackjackDealerControls(view);
  const joined = seated(view);
  const boxes = activeBoxes(view);
  const staged = orderNewestLeft(boxes);
  const setup = view.phase === "TABLE_SETUP";
  const payout = view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE";
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

  const showAddPlayer = setup || betting || payout;
  const showGiveJetons = Boolean(view.isOwner && view.actions.giveJetons && (setup || betting));
  /** Tray Change Game: Betting/Setup when safe; Payout always visible for owner (may be disabled). */
  const showChangeGame =
    view.isOwner && (setup || betting || payout) && (ownerMenu.changeGame || payout);
  const changeGameEnabled = ownerMenu.changeGame;
  const changeGameReason =
    !changeGameEnabled && payout
      ? view.switchBlockedReason || "Settle every box before switching games"
      : null;

  function openChangeGame() {
    if (!changeGameEnabled) return;
    setSheet("pick");
  }

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
    </>
  );

  let layer: ReactNode = null;
  if (setup) {
    const seats = setupDisplayBoxes(view);
    layer =
      seats.length > 0 ? (
        seats.map((box) => <BlackjackBox key={box.id} box={box} showPlayerName />)
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
  } else if (play && staged.length > 0) {
    layer = staged.map((box) => <BlackjackBox key={box.id} box={box} showPlayerName />);
  } else if (!setup) {
    layer = (
      <p className="pm-bj-empty" data-dealer-empty="true">
        Waiting for the first wager.
      </p>
    );
  }

  const tertiary = showChangeGame
    ? {
        label: "CHANGE GAME",
        disabled: !changeGameEnabled,
        title: changeGameReason ?? undefined,
        onClick: openChangeGame,
      }
    : null;

  const dockNotice = (
    <>
      {notice ? <div className="pm-console-notice">{notice}</div> : null}
      {changeGameReason && showChangeGame && !changeGameEnabled ? (
        <div className="pm-console-notice is-hint" data-change-game-blocked="true">
          {changeGameReason}
        </div>
      ) : null}
    </>
  );

  return (
    <PremiumShell
      title="JETONBRO"
      badges={badges}
      onMenu={view.isOwner ? openOwnerMenu : undefined}
      board="BLACKJACK_DEALER"
      dock={
        <CasinoConsole
          variant={setup ? "setup" : "blackjack"}
          notice={dockNotice}
          primary={
            controls.primary
              ? {
                  label: controls.primary.label,
                  disabled: !controls.primary.enabled,
                  onClick: () => void onCommand(controls.primary!.command),
                }
              : null
          }
          secondary={
            showAddPlayer
              ? { label: "ADD PLAYER", onClick: () => setInviteOpen(true) }
              : controls.insurance
                ? {
                    label: controls.insurance.label,
                    disabled: !controls.insurance.enabled,
                    onClick: () => void onCommand(controls.insurance!.command),
                  }
                : showGiveJetons
                  ? { label: "GIVE JETONS", onClick: () => setGiveOpen(true) }
                  : null
          }
          tertiary={
            tertiary ??
            (showGiveJetons && showAddPlayer
              ? { label: "GIVE JETONS", onClick: () => setGiveOpen(true) }
              : null)
          }
        />
      }
    >
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
        dealerRanks={view.dealerHand?.ranks}
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
        title="GIVE JETONS"
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
                <h3>Texas Hold’em</h3>
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
                <button
                  type="button"
                  className="pm-console-btn is-primary"
                  onClick={() => {
                    void onCommand("switchGame", {
                      game: "POKER",
                      smallBlind,
                      bigBlind,
                      seatOrder: members.map((member) => member.userId).join(","),
                    });
                    setSheet("closed");
                  }}
                >
                  SWITCH TO TEXAS HOLD’EM
                </button>
                <button type="button" className="pm-sheet-cancel" onClick={() => setSheet("pick")}>
                  Back
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </PremiumShell>
  );
}
