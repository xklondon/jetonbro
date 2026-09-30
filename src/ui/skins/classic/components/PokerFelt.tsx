"use client";

import type { PokerSeatView, PokerTableView } from "@/application/queries/views";
import { chipsFromMillis } from "./chips";
import { TableIdentity } from "./TableIdentity";

function seatStatus(seat: PokerSeatView, view: PokerTableView): string {
  if (view.phase === "HAND_COMPLETE") {
    if (seat.status === "FOLDED") return "FOLDED";
    if (view.winners.some((winner) => winner.userId === seat.userId)) return "WON";
    if (seat.status === "ALL_IN") return "ALL IN";
    return "";
  }
  if (view.phase === "SHOWDOWN") {
    if (seat.status === "FOLDED") return "FOLDED";
    if (seat.status === "ALL_IN") return "ALL IN";
    return "";
  }
  if (seat.status === "FOLDED") return "FOLDED";
  if (seat.status === "ALL_IN") return "ALL IN";
  if (seat.isActor) return seat.userId === view.viewerId ? "YOUR TURN" : "TURN";
  if (seat.streetAction === "CHECK") return "CHECKED";
  if (seat.streetAction === "CALL") return "CALLED";
  if (seat.streetAction === "BET") return "BET";
  if (seat.streetAction === "RAISE") return "RAISED";
  if (seat.streetAction === "ALL_IN") return "ALL IN";
  return "Waiting";
}

function PokerSeatRow({ seat, index, view }: { seat: PokerSeatView; index: number; view: PokerTableView }) {
  const live = view.phase !== "POKER_SETUP";
  const status = seatStatus(seat, view);
  const isYou = seat.userId === view.viewerId;
  return (
    <section
      className={`dealer-player poker-seat seat-plaque${seat.isActor && view.phase !== "HAND_COMPLETE" ? " is-actor" : ""}${seat.isDealer ? " is-dealer" : ""}${seat.status === "FOLDED" ? " is-folded" : ""}${seat.status === "ALL_IN" ? " is-allin" : ""}${isYou ? " is-you" : ""}`}
      data-player-id={seat.userId}
      data-actor={seat.isActor && view.phase !== "HAND_COMPLETE" ? "true" : "false"}
      data-seat-status={seat.status}
      data-seat-index={index + 1}
      data-dealer={seat.isDealer ? "true" : "false"}
      data-viewer-seat={isYou ? "true" : undefined}
      data-seat-available={seat.available.label}
    >
      <div className="poker-seat-grid">
        <div className="poker-seat-player">
          {live ? (
            <div className="poker-seat-markers">
              {seat.isDealer ? (
                <span className="dealer-badge" aria-label="Poker Dealer">
                  D
                </span>
              ) : null}
              {seat.isSmallBlind ? <span className="blind-badge">SB</span> : null}
              {seat.isBigBlind ? <span className="blind-badge">BB</span> : null}
            </div>
          ) : null}
          <strong className="truncate">{isYou ? `You · ${seat.name}` : seat.name}</strong>
          {status ? <div className="poker-seat-status">{status}</div> : null}
        </div>
        <div className="poker-seat-street" data-street-commit="true">
          <small>STREET</small> {live ? seat.streetContribution.label : "—"}
        </div>
        <div className="poker-seat-available">
          <small>AVAILABLE</small> {seat.available.label}
        </div>
      </div>
    </section>
  );
}

export function PokerFelt({ view }: { view: PokerTableView }) {
  const owed = !view.potPaid && view.phase !== "HAND_COMPLETE" && view.phase !== "SHOWDOWN" && view.toCall.millis !== "0";
  const sidePots = view.pots.length > 1 && view.seats.some((seat) => seat.status === "ALL_IN") && !view.potPaid;
  const potChips = chipsFromMillis(view.pot.millis);
  const setup = view.phase === "POKER_SETUP";

  return (
    <main className="felt poker-felt" data-card-editor="closed">
      <div className="table-surface poker-surface">
        <TableIdentity name={view.tableName} />
        {setup ? (
          <div className="poker-blinds">
            <span>
              SB <strong>{view.smallBlind.label}</strong>
            </span>
            <span>
              BB <strong>{view.bigBlind.label}</strong>
            </span>
          </div>
        ) : (
          <div className="poker-pot poker-pot-bar" data-drop-pot="pot" data-pot-paid={view.potPaid ? "true" : "false"}>
            <div className="poker-pot-cell">
              <small>{view.potPaid ? "POT PAID" : "POT"}</small>
              {view.potPaid ? null : <strong>{view.pot.label}</strong>}
            </div>
            {view.potPaid || view.phase === "HAND_COMPLETE" || view.phase === "SHOWDOWN" ? (
              <div className="poker-pot-cell">
                <small>&nbsp;</small>
                <strong>&nbsp;</strong>
              </div>
            ) : (
              <div className="poker-pot-cell">
                <small>TO CALL</small>
                {owed ? <strong>{view.toCall.label}</strong> : <strong>&nbsp;</strong>}
                {owed ? <span className="visually-hidden">TO CALL {view.toCall.label}</span> : null}
              </div>
            )}
            {!view.potPaid && view.pot.millis !== "0" ? (
              <span className="chip-pile compact poker-pot-chips">
                {potChips.map((chip, index) => (
                  <span key={`${chip.label}-${index}`} className={`chip ${chip.className}`}>
                    {chip.label}
                  </span>
                ))}
              </span>
            ) : null}
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
                    {winner.name} WON {winner.amount.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        <div className="poker-seat-columns" aria-hidden="true">
          <span>PLAYER</span>
          <span>STREET</span>
          <span>AVAILABLE</span>
        </div>
        <div className="dealer-list poker-seats">
          {view.seats.map((seat, index) => (
            <PokerSeatRow key={seat.userId} seat={seat} index={index} view={view} />
          ))}
        </div>
      </div>
    </main>
  );
}
