"use client";

import { useState } from "react";
import type { BankTableView, MemberView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";
import { DealCountdown } from "./DealCountdown";
import { DealerPayoutRow } from "./DealerPayoutRow";
import { chipsFromMillis } from "./chips";

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
  const [sheet, setSheet] = useState<"player" | "jetons" | "menu" | "close" | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [memberId, setMemberId] = useState(members[0]?.userId ?? "");
  const showInsurance = view.phase === "PLAYING" || view.phase === "PAYOUT" || view.insurance.count > 0;
  const showNextRound = view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE";

  return (
    <PhoneShell rightLabel={`♠ ${view.boxCount}`} onMenu={view.isOwner ? () => setSheet("menu") : undefined}>
      <div>
        <div className="phase-head">
          <strong>{view.title}</strong>
          <span>{view.copy}</span>
        </div>
        <div className="bank-phase-control">
          <div className="current">
            CURRENT PHASE: <strong>{view.phaseLabel}</strong>
          </div>
          <DealCountdown deadline={view.bettingCloseDeadlineAt} />
          <DealCountdown deadline={view.nextRoundDeadlineAt} label="Next round in" />
          {view.phase === "BETTING" ? (
            <>
              <div className="deal-actions">
                <button type="button" disabled={!view.actions.dealCards} onClick={() => onCommand("dealCards")}>
                  DEAL CARDS NOW
                </button>
                <button type="button" disabled={!view.actions.scheduleDeal} onClick={() => onCommand("scheduleDeal")}>
                  DEAL IN 7 SECONDS
                </button>
              </div>
              <p className="muted phase-hint">DEAL CARDS NOW closes Betting and starts Playing.</p>
            </>
          ) : showNextRound ? (
            <>
              <div className="deal-actions">
                <button type="button" disabled={!view.actions.nextHand} onClick={() => onCommand("startNextRound")}>
                  NEXT ROUND NOW
                </button>
                <button
                  type="button"
                  disabled={!view.actions.scheduleNextRound}
                  onClick={() => onCommand("scheduleNextRound")}
                >
                  NEXT ROUND IN 7 SECONDS
                </button>
              </div>
              <p className="muted phase-hint">NEXT ROUND NOW starts the next Betting round.</p>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!view.primaryAction.enabled && view.primaryAction.id !== "payoutPhase"}
                onClick={() => {
                  if (view.primaryAction.id === "payoutPhase") onCommand("enterPayout");
                }}
              >
                PAYOUT PHASE
              </button>
              <p className="muted phase-hint">PAYOUT PHASE moves Playing to Payout.</p>
            </>
          )}
        </div>
      </div>
      <main className="felt dealer-list-felt">
        <div className="dealer-list">
          {view.players.length === 0
            ? view.boxes.map((box) => (
                <DealerPayoutRow
                  key={box.id}
                  box={box}
                  payoutEnabled={view.actions.settleBoxes}
                  onSettle={(outcome) => onCommand("settleBox", { boxId: box.id, outcome })}
                />
              ))
            : view.players.map((player) => (
                <section className="dealer-player" key={player.userId} data-player-group={player.userId}>
                  <header className="dealer-player-head">
                    <div>
                      <strong>{player.name}</strong>
                      <div className="muted">{player.status}</div>
                    </div>
                    <div className="dealer-player-balances">
                      <span>Available {player.available.label}</span>
                      <span>Locked {player.locked.label}</span>
                    </div>
                  </header>
                  {player.boxes.map((box) =>
                    view.actions.settleBoxes || box.outcome ? (
                      <DealerPayoutRow
                        key={box.id}
                        box={box}
                        payoutEnabled={view.actions.settleBoxes}
                        onSettle={(outcome) => onCommand("settleBox", { boxId: box.id, outcome })}
                      />
                    ) : (
                      <div className="payout-row is-idle" key={box.id} data-box-id={box.id}>
                        <div className="payout-row-inner">
                          <div>
                            <strong>{box.label}</strong>
                            <div className="muted">Stake {box.bet.label}</div>
                          </div>
                          <span className="chip-pile compact">
                            {chipsFromMillis(box.bet.millis).map((chip, index) => (
                              <span key={`${chip.label}-${index}`} className={`chip ${chip.className}`}>
                                {chip.label}
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </section>
              ))}
        </div>
      </main>
      <footer className="dock dealer-dock">
        {notice ? <div className="error">{notice}</div> : null}
        {showInsurance ? (
          <div className="insurance-pot">
            <div className="pot-head">
              <span>
                {view.insurance.window === "SETTLED"
                  ? `INSURANCE SETTLED · ${view.insurance.resolution === "DEALER_BLACKJACK" ? "Dealer Blackjack" : "No Blackjack"}`
                  : `INSURANCE SIDE POT · ${view.insurance.window} · ${view.insurance.count} bet${view.insurance.count === 1 ? "" : "s"}`}
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
                  Dealer Blackjack
                </button>
                <button type="button" className="insurance-lose" onClick={() => onCommand("settleInsurance", { resolution: "NO_DEALER_BLACKJACK" })}>
                  No Blackjack
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
        {view.actions.addPlayer || view.actions.giveJetons ? (
          <div className="dealer-tools">
            <button type="button" onClick={() => setSheet("player")}>
              ＋ Add player
            </button>
            <button type="button" onClick={() => setSheet("jetons")}>
              ◎ Give jetons
            </button>
          </div>
        ) : (
          <div className="payout-wait">
            {view.phase === "PAYOUT"
              ? `${view.boxes.filter((box) => box.outcome).length}/${view.boxes.length} boxes settled`
              : "Cards stay at the physical table"}
          </div>
        )}
      </footer>
      <div className={`sheet${sheet ? " open" : ""}`}>
        <div className="sheet-panel">
          {sheet === "menu" ? (
            <>
              <h3>Table</h3>
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
                  <input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
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
    </PhoneShell>
  );
}
