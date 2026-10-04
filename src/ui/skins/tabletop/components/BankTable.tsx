"use client";

import { useState, type ReactNode } from "react";
import type { BankTableView, BoxView, MemberView } from "@/application/queries/views";
import { PAYOUT_RAIL_ORDER, type BoxOutcome } from "@/domain/blackjack/payouts";
import { blackjackDealerControls, blackjackOwnerMenu } from "@/ui/core/blackjack-phase-controls";
import type { CommandHandler } from "@/ui/skins/types";
import { Shell } from "./Shell";
import { Dock } from "./Dock";
import { InviteMask } from "./InviteMask";
import { OwnerMenu, type OwnerMenuItem } from "./OwnerMenu";
import { ChipPile, ClothName, Countdown, PhasePill } from "./Spot";

const RAIL_TITLE: Record<BoxOutcome, string> = {
  LOST: "LOST",
  PUSH: "STAND OFF",
  BLACKJACK: "BLACKJACK",
  WON: "WON",
};

function resultCopy(box: BoxView): string | null {
  if (!box.outcome) return null;
  const result = box.outcome === "WON" ? "Won" : box.outcome === "PUSH" ? "Stand off" : box.outcome === "LOST" ? "Lost" : "Blackjack";
  return box.returned ? `${result} · ${box.returned.label}` : result;
}

/** One player's box on the dealer's felt: stake plus payout buttons while unresolved. */
function PositionSpot({
  box,
  phase,
  payoutEnabled,
  onSettle,
}: {
  box: BoxView;
  phase: string;
  payoutEnabled: boolean;
  onSettle: (outcome: BoxOutcome) => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const unresolved = payoutEnabled && !box.outcome && !submitted;
  const settled = resultCopy(box);
  const commitment = box.isDoubled ? "Double" : box.isSplit ? "Split" : null;
  const title = `${box.playerName || "Player"} · BOX ${box.boxNumber}`;

  return (
    <div
      className={`tt-spot${box.outcome ? ` is-${box.outcome.toLowerCase()}` : ""}${unresolved ? " is-unresolved" : " is-idle"}`}
      data-box-id={box.id}
      data-blackjack-box-row="true"
      data-dealer-position="true"
      data-box-phase={phase}
      data-player-row="true"
      data-player-group={box.playerId}
      data-payout-row={unresolved || Boolean(box.outcome) ? "true" : undefined}
    >
      <span className="tt-spot-who">
        <strong>{box.playerName || "Player"}</strong>
        <small>BOX {box.boxNumber}</small>
      </span>
      <ChipPile millis={box.bet.millis} max={4} />
      <span className="tt-amount">{box.bet.label}</span>
      {box.insurance ? <small className="tt-spot-note">INS {box.insurance.label}</small> : null}
      {commitment || settled ? <small className="tt-spot-note">{commitment ?? settled}</small> : null}
      {unresolved ? (
        <span className="tt-payouts" role="group" aria-label={`Settle ${title}`}>
          {PAYOUT_RAIL_ORDER.map((outcome) => {
            const action = box.payoutActions.find((entry) => entry.outcome === outcome);
            return (
              <button
                key={outcome}
                type="button"
                className={`tt-pay tt-pay-${outcome.toLowerCase()}`}
                data-payout-action="true"
                onClick={() => {
                  setSubmitted(true);
                  onSettle(outcome);
                }}
              >
                {action?.title ?? RAIL_TITLE[outcome]}
              </button>
            );
          })}
        </span>
      ) : null}
    </div>
  );
}

/** Immersive Blackjack Dealer: player boxes as betting spots on the felt, actions anchored in the rail. */
export function BankTable({
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const dealerMember = members.find((member) => member.isBankDealer);
  const dealerPlays = Boolean(dealerMember && view.players.some((player) => player.userId === dealerMember.userId && player.boxes.length > 0));
  const badges = [...(view.isOwner ? ["OWNER"] : []), dealerPlays ? "DEALER · PLAYING" : "DEALER"];
  const controls = blackjackDealerControls(view);
  const ownerMenu = blackjackOwnerMenu({
    isOwner: view.isOwner,
    phase: view.phase,
    changeDealer: view.actions.changeBank,
    changeGame: view.actions.switchGame,
  });
  const phaseDisplay =
    view.insurance.window === "OPEN" && view.phase === "PLAYING"
      ? "INSURANCE"
      : view.phase === "TABLE_SETUP"
        ? "SETUP"
        : view.phase === "ROUND_COMPLETE"
          ? "PAYOUT"
          : view.phase;

  const spots: Array<{ key: string; node: ReactNode }> = [];
  const settle = (box: BoxView) => (outcome: BoxOutcome) => void onCommand("settleBox", { boxId: box.id, outcome });
  if (view.players.length === 0) {
    for (const box of view.boxes) {
      spots.push({
        key: box.id,
        node: <PositionSpot box={box} phase={view.phase} payoutEnabled={view.actions.settleBoxes} onSettle={settle(box)} />,
      });
    }
  } else {
    for (const player of view.players) {
      if (player.boxes.length === 0) {
        spots.push({
          key: player.userId,
          node: (
            <div className="tt-spot is-idle is-empty" data-player-row="true" data-player-group={player.userId}>
              <span className="tt-spot-who">
                <strong>{player.name}</strong>
                <small>AVAILABLE</small>
              </span>
              <span className="tt-amount">{player.available.label}</span>
            </div>
          ),
        });
        continue;
      }
      for (const box of player.boxes) {
        spots.push({
          key: box.id,
          node: <PositionSpot box={box} phase={view.phase} payoutEnabled={view.actions.settleBoxes} onSettle={settle(box)} />,
        });
      }
    }
  }

  const menuItems: OwnerMenuItem[] = [];
  if (view.phase === "BETTING") {
    menuItems.push({ label: "DEAL IN 7 SECONDS", disabled: !view.actions.scheduleDeal, onClick: () => void onCommand("scheduleDeal") });
  }
  if (view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE") {
    menuItems.push({ label: "IN 7 SECONDS", disabled: !view.actions.scheduleNextRound, onClick: () => void onCommand("scheduleNextRound") });
  }

  const dock = (
    <Dock
      notice={notice ? <div className="tt-error">{notice}</div> : null}
      extra={
        controls.showInsuranceSettle ? (
          <div className="tt-ins-settle">
            <button type="button" className="tt-btn ins-win" onClick={() => void onCommand("settleInsurance", { resolution: "DEALER_BLACKJACK" })}>
              INS WON
            </button>
            <button type="button" className="tt-btn ins-lose" onClick={() => void onCommand("settleInsurance", { resolution: "NO_DEALER_BLACKJACK" })}>
              INS LOST
            </button>
          </div>
        ) : null
      }
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
        controls.showAddPlayer
          ? { label: "ADD PLAYER", addPlayer: true, onClick: () => setInviteOpen(true) }
          : controls.insurance
            ? {
                label: controls.insurance.label,
                disabled: !controls.insurance.enabled,
                onClick: () => void onCommand(controls.insurance!.command),
              }
            : null
      }
    />
  );

  return (
    <Shell
      hideBrand
      badges={badges}
      onMenu={() => setMenuOpen(true)}
      rail={dock}
      feltClassName="tt-bj-dealer"
      feltProps={{
        "data-table-board": "BLACKJACK_DEALER",
        "data-guest-join-url": view.guestJoinUrl ?? undefined,
        "data-verified-join-url": view.verifiedJoinUrl ?? undefined,
      }}
      overlay={
        <>
          <InviteMask
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            guestJoinUrl={view.guestJoinUrl}
            verifiedJoinUrl={view.verifiedJoinUrl}
            emailConfigured={view.emailConfigured !== false}
            startingJetons={view.startingJetons?.label ?? "100"}
            members={members}
            invitations={view.invitations}
            onCommand={onCommand}
            notice={notice}
          />
          <OwnerMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            tableName={view.tableName}
            members={members}
            onCommand={onCommand}
            game="BLACKJACK"
            items={menuItems}
            addPlayer={view.phase === "BETTING" ? "invite" : view.isOwner && view.actions.addPlayer ? "full" : false}
            onInvite={() => setInviteOpen(true)}
            giveJetons={view.actions.giveJetons}
            rename={view.isOwner}
            changeDealer={ownerMenu.changeDealer}
            switchGame={ownerMenu.changeGame}
            dealerWon={view.actions.settleDealerWon}
            bankroll={view.phase === "BETTING" ? (view.bankroll ?? null) : null}
            cardAssist={view.cardAssist ?? "OFF"}
            lifecycle={view.isOwner}
            canSave={view.actions.saveTable}
            canClose={view.actions.closeTable}
            closePreview={view.closePreview}
          />
        </>
      }
    >
      <div
        hidden
        data-owner-menu="true"
        data-owner-change-dealer={ownerMenu.changeDealer ? "true" : "false"}
        data-owner-change-game={ownerMenu.changeGame ? "true" : "false"}
      />
      <PhasePill display={phaseDisplay} label={controls.phaseLabel} instruction={controls.instruction || undefined} />
      <ClothName name={view.tableName} />
      {view.bettingCloseDeadlineAt || view.nextRoundDeadlineAt ? (
        <div className="tt-timers">
          <Countdown deadline={view.bettingCloseDeadlineAt} label="Cards in" />
          <Countdown deadline={view.nextRoundDeadlineAt} label="Next round in" />
        </div>
      ) : null}
      {view.insurance.window === "OPEN" || view.insurance.count > 0 ? (
        <div className="tt-ins-pot" data-insurance-pot="true">
          INSURANCE · {view.insurance.total.label} · {view.insurance.count} {view.insurance.count === 1 ? "bet" : "bets"}
        </div>
      ) : null}
      <div
        className="tt-dealer-grid"
        data-dealer-positions="true"
        data-player-count={view.players.length}
        data-position-count={spots.length}
        data-count={Math.min(spots.length, 6)}
      >
        {spots.map((spot) => (
          <div className="tt-spot-cell" key={spot.key}>
            {spot.node}
          </div>
        ))}
      </div>
    </Shell>
  );
}
