"use client";

import type { PokerSeatView, PokerTableView } from "@/application/queries/views";
import { chipsFromMillis } from "./chips";

function seatStatus(seat: PokerSeatView): string {
  if (seat.status === "FOLDED") return "FOLDED";
  if (seat.status === "ALL_IN") return "ALL IN";
  if (seat.isActor) return "YOUR TURN";
  return "Waiting";
}

export function PokerFelt({ view }: { view: PokerTableView }) {
  const owed = view.toCall.millis !== "0";
  const sidePots = view.pots.length > 1;
  const potChips = chipsFromMillis(view.pot.millis);

  return (
    <main className="felt poker-felt">
      <div className="poker-pot" data-drop-pot="pot">
        {view.pot.millis !== "0" ? (
          <span className="chip-pile poker-pot-chips">
            {potChips.map((chip, index) => (
              <span key={`${chip.label}-${index}`} className="chip-slot">
                <span className={`chip ${chip.className}`}>{chip.label}</span>
              </span>
            ))}
          </span>
        ) : null}
        <strong>{view.pot.label}</strong>
        {owed ? <div className="poker-to-call">TO CALL {view.toCall.label}</div> : null}
        {sidePots ? (
          <ul className="poker-pot-list">
            {view.pots.map((pot) => (
              <li key={pot.index} data-pot-index={pot.index}>
                {pot.index === 0 ? "Main pot" : `Side pot ${pot.index}`} · {pot.amount.label}
                {pot.winnerPlayerIds.length > 0 ? " awarded" : ""}
              </li>
            ))}
          </ul>
        ) : null}
        {view.winners.length > 0 ? (
          <ul className="poker-pot-list" data-winners="true">
            {view.winners.map((winner) => (
              <li key={winner.userId}>
                {winner.name} · {winner.amount.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="dealer-list">
        {view.seats.map((seat, index) => (
          <section
            key={seat.userId}
            className={`dealer-player poker-seat${seat.isActor ? " is-actor" : ""}${seat.isDealer ? " is-dealer" : ""}${seat.status === "FOLDED" ? " is-folded" : ""}${seat.status === "ALL_IN" ? " is-allin" : ""}`}
            data-player-id={seat.userId}
            data-actor={seat.isActor ? "true" : "false"}
            data-seat-status={seat.status}
            data-seat-index={index + 1}
            data-dealer={seat.isDealer ? "true" : "false"}
          >
            <header className="dealer-player-head">
              <div>
                <strong>{seat.name}</strong>
                <div className="poker-seat-markers">
                  {seat.isDealer ? (
                    <span className="dealer-badge" aria-label="Poker Dealer">
                      D
                    </span>
                  ) : null}
                  {seat.isSmallBlind ? <span className="blind-badge">SB</span> : null}
                  {seat.isBigBlind ? <span className="blind-badge">BB</span> : null}
                </div>
                <div className="poker-seat-status">{seatStatus(seat)}</div>
              </div>
              <div className="dealer-player-balances">
                <span>
                  <small>AVAILABLE</small> {seat.available.label}
                </span>
                <span data-street-commit="true">{seat.streetContribution.label}</span>
              </div>
            </header>
          </section>
        ))}
      </div>
    </main>
  );
}
