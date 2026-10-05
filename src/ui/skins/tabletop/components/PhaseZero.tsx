"use client";

import { useState } from "react";
import type { MemberView, PokerTableView, SetupTableView, WaitingTableView } from "@/application/queries/views";
import { pokerControls } from "@/application/queries/poker-controls";
import { blackjackDealerSetupControls } from "@/ui/core/blackjack-phase-controls";
import type { CommandHandler } from "@/ui/skins/types";
import { Shell } from "./Shell";
import { InviteMask } from "./InviteMask";
import { OwnerMenu } from "./OwnerMenu";
import { ActionDock } from "./primitives/ActionDock";
import { DealerLedgerRow } from "./primitives/DealerLedger";
import { PhaseDisplay } from "./primitives/PhaseDisplay";
import { TableName } from "./primitives/TableName";

/** Dealer / Owner Phase 0: compact player list; START BETTING | ADD PLAYER in the dock. */
export function PhaseZero({
  setup,
  waiting,
  poker,
  members,
  onCommand,
  notice,
  isOwner,
  isBank,
  viewerId,
  game,
}: {
  setup: SetupTableView | null;
  waiting: WaitingTableView | null;
  poker: PokerTableView | null;
  members: MemberView[];
  onCommand: CommandHandler;
  notice?: string | null;
  isOwner: boolean;
  isBank: boolean;
  viewerId: string;
  game: "BLACKJACK" | "POKER";
}) {
  void viewerId;
  const tableName = setup?.tableName ?? waiting?.tableName ?? poker?.tableName ?? "";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuMembers = setup?.members ?? members;
  const rows = (setup?.members ?? waiting?.members ?? members).filter((member) => !member.isBankDealer);
  const invited = (setup?.invitations ?? []).filter((invite) => invite.pending && invite.email);
  const startHand = poker ? pokerControls(poker).find((control) => control.id === "startHand") : null;
  const canOpenBetting = game === "BLACKJACK" && Boolean(setup?.canStartBetting && setup.setupCompleted) && isBank;
  const dealerSetup = blackjackDealerSetupControls(canOpenBetting);
  const startBlocked = game === "POKER" ? (startHand && !startHand.enabled ? "Waiting for Players" : null) : setup?.startBlockedReason;
  const waitingForPlayers = game === "POKER" ? !startHand?.enabled : !canOpenBetting;
  const verifiedUrl = setup?.verifiedJoinUrl ?? setup?.joinUrl ?? null;
  const guestUrl = setup?.guestJoinUrl ?? null;
  const starting = setup?.startingJetonsPerPlayer.label ?? waiting?.startingJetons?.label ?? "100";
  const canManage = isOwner || isBank;

  const dock = (
    <ActionDock
      notice={notice ? <div className="tt-error">{notice}</div> : null}
      primary={
        game === "POKER"
          ? isOwner
            ? { label: "START HAND", disabled: !startHand?.enabled, onClick: () => void onCommand("startTexasHoldem") }
            : null
          : isBank && dealerSetup.primary
            ? {
                label: dealerSetup.primary.label,
                disabled: !dealerSetup.primary.enabled,
                onClick: () => void onCommand(dealerSetup.primary!.command),
              }
            : null
      }
      secondary={canManage && dealerSetup.showAddPlayer ? { label: "ADD PLAYER", addPlayer: true, onClick: () => setInviteOpen(true) } : null}
    />
  );

  return (
    <Shell
      hideBrand
      badges={isOwner ? ["OWNER"] : isBank ? ["DEALER"] : undefined}
      onMenu={isOwner ? () => setMenuOpen(true) : undefined}
      rail={dock}
      feltClassName="tt-phase-zero"
      feltProps={{
        "data-table-board": "PHASE_ZERO_DEALER",
        "data-game": game,
        "data-join-url": verifiedUrl ?? undefined,
        "data-guest-join-url": guestUrl ?? undefined,
        "data-verified-join-url": verifiedUrl ?? undefined,
      }}
      overlay={
        <>
          <InviteMask
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            guestJoinUrl={guestUrl}
            verifiedJoinUrl={verifiedUrl}
            emailConfigured={setup?.emailConfigured !== false}
            startingJetons={starting}
            members={menuMembers}
            invitations={setup?.invitations}
            onCommand={onCommand}
            notice={notice}
          />
          {isOwner ? (
            <OwnerMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              tableName={tableName}
              members={menuMembers}
              onCommand={onCommand}
              game={game}
              addPlayer="name"
              giveJetons={false}
              changeDealer
              seats={poker?.canReorderSeats ? poker.seats : null}
              seatsHint="Dealer button follows this order after START HAND. Order locks when the first hand begins."
              cardAssist={setup?.cardAssist ?? "OFF"}
              closePreview={setup?.closePreview}
              closeCopy="Save each Player’s remaining jetons and close this table?"
            />
          ) : null}
        </>
      }
    >
      <PhaseDisplay display="SETUP" label="Table setup" instruction={waitingForPlayers && startBlocked ? startBlocked : undefined} />
      <TableName name={tableName} />
      <div className="tt-stage tt-setup-stage">
        <div
          className="tt-ledger tt-setup-ledger"
          data-player-count={rows.length}
          data-count={Math.min(rows.length + invited.length, 6)}
          data-empty-waiting={rows.length === 0 && invited.length === 0 ? "true" : undefined}
        >
          {rows.map((row) => (
            <DealerLedgerRow key={row.userId} empty playerName={row.name} availableLabel={row.available?.label ?? "0"} />
          ))}
          {invited.map((invite) => (
            <div className="tt-ledger-row is-idle is-invited" key={invite.id} data-seat-status="Invited">
              <span className="tt-ledger-who">
                <strong>{invite.email ?? "Player"}</strong>
                <small>Invited</small>
              </span>
              <span className="tt-ledger-stake" />
              <span className="tt-ledger-action">—</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
