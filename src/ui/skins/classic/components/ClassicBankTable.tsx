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
import { CardEntryPanel } from "./CardEntryPanel";

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
  const [sheet, setSheet] = useState<"player" | "jetons" | "menu" | "close" | "funding" | "game" | "poker" | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [startingBank, setStartingBank] = useState(view.bankroll?.available.label || "500");
  const [smallBlind, setSmallBlind] = useState("5");
  const [bigBlind, setBigBlind] = useState("10");
  const memberIdDefault = members[0]?.userId ?? "";
  const [memberId, setMemberId] = useState(memberIdDefault);
  const showInsurance = view.phase === "PLAYING" || view.phase === "PAYOUT" || view.insurance.count > 0;
  const dealerStatus =
    view.phase === "PLAYING"
      ? "Playing"
      : view.phase === "PAYOUT"
        ? "Payout"
        : view.phase === "BETTING"
          ? "Betting"
          : "Round complete";

  function runPrimary() {
    if (view.primaryAction.id === "dealCards") onCommand("dealCards");
    if (view.primaryAction.id === "payoutPhase") onCommand("enterPayout");
    if (view.primaryAction.id === "nextHand") onCommand("startNextRound");
  }

  return (
    <TableShell rightLabel={`♠ ${view.boxCount}`} onMenu={() => setSheet("menu")}>
      <PhaseBar label={view.phaseLabel}>
        <PhaseActionDock>
          <DealCountdown deadline={view.bettingCloseDeadlineAt} />
          <DealCountdown deadline={view.nextRoundDeadlineAt} label="Next round in" />
          {view.phase === "BETTING" && (view.waitingForFirstBet || !view.hasValidBet) ? (
            <p className="waiting-first-bet">WAITING FOR THE FIRST BET</p>
          ) : null}
          {view.phase === "BETTING" ? (
            <div className="deal-actions">
              <button
                type="button"
                className={view.primaryAction.enabled ? "gold-button" : undefined}
                disabled={!view.primaryAction.enabled}
                onClick={runPrimary}
              >
                {view.primaryAction.label}
              </button>
              <button type="button" disabled={!view.actions.scheduleDeal} onClick={() => onCommand("scheduleDeal")}>
                DEAL IN 7 SECONDS
              </button>
            </div>
          ) : view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE" ? (
            <div className="deal-actions next-round-row">
              <button
                type="button"
                className="gold-button"
                disabled={!view.primaryAction.enabled}
                onClick={runPrimary}
              >
                {view.primaryAction.label}
              </button>
              <button type="button" disabled={!view.actions.scheduleNextRound} onClick={() => onCommand("scheduleNextRound")}>
                IN 7 SECONDS
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={view.primaryAction.enabled ? "gold-button" : undefined}
              disabled={!view.primaryAction.enabled}
              onClick={runPrimary}
            >
              {view.primaryAction.label}
            </button>
          )}
        </PhaseActionDock>
      </PhaseBar>
      <main className="felt dealer-list-felt">
        <div className="table-surface">
          <TableIdentity name={view.tableName} />
          <div className="dealer-list">
            <DealerHandBox
              name={view.dealerName ?? "Dealer"}
              hand={view.dealerHand}
              status={dealerStatus}
              cardAssist={view.cardAssist}
              showDealerWon={Boolean(view.actions.settleDealerWon)}
              onDealerWon={() => onCommand("settleDealerWon")}
              onAdd={(rank) => onCommand("addCard", { dealer: "true", rank })}
              onRemove={(index) => onCommand("removeCard", { dealer: "true", index: String(index) })}
              onComplete={() => onCommand("completeHand", { dealer: "true" })}
              onReopen={() => onCommand("reopenHand", { dealer: "true" })}
              onClear={() => onCommand("clearHand", { dealer: "true" })}
            />
            {view.players.length === 0
              ? view.boxes.map((box) => (
                  <DealerBlackjackBoxRow
                    key={box.id}
                    box={box}
                    phase={view.phase}
                    payoutEnabled={view.actions.settleBoxes}
                    cardAssist={view.cardAssist}
                    onSettle={(outcome) => onCommand("settleBox", { boxId: box.id, outcome })}
                  />
                ))
              : view.players.map((player) => (
                  <PlayerRow
                    key={player.userId}
                    userId={player.userId}
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
                        cardAssist={view.cardAssist}
                        onSettle={(outcome) => onCommand("settleBox", { boxId: box.id, outcome })}
                        cardEntry={
                          view.phase === "PLAYING" && view.cardAssist && view.cardAssist !== "OFF" ? (
                            <CardEntryPanel
                              hand={box.hand}
                              completeLabel="HAND COMPLETE"
                              canClear
                              compact
                              showCards={false}
                              onAdd={(rank) => onCommand("addCard", { boxId: box.id, rank })}
                              onRemove={(index) => onCommand("removeCard", { boxId: box.id, index: String(index) })}
                              onComplete={() => onCommand("completeHand", { boxId: box.id })}
                              onReopen={() => onCommand("reopenHand", { boxId: box.id })}
                              onClear={() => onCommand("clearHand", { boxId: box.id })}
                            />
                          ) : undefined
                        }
                      />
                    ))}
                  </PlayerRow>
                ))}
          </div>
        </div>
      </main>
      <footer className="dock dealer-dock">
        {notice ? <div className="error">{notice}</div> : null}
        {showInsurance ? (
          <div className="insurance-pot">
            <div className="pot-head">
              <span>
                {view.insurance.window === "SETTLED"
                  ? `INSURANCE SETTLED · ${view.insurance.resolution === "DEALER_BLACKJACK" ? "INSURANCE WON" : "INSURANCE LOST"}`
                  : `INSURANCE · ${view.insurance.window} · ${view.insurance.count}`}
              </span>
              <strong>{view.insurance.window === "SETTLED" ? "✓" : view.insurance.total.label}</strong>
            </div>
            {view.phase === "PLAYING" ? (
              <div className="insurance-settle">
                <button type="button" className="insurance-win" disabled={!view.actions.openInsurance} onClick={() => onCommand("openInsurance")}>
                  Open Insurance
                </button>
                <button type="button" className="insurance-lose" disabled={!view.actions.closeInsurance} onClick={() => onCommand("closeInsurance")}>
                  Close Insurance
                </button>
              </div>
            ) : null}
            {view.actions.settleInsurance ? (
              <div className="insurance-settle">
                <button type="button" className="insurance-win" onClick={() => onCommand("settleInsurance", { resolution: "DEALER_BLACKJACK" })}>
                  INSURANCE WON
                </button>
                <button type="button" className="insurance-lose" onClick={() => onCommand("settleInsurance", { resolution: "NO_DEALER_BLACKJACK" })}>
                  INSURANCE LOST
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
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
        </div>
        {view.phase === "BETTING" ? (
          <div className="dealer-tools betting-utilities">
            {view.actions.switchGame ? (
              <button type="button" onClick={() => setSheet("game")}>
                SWITCH GAME
              </button>
            ) : null}
            <button type="button" onClick={() => setSheet("player")}>
              ADD PLAYER
            </button>
            <button type="button" onClick={() => setSheet("jetons")}>
              GIVE JETONS
            </button>
          </div>
        ) : null}
        {view.phase === "BETTING" ? (
          <BankrollPanel
            bankroll={view.bankroll}
            manage
            onToggle={(mode) => {
              if (mode === "LIMITED") setSheet("funding");
              else onCommand("setBankFunding", { bankFundingMode: "OPEN" });
            }}
          />
        ) : null}
      </footer>
      <div className={`sheet${sheet ? " open" : ""}`}>
        <div className="sheet-panel">
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
              {view.actions.addPlayer ? (
                <button type="button" onClick={() => setSheet("player")}>
                  ADD PLAYER
                </button>
              ) : null}
              {view.actions.giveJetons ? (
                <button type="button" onClick={() => setSheet("jetons")}>
                  GIVE JETONS
                </button>
              ) : null}
              {view.actions.switchGame ? (
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
              <button className="gold-button" type="button" disabled={!view.actions.saveTable} onClick={() => { onCommand("saveTable"); setSheet(null); }}>
                SAVE TABLE
              </button>
              <button className="gold-button" type="button" onClick={() => setSheet("close")}>
                CLOSE TABLE & SAVE BALANCES
              </button>
              <button className="text-link" type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "close" ? (
            <>
              <h3>Close this table</h3>
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
          {sheet === "jetons" || sheet === "player" ? (
            <>
              <h3>{sheet === "jetons" ? "Give jetons" : "Add player"}</h3>
              {sheet === "jetons" ? (
                <>
                  <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
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
                  <input placeholder="Player name" value={name} onChange={(event) => setName(event.target.value)} />
                  <input placeholder="Email" aria-label="Player email" value={email} onChange={(event) => setEmail(event.target.value)} />
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
                    } else {
                      onCommand("addPlayer", { email, name });
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
        </div>
      </div>
    </TableShell>
  );
}
