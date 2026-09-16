"use client";

import { useState } from "react";
import type { PokerTableView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";
import { chipsFromMillis } from "./chips";
import { OutcomeCelebrationOverlay } from "./OutcomeCelebration";

export function ClassicPokerPlayer({
  view,
  onCommand,
  notice,
}: {
  view: PokerTableView;
  onCommand: (command: string, payload?: Record<string, string>) => void;
  notice?: string | null;
}) {
  const [raiseTo, setRaiseTo] = useState(view.legalActions.find((action) => action.raiseTo)?.raiseTo?.label ?? "");
  const raiseAction = view.legalActions.find((action) => action.type === "RAISE" || action.type === "BET");
  const selfWon = view.phase === "HAND_COMPLETE" && view.winners.some((winner) => winner.userId === view.viewerId);

  return (
    <PhoneShell>
      <div className="phase-head">
        <strong>{view.tableName}</strong>
        <span>{view.headline}</span>
      </div>
      {view.waitingCopy ? (
        <div className={`poker-turn-banner${view.waitingCopy === "YOUR TURN" ? " is-you" : ""}`} data-turn-state={view.waitingCopy === "YOUR TURN" ? "you" : "waiting"}>
          {view.waitingCopy}
        </div>
      ) : null}
      <main className="felt poker-felt">
        <div className="poker-pot">
          <small>POT</small>
          <strong>{view.pot.label}</strong>
          <div className="muted">To call {view.toCall.label}</div>
          {view.pots.length > 0 ? (
            <ul className="poker-pot-list">
              {view.pots.map((pot) => (
                <li key={pot.index} data-pot-index={pot.index}>
                  {pot.index === 0 ? "Main pot" : `Side pot ${pot.index}`} · {pot.amount.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="dealer-list">
          {view.seats.map((seat, index) => (
            <div
              key={seat.userId}
              className={`poker-seat${seat.isActor ? " is-actor" : ""}${seat.status === "FOLDED" ? " is-folded" : ""}`}
              data-player-id={seat.userId}
              data-actor={seat.isActor ? "true" : "false"}
              data-seat-index={index + 1}
            >
              <strong>{seat.name}</strong>
              <div className="muted">
                {seat.isDealer ? "D " : ""}
                {seat.isSmallBlind ? "SB " : ""}
                {seat.isBigBlind ? "BB " : ""}
                {seat.status === "ALL_IN" ? "ALL IN" : seat.status === "FOLDED" ? "Folded" : seat.contribution.label}
              </div>
            </div>
          ))}
        </div>
      </main>
      <footer className="dock">
        {notice ? <div className="error">{notice}</div> : null}
        {view.waitingCopy ? <div className="muted">{view.waitingCopy}</div> : null}
        {view.legalActions.length > 0 ? (
          <div className="poker-actions">
            {raiseAction ? (
              <div className="chip-pile compact">
                {["5", "10", "25", "50"].map((label) => (
                  <button key={label} type="button" className={`chip c${label}`} onClick={() => setRaiseTo(label)}>
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            {view.legalActions.map((action) =>
              action.type === "BET" || action.type === "RAISE" ? (
                <div key={action.type} className="raise-row">
                  <input
                    aria-label="Raise to"
                    value={raiseTo}
                    onChange={(event) => setRaiseTo(event.target.value)}
                    placeholder={action.raiseTo?.label ?? "Amount"}
                  />
                  <button
                    type="button"
                    onClick={() => onCommand("pokerAct", { type: action.type, amount: raiseTo || action.raiseTo?.label || action.amount.label })}
                  >
                    {action.label}
                  </button>
                </div>
              ) : (
                <button key={action.type} type="button" onClick={() => onCommand("pokerAct", { type: action.type })}>
                  {action.label}
                </button>
              ),
            )}
          </div>
        ) : null}
        <div className="dock-top">
          <div>
            <small>YOUR JETONS</small>
            <strong>{view.available.label}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <small>IN POT</small>
            <strong>{view.contribution.label}</strong>
          </div>
        </div>
        <div className="chip-pile compact">
          {chipsFromMillis(view.available.millis).map((chip, index) => (
            <span key={`${chip.label}-${index}`} className={`chip ${chip.className}`}>
              {chip.label}
            </span>
          ))}
        </div>
      </footer>
      {selfWon ? (
        <OutcomeCelebrationOverlay celebration={{ kind: "rain", copy: "WINNER!", overlay: true }} />
      ) : null}
    </PhoneShell>
  );
}
