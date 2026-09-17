"use client";

import type { PokerTableView } from "@/application/queries/views";

export function PokerFelt({
  view,
  onReorder,
}: {
  view: PokerTableView;
  onReorder?: (seatOrder: string) => void;
}) {
  return (
    <main className="felt poker-felt">
      <div className="poker-pot" data-drop-pot="pot">
        <small>POT</small>
        <strong>{view.pot.label}</strong>
        <div className="poker-pot-meta">
          <span>SB {view.smallBlind.label}</span>
          <span>BB {view.bigBlind.label}</span>
          {view.phase !== "POKER_SETUP" && view.phase !== "HAND_COMPLETE" ? (
            <span>CURRENT BET {view.streetWager.label}</span>
          ) : null}
          <span>TO CALL {view.toCall.label}</span>
        </div>
        {view.pots.length > 0 ? (
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
      {view.canReorderSeats && onReorder ? (
        <ol className="seat-order" aria-label="Dealer rotation order">
          {view.seats.map((seat, index) => (
            <li key={seat.userId} className="seat-order-row">
              <span>
                {index + 1}. {seat.name}
              </span>
              <span className="seat-order-controls">
                <button
                  type="button"
                  aria-label={`Move ${seat.name} up`}
                  disabled={index === 0}
                  onClick={() => {
                    const ids = view.seats.map((item) => item.userId);
                    const next = [...ids];
                    const [item] = next.splice(index, 1);
                    next.splice(index - 1, 0, item!);
                    onReorder(next.join(","));
                  }}
                >
                  Move up
                </button>
                <button
                  type="button"
                  aria-label={`Move ${seat.name} down`}
                  disabled={index === view.seats.length - 1}
                  onClick={() => {
                    const ids = view.seats.map((item) => item.userId);
                    const next = [...ids];
                    const [item] = next.splice(index, 1);
                    next.splice(index + 1, 0, item!);
                    onReorder(next.join(","));
                  }}
                >
                  Move down
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="dealer-list">
        {view.seats.map((seat, index) => (
          <section
            key={seat.userId}
            className={`dealer-player poker-seat${seat.isActor ? " is-actor" : ""}${seat.status === "FOLDED" ? " is-folded" : ""}${seat.status === "ALL_IN" ? " is-allin" : ""}`}
            data-player-id={seat.userId}
            data-actor={seat.isActor ? "true" : "false"}
            data-seat-status={seat.status}
            data-seat-index={index + 1}
          >
            <header className="dealer-player-head">
              <div>
                <strong>{seat.name}</strong>
                <div className="muted">
                  {seat.isDealer ? "D · " : ""}
                  {seat.isSmallBlind ? "SB · " : ""}
                  {seat.isBigBlind ? "BB · " : ""}
                  {seat.isActor ? "TURN · " : ""}
                  {seat.status === "ALL_IN" ? "ALL IN" : seat.status === "FOLDED" ? "Folded" : seat.status === "WAITING" ? "Ready" : "In"}
                </div>
              </div>
              <div className="dealer-player-balances">
                <span>Stack {seat.available.label}</span>
                <span>In {seat.contribution.label}</span>
              </div>
            </header>
          </section>
        ))}
      </div>
    </main>
  );
}
