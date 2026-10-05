"use client";

import { useState, type ReactNode } from "react";
import type { BankTableView, BoxView, MemberView } from "@/application/queries/views";
import type { BoxOutcome } from "@/domain/blackjack/payouts";
import { blackjackDealerControls, blackjackOwnerMenu } from "@/ui/core/blackjack-phase-controls";
import type { CommandHandler } from "@/ui/skins/types";
import { Shell } from "./Shell";
import { InviteMask } from "./InviteMask";
import { OwnerMenu, type OwnerMenuItem } from "./OwnerMenu";
import { Countdown } from "./Spot";
import { ActionDock } from "./primitives/ActionDock";
import { DealerLedger, DealerLedgerRow } from "./primitives/DealerLedger";
import { PhaseDisplay } from "./primitives/PhaseDisplay";
import { TableButton } from "./primitives/TableButton";
import { TableName } from "./primitives/TableName";

/** Immersive Blackjack Dealer: dense ledger for real boxes; actions in the rail. */
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

  const settle = (box: BoxView) => (outcome: BoxOutcome) => void onCommand("settleBox", { boxId: box.id, outcome });

  const rows: ReactNode[] = [];
  if (view.players.length === 0) {
    for (const box of view.boxes) {
      rows.push(
        <DealerLedgerRow
          key={box.id}
          box={box}
          phase={view.phase}
          payoutEnabled={view.actions.settleBoxes}
          onSettle={settle(box)}
        />,
      );
    }
  } else {
    for (const player of view.players) {
      if (player.boxes.length === 0) {
        rows.push(
          <DealerLedgerRow
            key={player.userId}
            empty
            playerName={player.name}
            availableLabel={player.available.label}
          />,
        );
        continue;
      }
      for (const box of player.boxes) {
        rows.push(
          <DealerLedgerRow
            key={box.id}
            box={box}
            phase={view.phase}
            payoutEnabled={view.actions.settleBoxes}
            onSettle={settle(box)}
          />,
        );
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

  const summary =
    view.dealerName || view.players[0] ? (
      <div className="tt-dealer-summary" data-dealer-row="true">
        {view.dealerName ? (
          <div className="tt-dealer-summary-card">
            <small>DEALER</small>
            <strong>{view.dealerName}</strong>
            <em>{view.bankroll?.available.label ?? "—"}</em>
          </div>
        ) : null}
        {view.players[0] ? (
          <div className="tt-dealer-summary-card is-play">
            <small>PLAYING</small>
            <strong>{view.players[0].name}</strong>
            <em>{view.players[0].available.label}</em>
          </div>
        ) : null}
      </div>
    ) : null;

  const dock = (
    <ActionDock
      notice={notice ? <div className="tt-error">{notice}</div> : null}
      extra={
        controls.showInsuranceSettle ? (
          <div className="tt-ins-settle">
            <TableButton variant="compact" className="ins-win" onClick={() => void onCommand("settleInsurance", { resolution: "DEALER_BLACKJACK" })}>
              INS WON
            </TableButton>
            <TableButton variant="compact" className="ins-lose" onClick={() => void onCommand("settleInsurance", { resolution: "NO_DEALER_BLACKJACK" })}>
              INS LOST
            </TableButton>
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
      <PhaseDisplay display={phaseDisplay} label={controls.phaseLabel} instruction={controls.instruction || undefined} />
      <TableName name={view.tableName} />
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
      <DealerLedger playerCount={view.players.length} summary={summary}>
        {rows}
      </DealerLedger>
    </Shell>
  );
}
