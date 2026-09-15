"use client";

import { useState } from "react";
import type { BankTableView, MemberView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";
import { DealCountdown } from "./DealCountdown";
import { FeltBox } from "./FeltBox";

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
  const [sheet, setSheet] = useState<"player" | "jetons" | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [memberId, setMemberId] = useState(members[0]?.userId ?? "");
  const showInsurance = view.phase === "PLAYING" || view.phase === "PAYOUT" || view.insurance.count > 0;

  return (
    <PhoneShell rightLabel={`♠ ${view.boxCount}`}>
      <div className="phase-head">
        <strong>{view.title}</strong>
        <span>{view.copy}</span>
      </div>
      <div className="bank-phase-control">
        <div className="current">
          CURRENT PHASE: <strong>{view.phaseLabel}</strong>
        </div>
        <DealCountdown deadline={view.bettingCloseDeadlineAt} />
        {view.phase === "BETTING" ? (
          <div className="deal-actions">
            <button type="button" disabled={!view.actions.dealCards} onClick={() => onCommand("dealCards")}>
              DEAL CARDS NOW
            </button>
            <button type="button" disabled={!view.actions.scheduleDeal} onClick={() => onCommand("scheduleDeal")}>
              DEAL IN 7 SECONDS
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!view.primaryAction.enabled && view.primaryAction.id !== "payoutPhase"}
            onClick={() => {
              if (view.primaryAction.id === "payoutPhase") onCommand("enterPayout");
              if (view.primaryAction.id === "nextHand") onCommand("startNextRound");
            }}
          >
            {view.primaryAction.label}
          </button>
        )}
      </div>
      <main className="felt">
        <div className="dealer-grid">
          {view.boxes.map((box) => (
            <FeltBox
              key={box.id}
              box={box}
              bank
              showOutcomes={view.actions.settleBoxes}
              onSettle={(outcome) => onCommand("settleBox", { boxId: box.id, outcome })}
            />
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
        </div>
      </div>
    </PhoneShell>
  );
}
