"use client";

import { useState } from "react";
import type { BankTableView, MemberView } from "@/application/queries/views";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { PhaseActionDock } from "./PhaseActionDock";
import { DealCountdown } from "./DealCountdown";
import { BettingPlaque } from "./BettingPlaque";
import { DealerBlackjackBoxRow } from "./DealerBlackjackBoxRow";
import { ClothName } from "./ClothName";
import { BankrollPanel } from "./BankrollPanel";
import { SheetOverlay } from "./SheetOverlay";
import { ClassicInviteMask } from "./ClassicInvitePanel";
import { blackjackDealerControls, blackjackOwnerMenu, eligibleDealerCandidates } from "@/ui/core/blackjack-phase-controls";
import { DealerActionDock } from "./DealerActionDock";

export function ClassicBankTable({
  view,
  members,
  onCommand,
  notice,
}: {
  view: BankTableView;
  members: MemberView[];
  onCommand: (command: string, payload?: Record<string, string>) => void;
  notice?: string | null;
}) {
  const [sheet, setSheet] = useState<
    "player" | "jetons" | "menu" | "close" | "funding" | "game" | "poker" | "rename" | "dealer" | "dealerWon" | null
  >(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [tableName, setTableName] = useState(view.tableName);
  const [startingBank, setStartingBank] = useState(view.bankroll?.available.label || "500");
  const [smallBlind, setSmallBlind] = useState("5");
  const [bigBlind, setBigBlind] = useState("10");
  const memberIdDefault = members[0]?.userId ?? "";
  const [memberId, setMemberId] = useState(memberIdDefault);
  const [dealerId, setDealerId] = useState(members.find((member) => member.isBankDealer)?.userId ?? memberIdDefault);
  const dealerMember = members.find((member) => member.isBankDealer);
  const dealerPlays = Boolean(
    dealerMember && view.players.some((player) => player.userId === dealerMember.userId && player.boxes.length > 0),
  );
  const badges = [...(view.isOwner ? ["OWNER"] : []), dealerPlays ? "DEALER · PLAYING" : "DEALER"];
  const dealerControls = blackjackDealerControls(view);
  const ownerMenu = blackjackOwnerMenu({
    isOwner: view.isOwner,
    phase: view.phase,
    changeDealer: view.actions.changeBank,
    changeGame: view.actions.switchGame,
  });
  const dealerCandidates = eligibleDealerCandidates(members);
  const ledgerCount =
    view.players.length === 0
      ? view.boxes.length
      : view.players.reduce((count, player) => count + Math.max(player.boxes.length, 1), 0);

  function runPrimary() {
    const command = dealerControls.primary?.command;
    if (command) onCommand(command);
  }

  return (
    <TableShell feltIdentity badges={badges} onMenu={() => setSheet("menu")}>
      <PhaseBar label={dealerControls.phaseLabel} kicker={dealerControls.instruction}>
        {view.bettingCloseDeadlineAt || view.nextRoundDeadlineAt ? (
          <PhaseActionDock>
            <DealCountdown deadline={view.bettingCloseDeadlineAt} />
            <DealCountdown deadline={view.nextRoundDeadlineAt} label="Next round in" />
          </PhaseActionDock>
        ) : null}
      </PhaseBar>
      <main className="felt dealer-list-felt" data-table-board="BLACKJACK_DEALER" data-guest-join-url={view.guestJoinUrl ?? undefined} data-verified-join-url={view.verifiedJoinUrl ?? undefined}>
        <div className="table-surface">
          <ClothName name={view.tableName} />
          <div
            hidden
            data-owner-menu="true"
            data-owner-change-dealer={ownerMenu.changeDealer ? "true" : "false"}
            data-owner-change-game={ownerMenu.changeGame ? "true" : "false"}
          />
          <div className="player-context">
            <div className="player-dealer-ring" data-dealer-row="true">
              DEALER
            </div>
          </div>
          <div
            className="dealer-list dealer-positions"
            data-dealer-positions="true"
            data-player-count={view.players.length}
            data-ledger-count={ledgerCount}
            data-ledger-overflow={ledgerCount >= 5 ? "true" : "false"}
          >
            {view.players.length === 0
              ? view.boxes.map((box) => (
                  <DealerBlackjackBoxRow
                    key={box.id}
                    box={box}
                    phase={view.phase}
                    payoutEnabled={view.actions.settleBoxes}
                    onSettle={(outcome) => onCommand("settleBox", { boxId: box.id, outcome })}
                  />
                ))
              : view.players.flatMap((player) =>
                  player.boxes.length > 0
                    ? player.boxes.map((box) => (
                        <DealerBlackjackBoxRow
                          key={box.id}
                          box={box}
                          phase={view.phase}
                          payoutEnabled={view.actions.settleBoxes}
                          available={player.available.label}
                          locked={player.locked.label}
                          onSettle={(outcome) => onCommand("settleBox", { boxId: box.id, outcome })}
                        />
                      ))
                    : [
                        <div className="dealer-position is-idle" key={player.userId} data-player-row="true" data-player-group={player.userId}>
                          <div className="position-spot">
                            <BettingPlaque />
                            <span className="position-who">
                              <strong>{player.name}</strong>
                            </span>
                            <span className="position-stake">
                              <strong className="amount">{player.available.label}</strong>
                            </span>
                          </div>
                        </div>,
                      ],
                )}
          </div>
        </div>
      </main>
      <DealerActionDock
        notice={notice ? <div className="error">{notice}</div> : null}
        extra={
          dealerControls.showInsuranceSettle ? (
            <div className="dealer-insurance-settle">
              <button
                type="button"
                className="insurance-win"
                onClick={() => onCommand("settleInsurance", { resolution: "DEALER_BLACKJACK" })}
              >
                INS WON
              </button>
              <button
                type="button"
                className="insurance-lose"
                onClick={() => onCommand("settleInsurance", { resolution: "NO_DEALER_BLACKJACK" })}
              >
                INS LOST
              </button>
            </div>
          ) : null
        }
        primary={
          dealerControls.primary
            ? { label: dealerControls.primary.label, disabled: !dealerControls.primary.enabled, onClick: runPrimary }
            : null
        }
        secondary={
          dealerControls.showAddPlayer
            ? { label: "ADD PLAYER", addPlayer: true, onClick: () => setInviteOpen(true) }
            : dealerControls.insurance
              ? {
                  label: dealerControls.insurance.label,
                  disabled: !dealerControls.insurance.enabled,
                  onClick: () => onCommand(dealerControls.insurance!.command),
                }
              : null
        }
      />
      <ClassicInviteMask
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
      <SheetOverlay open={Boolean(sheet)} onClose={() => setSheet(null)}>
        {sheet === "game" ? (
            <>
              <h3>Switch game</h3>
              <button
                className="gold-button"
                type="button"
                onClick={() => {
                  onCommand("switchGame", { game: "BLACKJACK" });
                  setSheet(null);
                }}
              >
                Blackjack
              </button>
              <button className="gold-button" type="button" onClick={() => setSheet("poker")}>
                Texas Hold’em
              </button>
              <button type="button" disabled>
                Zilch — Coming later
              </button>
              <button className="text-link" type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "poker" ? (
            <>
              <h3>Texas Hold’em</h3>
              <label>
                Small blind
                <input value={smallBlind} onChange={(event) => setSmallBlind(event.target.value)} aria-label="Small blind" />
              </label>
              <label>
                Big blind
                <input value={bigBlind} onChange={(event) => setBigBlind(event.target.value)} aria-label="Big blind" />
              </label>
              {members.map((member, index) => (
                <div className="member-row" key={member.userId}>
                  <strong>
                    {index + 1}. {member.name}
                  </strong>
                </div>
              ))}
              <button
                className="gold-button"
                type="button"
                onClick={() => {
                  onCommand("switchGame", {
                    game: "POKER",
                    smallBlind,
                    bigBlind,
                    seatOrder: members.map((member) => member.userId).join(","),
                  });
                  setSheet(null);
                }}
              >
                SWITCH TO TEXAS HOLD’EM
              </button>
              <button className="text-link" type="button" onClick={() => setSheet("game")}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "funding" ? (
            <>
              <h3>Limited Bank</h3>
              <input
                placeholder="Starting Bank jetons"
                value={startingBank}
                onChange={(event) => setStartingBank(event.target.value)}
                aria-label="Starting Bank jetons"
              />
              <button
                className="gold-button"
                type="button"
                onClick={() => {
                  onCommand("setBankFunding", { bankFundingMode: "LIMITED", startingBank });
                  setSheet(null);
                }}
              >
                Confirm Limited Bank
              </button>
              <button className="text-link" type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "menu" ? (
            <>
              <h3>Table</h3>
              {view.phase === "BETTING" ? (
                <button type="button" disabled={!view.actions.scheduleDeal} onClick={() => { onCommand("scheduleDeal"); setSheet(null); }}>
                  DEAL IN 7 SECONDS
                </button>
              ) : null}
              {view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE" ? (
                <button type="button" disabled={!view.actions.scheduleNextRound} onClick={() => { onCommand("scheduleNextRound"); setSheet(null); }}>
                  IN 7 SECONDS
                </button>
              ) : null}
              {view.actions.settleDealerWon ? (
                <button type="button" onClick={() => setSheet("dealerWon")}>
                  DEALER WON
                </button>
              ) : null}
              {view.phase === "BETTING" ? (
                <button type="button" onClick={() => { setSheet(null); setInviteOpen(true); }}>
                  ADD PLAYER
                </button>
              ) : view.isOwner && view.actions.addPlayer ? (
                <button type="button" onClick={() => setSheet("player")}>
                  ADD PLAYER
                </button>
              ) : null}
              {view.actions.giveJetons ? (
                <button type="button" onClick={() => setSheet("jetons")}>
                  GIVE JETONS
                </button>
              ) : null}
              {view.isOwner ? (
                <button type="button" onClick={() => setSheet("rename")}>
                  RENAME TABLE
                </button>
              ) : null}
              {ownerMenu.changeDealer ? (
                <button type="button" data-owner-change-dealer="true" onClick={() => setSheet("dealer")}>
                  Change Dealer
                </button>
              ) : null}
              {ownerMenu.changeGame ? (
                <button type="button" data-owner-change-game="true" onClick={() => setSheet("game")}>
                  Change Game
                </button>
              ) : null}
              {view.phase === "BETTING" && view.bankroll ? (
                <BankrollPanel
                  bankroll={view.bankroll}
                  manage
                  onToggle={(mode) => {
                    if (mode === "LIMITED") setSheet("funding");
                    else onCommand("setBankFunding", { bankFundingMode: "OPEN" });
                  }}
                />
              ) : null}
              <div className="field-label">OPTIONAL TOOLS</div>
              <div className="field-label">CARD ASSIST</div>
              <div className="setting-row">
                {(["OFF", "CONFIRM", "AUTO"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={(view.cardAssist ?? "OFF") === mode ? "active" : ""}
                    onClick={() => onCommand("setCardAssist", { cardAssist: mode })}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {view.isOwner ? (
                <>
                  <button className="gold-button" type="button" disabled={!view.actions.saveTable} onClick={() => { onCommand("saveTable"); setSheet(null); }}>
                    SAVE TABLE
                  </button>
                  <button className="gold-button" type="button" onClick={() => setSheet("close")}>
                    CLOSE TABLE & SAVE BALANCES
                  </button>
                </>
              ) : null}
              <button className="text-link" type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "close" ? (
            <>
              <h3>Close {view.tableName}</h3>
              <p>{view.closePreview?.confirmation ?? "Save each Player’s remaining jetons to their personal ledger and close this table?"}</p>
              {(view.closePreview?.players ?? []).map((player) => (
                <div className="member-row" key={player.userId}>
                  <div>
                    <strong>{player.name}</strong>
                    <div className="muted">Personal ledger · {player.available.label}</div>
                    <div className="muted">Locked {player.locked.label}</div>
                  </div>
                </div>
              ))}
              <button className="gold-button" type="button" disabled={!view.actions.closeTable} onClick={() => { onCommand("closeTable"); setSheet(null); }}>
                Confirm close
              </button>
              <button className="text-link" type="button" onClick={() => setSheet("menu")}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "dealerWon" ? (
            <>
              <h3>Dealer won</h3>
              <p>Dealer wins against all unresolved boxes?</p>
              <button
                className="gold-button"
                type="button"
                onClick={() => {
                  onCommand("settleDealerWon");
                  setSheet(null);
                }}
              >
                Confirm
              </button>
              <button className="text-link" type="button" onClick={() => setSheet("menu")}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "rename" ? (
            <>
              <h3>Rename table</h3>
              <label>
                Table name
                <input aria-label="Table name" value={tableName} onChange={(event) => setTableName(event.target.value)} />
              </label>
              <button
                className="gold-button"
                type="button"
                onClick={() => {
                  onCommand("updateSettings", { name: tableName });
                  setSheet(null);
                }}
              >
                Save name
              </button>
              <button className="text-link" type="button" onClick={() => setSheet("menu")}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "dealer" ? (
            <>
              <h3>Assign Dealer</h3>
              <label>
                Dealer
                <select aria-label="Dealer" value={dealerId} onChange={(event) => setDealerId(event.target.value)}>
                  {dealerCandidates.map((member) => (
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
                  setSheet(null);
                }}
              >
                Confirm dealer
              </button>
              <button className="text-link" type="button" onClick={() => setSheet("menu")}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "jetons" || sheet === "player" ? (
            <>
              <h3>{sheet === "jetons" ? "Give jetons" : "Add player"}</h3>
              {sheet === "jetons" ? (
                <>
                  <select value={memberId} onChange={(event) => setMemberId(event.target.value)} aria-label="Player">
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <input placeholder="Jeton amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </>
              ) : (
                <>
                  <input placeholder="Player name" aria-label="Player name" value={name} onChange={(event) => setName(event.target.value)} />
                  <input placeholder="Starting jetons" aria-label="Starting jetons" value={amount} onChange={(event) => setAmount(event.target.value)} />
                  <input placeholder="Email optional" aria-label="Player email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </>
              )}
              <div className="sheet-actions">
                <button type="button" onClick={() => setSheet(null)}>
                  Cancel
                </button>
                <button
                  className="gold-button"
                  type="button"
                  onClick={() => {
                    if (sheet === "jetons") {
                      onCommand("giveJetons", { userId: memberId, amount });
                    } else if (email.trim()) {
                      onCommand("addPlayer", { email, name });
                    } else {
                      onCommand("addPlayer", { name, startingJetons: amount });
                    }
                    setSheet(null);
                    setEmail("");
                    setName("");
                    setAmount("");
                  }}
                >
                  Confirm
                </button>
              </div>
            </>
          ) : null}
      </SheetOverlay>
    </TableShell>
  );
}
