"use client";

import { useState } from "react";
import type { BankTableView, MemberView } from "@/application/queries/views";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { PhaseActionDock } from "./PhaseActionDock";
import { TableIdentity } from "./TableIdentity";
import { PlayerRow } from "./PlayerRow";
import { DealCountdown } from "./DealCountdown";
import { DealerBlackjackBoxRow } from "./DealerBlackjackBoxRow";
import { DealerHandBox } from "./DealerHandBox";
import { BankrollPanel } from "./BankrollPanel";
import { SheetOverlay } from "./SheetOverlay";

function phaseCopy(view: BankTableView): { label: string; kicker: string } {
  if (view.insurance.window === "OPEN") return { label: "INSURANCE", kicker: "INSURANCE PHASE" };
  if (view.phase === "BETTING") return { label: "BETTING", kicker: "BETTING PHASE" };
  if (view.phase === "PLAYING") return { label: "PLAYING", kicker: "PLAYING PHASE" };
  if (view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE") {
    return { label: "PAYOUT", kicker: "PAYOUT PHASE" };
  }
  return { label: view.phaseLabel.replaceAll("_", " "), kicker: "" };
}

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
    "player" | "jetons" | "menu" | "close" | "funding" | "game" | "poker" | "rename" | "dealer" | null
  >(null);
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
  const dealerStatus =
    view.phase === "PLAYING"
      ? "Playing"
      : view.phase === "PAYOUT"
        ? "Payout"
        : view.phase === "BETTING"
          ? "Betting"
          : "Round complete";
  const dealerMember = members.find((member) => member.isBankDealer);
  const dealerPlays = Boolean(
    dealerMember && view.players.some((player) => player.userId === dealerMember.userId && player.boxes.length > 0),
  );
  const badges = [...(view.isOwner ? ["OWNER"] : []), dealerPlays ? "DEALER · PLAYING" : "DEALER"];

  function runPrimary() {
    if (view.primaryAction.id === "dealCards") onCommand("dealCards");
    if (view.primaryAction.id === "payoutPhase") onCommand("enterPayout");
    if (view.primaryAction.id === "nextHand") onCommand("startNextRound");
  }

  return (
    <TableShell badges={badges} onMenu={() => setSheet("menu")}>
      <PhaseBar label={phaseCopy(view).label} kicker={phaseCopy(view).kicker}>
        <PhaseActionDock>
          <DealCountdown deadline={view.bettingCloseDeadlineAt} />
          <DealCountdown deadline={view.nextRoundDeadlineAt} label="Next round in" />
          {view.phase === "BETTING" && (view.waitingForFirstBet || !view.hasValidBet) ? (
            <p className="waiting-first-bet">WAITING FOR THE FIRST BET</p>
          ) : null}
          {view.phase === "BETTING" ? (
            <div className="deal-actions next-round-row">
              <button type="button" disabled>
                OPEN BETTING
              </button>
              <button
                type="button"
                className={view.primaryAction.enabled ? "gold-button" : undefined}
                disabled={!view.primaryAction.enabled}
                onClick={runPrimary}
              >
                {view.primaryAction.label}
              </button>
            </div>
          ) : view.phase === "PLAYING" ? (
            <div className="deal-actions">
              {view.actions.openInsurance || view.actions.closeInsurance || view.insurance.window === "OPEN" ? (
                <div className="deal-actions next-round-row">
                  <button type="button" disabled={!view.actions.openInsurance} onClick={() => onCommand("openInsurance")}>
                    OPEN INSURANCE
                  </button>
                  <button type="button" disabled={!view.actions.closeInsurance} onClick={() => onCommand("closeInsurance")}>
                    CLOSE INSURANCE
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                className={view.primaryAction.enabled ? "gold-button" : undefined}
                disabled={!view.primaryAction.enabled}
                onClick={runPrimary}
              >
                {view.primaryAction.label}
              </button>
            </div>
          ) : (
            <div className="deal-actions">
              {view.actions.settleInsurance ? (
                <div className="deal-actions next-round-row">
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
              ) : null}
              <button
                type="button"
                className="gold-button"
                disabled={!view.primaryAction.enabled}
                onClick={runPrimary}
              >
                {view.primaryAction.label}
              </button>
            </div>
          )}
        </PhaseActionDock>
      </PhaseBar>
      <main className="felt dealer-list-felt">
        <div className="table-surface">
          <TableIdentity name={view.tableName} />
          <div className="dealer-ledger-head" aria-hidden="true">
            <span>#</span>
            <span>PLAYER</span>
            <span>{view.insurance.window === "OPEN" || view.phase === "PAYOUT" ? "MAIN" : "MAIN BET"}</span>
            <span>
              {view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE"
                ? "MAIN RESULT"
                : view.insurance.window === "OPEN" || view.phase === "PLAYING"
                  ? "INSURANCE"
                  : "ACTION"}
            </span>
          </div>
          <div className="dealer-list">
            <DealerHandBox
              name={view.dealerName ?? "Dealer"}
              status={dealerStatus}
              showDealerWon={Boolean(view.actions.settleDealerWon)}
              onDealerWon={() => onCommand("settleDealerWon")}
            />
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
              : view.players.map((player, index) => (
                  <PlayerRow
                    key={player.userId}
                    userId={player.userId}
                    index={index + 1}
                    name={player.name}
                    status={player.status}
                    available={player.available.label}
                    locked={player.locked.label}
                  >
                    {player.boxes.map((box) => (
                      <DealerBlackjackBoxRow
                        key={box.id}
                        box={box}
                        phase={view.phase}
                        payoutEnabled={view.actions.settleBoxes}
                        onSettle={(outcome) => onCommand("settleBox", { boxId: box.id, outcome })}
                      />
                    ))}
                  </PlayerRow>
                ))}
          </div>
        </div>
      </main>
      <footer className="dock dealer-dock">
        {notice ? <div className="error">{notice}</div> : null}
        <div className="dealer-stats">
          <div>
            <small>PLAYERS</small>
            <strong>{view.playerCount}</strong>
          </div>
          <div>
            <small>BOXES</small>
            <strong>{view.boxCount}</strong>
          </div>
          <div>
            <small>ON TABLE</small>
            <strong>{view.lockedOrdinary.label}</strong>
          </div>
          {view.phase === "BETTING" && view.bankroll?.mode === "LIMITED" ? (
            <div>
              <small>LIMITED BANK</small>
              <strong>{view.bankroll.available.label}</strong>
            </div>
          ) : null}
        </div>
      </footer>
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
              {view.isOwner && view.actions.addPlayer ? (
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
              {view.isOwner && view.actions.changeBank ? (
                <button type="button" onClick={() => setSheet("dealer")}>
                  ASSIGN DEALER
                </button>
              ) : null}
              {view.isOwner && view.actions.switchGame ? (
                <button type="button" onClick={() => setSheet("game")}>
                  SWITCH GAME
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
                  {members.map((member) => (
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
