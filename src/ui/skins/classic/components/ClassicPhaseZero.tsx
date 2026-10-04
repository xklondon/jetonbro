"use client";

import { useState } from "react";
import type { MemberView, PokerTableView, SetupTableView, WaitingTableView } from "@/application/queries/views";
import { pokerControls } from "@/application/queries/poker-controls";
import { blackjackDealerSetupControls } from "@/ui/core/blackjack-phase-controls";
import type { CommandHandler } from "@/ui/skins/types";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { SheetOverlay } from "./SheetOverlay";
import { ClassicInviteMask } from "./ClassicInvitePanel";
import { SeatOrderList } from "./SeatOrderList";
import { ClothName } from "./ClothName";
import { DealerActionDock } from "./DealerActionDock";

export function ClassicPhaseZero({
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
  const tableName = setup?.tableName ?? waiting?.tableName ?? poker?.tableName ?? "";
  const [inviteOpen, setInviteOpen] = useState(false);
  const [localOpen, setLocalOpen] = useState(false);
  const [localName, setLocalName] = useState("");
  const [menuOpen, setMenuOpen] = useState<"menu" | "rename" | "close" | "seats" | "dealer" | null>(null);
  const [tableNameState, setTableNameState] = useState(tableName);
  const [dealerId, setDealerId] = useState(
    setup?.members.find((member) => member.isBankDealer)?.userId ?? members.find((member) => member.isBankDealer)?.userId ?? "",
  );
  const rows = (setup?.members ?? waiting?.members ?? members).filter((member) => !member.isBankDealer);
  const invited = (setup?.invitations ?? []).filter((invite) => invite.pending && invite.email);
  const startHand = poker ? pokerControls(poker).find((control) => control.id === "startHand") : null;
  const canOpenBetting = game === "BLACKJACK" && Boolean(setup?.canStartBetting && setup.setupCompleted) && isBank;
  const dealerSetup = blackjackDealerSetupControls(canOpenBetting);
  const startBlocked =
    game === "POKER"
      ? startHand && !startHand.enabled
        ? "Waiting for Players"
        : null
      : setup?.startBlockedReason;
  const waitingForPlayers = game === "POKER" ? !startHand?.enabled : !canOpenBetting;
  const joinUrl = setup?.verifiedJoinUrl ?? setup?.joinUrl ?? null;
  const guestJoinUrl = setup?.guestJoinUrl ?? null;
  const emailReady = setup?.emailConfigured !== false;
  const starting = setup?.startingJetonsPerPlayer.label ?? waiting?.startingJetons?.label ?? "100";
  const canManage = isOwner || isBank;
  void viewerId;

  return (
    <TableShell
      title={game === "BLACKJACK" ? tableName : undefined}
      feltIdentity={game !== "BLACKJACK"}
      badges={isOwner ? ["OWNER"] : isBank ? ["DEALER"] : undefined}
      onMenu={isOwner ? () => setMenuOpen("menu") : undefined}
    >
      {game === "BLACKJACK" ? (
        <div className="bj-phase">
          <span className="bj-phase-display">SETUP</span>
          <strong data-phase-heading>Table setup</strong>
          {waitingForPlayers && startBlocked ? <em>{startBlocked}</em> : null}
        </div>
      ) : (
        <PhaseBar label="Table setup">
          {waitingForPlayers && startBlocked ? (
            <p className="muted phase-hint">{startBlocked}</p>
          ) : null}
        </PhaseBar>
      )}
      <main
        className={`felt setup-felt phase-zero-felt${game === "BLACKJACK" ? " bj-dealer" : ""}`}
        data-table-board="PHASE_ZERO_DEALER"
        data-game={game}
        data-join-url={joinUrl ?? undefined}
        data-guest-join-url={guestJoinUrl ?? undefined}
        data-verified-join-url={joinUrl ?? undefined}
      >
        <div className="table-surface">
          {game === "BLACKJACK" ? null : <ClothName name={tableName} />}
          {notice ? <div className="error">{notice}</div> : null}
          {game === "BLACKJACK" ? (
            <div className="bj-ledger" data-dealer-positions="true" data-player-count={rows.length}>
              <div className="bj-ledger-head">
                <span>#</span>
                <span>PLAYER</span>
                <span>AVAILABLE</span>
                <span></span>
              </div>
              {rows.map((row, index) => (
                <div className="bj-row is-idle" key={row.userId} data-player-row="true">
                  <span>{index + 1}</span>
                  <span className="bj-who">
                    <strong>{row.name}</strong>
                  </span>
                  <span className="amount">{row.available?.label ?? "0"}</span>
                  <span />
                </div>
              ))}
              {invited.map((invite, index) => (
                <div className="bj-row is-idle" key={invite.id} data-seat-status="Invited">
                  <span>{rows.length + index + 1}</span>
                  <span className="bj-who">
                    <strong>{invite.email ?? "Player"}</strong>
                    <small>Invited</small>
                  </span>
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : (
            <>
          <div className="player-context">
            <div className="player-dealer-ring" data-role="dealer" data-dealer-row="true">
              DEALER
            </div>
          </div>
          <div
            className="phase-zero-rows dealer-positions"
            data-player-count={rows.length}
            data-empty-waiting={rows.length === 0 && invited.length === 0 ? "true" : undefined}
          >
            {rows.map((row) => (
              <div className="dealer-position is-idle" key={row.userId} data-player-row="true">
                <span className="position-who">
                  <strong>{row.name}</strong>
                </span>
                <span className="position-stake">
                  <strong className="amount">{row.available?.label ?? "0"}</strong>
                </span>
              </div>
            ))}
            {invited.map((invite) => (
              <div className="dealer-position is-idle" key={invite.id} data-seat-status="Invited">
                <span className="position-who">
                  <strong>{invite.email ?? "Player"}</strong>
                  <small>Invited</small>
                </span>
              </div>
            ))}
          </div>
            </>
          )}
        </div>
      </main>
      <ClassicInviteMask
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        guestJoinUrl={guestJoinUrl}
        verifiedJoinUrl={joinUrl}
        emailConfigured={emailReady}
        startingJetons={starting}
        members={setup?.members ?? members}
        invitations={setup?.invitations}
        onCommand={onCommand}
        notice={notice}
      />
      <SheetOverlay open={localOpen} onClose={() => setLocalOpen(false)}>
        <h3>Add local player</h3>
        <label>
          Player name
          <input
            aria-label="Player name"
            value={localName}
            onChange={(event) => setLocalName(event.target.value)}
          />
        </label>
        <button
          className="gold-button"
          type="button"
          onClick={async () => {
            const ok = await onCommand("addPlayer", { name: localName });
            if (ok !== false) {
              setLocalName("");
              setLocalOpen(false);
            }
          }}
        >
          Add Local Player
        </button>
        <button className="text-link" type="button" onClick={() => setLocalOpen(false)}>
          Close
        </button>
      </SheetOverlay>
      <SheetOverlay open={Boolean(menuOpen)} onClose={() => setMenuOpen(null)}>
        {menuOpen === "menu" ? (
          <>
            <h3>Table</h3>
            {poker?.canReorderSeats ? (
              <button className="panel-button" type="button" onClick={() => setMenuOpen("seats")}>
                SEAT ORDER
              </button>
            ) : null}
            <button className="panel-button" type="button" onClick={() => setMenuOpen("rename")}>
              RENAME TABLE
            </button>
            <button className="panel-button" type="button" onClick={() => setMenuOpen("dealer")}>
              Change Dealer
            </button>
            <button
              className="panel-button"
              type="button"
              onClick={() => {
                setMenuOpen(null);
                setLocalOpen(true);
              }}
            >
              ADD LOCAL PLAYER
            </button>
            <div className="field-label">CARD ASSIST</div>
            <div className="setting-row">
              {(["OFF", "CONFIRM", "AUTO"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`panel-button${(setup?.cardAssist ?? "OFF") === mode ? " active" : ""}`}
                  onClick={() => onCommand("setCardAssist", { cardAssist: mode })}
                >
                  {mode}
                </button>
              ))}
            </div>
            <button className="gold-button" type="button" onClick={() => { onCommand("saveTable"); setMenuOpen(null); }}>
              SAVE TABLE
            </button>
            <button className="gold-button" type="button" onClick={() => setMenuOpen("close")}>
              CLOSE TABLE & SAVE BALANCES
            </button>
            <button className="text-link" type="button" onClick={() => setMenuOpen(null)}>
              Cancel
            </button>
          </>
        ) : null}
        {menuOpen === "seats" && poker ? (
          <>
            <h3>Seat order</h3>
            <SeatOrderList
              seats={poker.seats}
              onReorder={(seatOrder) => onCommand("configurePoker", { seatOrder })}
            />
            <button className="text-link" type="button" onClick={() => setMenuOpen("menu")}>
              Cancel
            </button>
          </>
        ) : null}
        {menuOpen === "rename" ? (
          <>
            <h3>Rename table</h3>
            <label>
              Table name
              <input aria-label="Table name" value={tableNameState} onChange={(event) => setTableNameState(event.target.value)} />
            </label>
            <button
              className="gold-button"
              type="button"
              onClick={async () => {
                const ok = await onCommand("updateSettings", { name: tableNameState });
                if (ok !== false) setMenuOpen(null);
              }}
            >
              Save name
            </button>
            <button className="text-link" type="button" onClick={() => setMenuOpen("menu")}>
              Cancel
            </button>
          </>
        ) : null}
        {menuOpen === "dealer" ? (
          <>
            <h3>Assign Dealer</h3>
            <label>
              Dealer
              <select aria-label="Dealer" value={dealerId} onChange={(event) => setDealerId(event.target.value)}>
                {(setup?.members ?? members).map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="gold-button"
              type="button"
              onClick={() => {
                onCommand("assignBank", { userId: dealerId });
                setMenuOpen(null);
              }}
            >
              Confirm dealer
            </button>
            <button className="text-link" type="button" onClick={() => setMenuOpen("menu")}>
              Cancel
            </button>
          </>
        ) : null}
        {menuOpen === "close" ? (
          <>
            <h3>Close {tableName}</h3>
            <p>{setup?.closePreview?.confirmation ?? "Save each Player’s remaining jetons and close this table?"}</p>
            <button className="gold-button" type="button" onClick={() => { onCommand("closeTable"); setMenuOpen(null); }}>
              Confirm close
            </button>
            <button className="text-link" type="button" onClick={() => setMenuOpen("menu")}>
              Cancel
            </button>
          </>
        ) : null}
      </SheetOverlay>
      <DealerActionDock
        primary={
          game === "POKER"
            ? isOwner
              ? { label: "START HAND", disabled: !startHand?.enabled, onClick: () => onCommand("startTexasHoldem") }
              : null
            : isBank && dealerSetup.primary
              ? {
                  label: dealerSetup.primary.label,
                  disabled: !dealerSetup.primary.enabled,
                  onClick: () => onCommand(dealerSetup.primary!.command),
                }
              : null
        }
        secondary={
          canManage && dealerSetup.showAddPlayer
            ? { label: "ADD PLAYER", addPlayer: true, onClick: () => setInviteOpen(true) }
            : null
        }
      />
    </TableShell>
  );
}
