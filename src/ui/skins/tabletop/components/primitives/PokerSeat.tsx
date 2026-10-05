"use client";

import type { PokerSeatView, PokerTableView } from "@/application/queries/views";

export function pokerSeatStatus(seat: PokerSeatView, view: PokerTableView): string {
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
  if (view.phase === "POKER_SETUP") return "";
  return "Waiting";
}

/** Seats around an ellipse; viewer sits near the tray (bottom). */
export function pokerSeatPosition(index: number, count: number, viewerIndex: number) {
  const start = viewerIndex >= 0 ? viewerIndex : 0;
  const angle = ((90 + ((index - start) * 360) / Math.max(count, 1)) * Math.PI) / 180;
  const radiusX = count <= 2 ? 34 : count <= 4 ? 38 : 41;
  const radiusY = count <= 2 ? 36 : count <= 4 ? 39 : 42;
  return { left: `${50 + radiusX * Math.cos(angle)}%`, top: `${48 + radiusY * Math.sin(angle)}%` };
}

export function PokerSeat({
  seat,
  view,
  style,
  index,
}: {
  seat: PokerSeatView;
  view: PokerTableView;
  style: { left: string; top: string };
  index: number;
}) {
  const status = pokerSeatStatus(seat, view);
  const isYou = seat.userId === view.viewerId;
  const actor = Boolean(seat.isActor && view.phase !== "HAND_COMPLETE" && view.phase !== "SHOWDOWN" && view.phase !== "POKER_SETUP");
  const setup = view.phase === "POKER_SETUP";
  const won = view.phase === "HAND_COMPLETE" && view.winners.some((winner) => winner.userId === seat.userId);
  const award = view.winners.find((winner) => winner.userId === seat.userId);

  return (
    <section
      className={`tt-seat${actor ? " is-actor" : ""}${seat.isDealer ? " is-dealer" : ""}${seat.status === "FOLDED" ? " is-folded" : ""}${seat.status === "ALL_IN" ? " is-allin" : ""}${isYou ? " is-you" : ""}${won ? " is-winner" : ""}`}
      style={style}
      data-player-id={seat.userId}
      data-actor={actor ? "true" : "false"}
      data-seat-status={seat.status}
      data-seat-index={index + 1}
      data-dealer={seat.isDealer ? "true" : "false"}
      data-viewer-seat={isYou ? "true" : undefined}
      data-seat-available={seat.available.label}
    >
      {!setup ? (
        <div className="tt-seat-markers">
          {seat.isDealer ? (
            <span className="tt-dealer-button" aria-label="Poker Dealer">
              D
            </span>
          ) : null}
          {seat.isSmallBlind ? <span className="tt-blind">SB</span> : null}
          {seat.isBigBlind ? <span className="tt-blind">BB</span> : null}
        </div>
      ) : null}
      <strong className="tt-seat-name">{isYou ? `YOU · ${seat.name}` : seat.name}</strong>
      <span className="tt-seat-line">
        <small>AVAILABLE</small> {seat.available.label}
      </span>
      {!setup ? (
        <span className="tt-seat-line" data-street-commit="true">
          <small>STREET</small> {seat.streetContribution.label}
        </span>
      ) : null}
      {award ? (
        <em className="tt-seat-status is-won" data-award="true">
          WON {award.amount.label}
        </em>
      ) : status ? (
        <em className="tt-seat-status">{status}</em>
      ) : null}
    </section>
  );
}
