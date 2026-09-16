"use client";

import type { PokerTableView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";
import { OutcomeCelebrationOverlay } from "./OutcomeCelebration";
import { PokerPlayerDock } from "./PokerPlayerDock";

export function ClassicPokerPlayer({
  view,
  onCommand,
  notice,
}: {
  view: PokerTableView;
  onCommand: (command: string, payload?: Record<string, string>) => void;
  notice?: string | null;
}) {
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
        <div className="poker-pot" data-drop-pot="pot">
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
      <footer className="dock player-dock">
        <PokerPlayerDock view={view} onCommand={onCommand} notice={notice} />
      </footer>
      {selfWon ? (
        <OutcomeCelebrationOverlay celebration={{ kind: "rain", copy: "WINNER!", overlay: true }} />
      ) : null}
    </PhoneShell>
  );
}
