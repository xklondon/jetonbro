"use client";

import type { CSSProperties } from "react";
import type { PokerSeatView, PokerTableView } from "@/application/queries/views";
import { ChipStack } from "./Jeton";

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
  if (view.phase === "POKER_SETUP") return "";
  return "Waiting";
}

/**
 * Seat angles around the oval. Viewer sits near the tray (bottom).
 * 2: top/bottom · 3: top, lower-left, lower-right · 4: NESW · 5–6: even ring.
 */
export function pokerSeatPosition(index: number, count: number, viewerIndex: number): CSSProperties {
  const start = viewerIndex >= 0 ? viewerIndex : 0;
  const relative = (index - start + count) % Math.max(count, 1);
  let angleDeg: number;
  if (count <= 1) {
    angleDeg = 90;
  } else if (count === 2) {
    angleDeg = relative === 0 ? 90 : -90;
  } else if (count === 3) {
    angleDeg = [90, 210, 330][relative]!;
  } else if (count === 4) {
    angleDeg = [90, 0, -90, 180][relative]!;
  } else {
    angleDeg = 90 + (relative * 360) / count;
  }
  const angle = (angleDeg * Math.PI) / 180;
  const radiusX = count <= 2 ? 34 : count <= 4 ? 38 : 41;
  const radiusY = count <= 2 ? 36 : count <= 4 ? 39 : 42;
  return { left: `${50 + radiusX * Math.cos(angle)}%`, top: `${48 + radiusY * Math.sin(angle)}%` };
}

/** Chip stack sits inward from the seat toward the pot centre. */
export function pokerWagerPosition(index: number, count: number, viewerIndex: number): CSSProperties {
  const seat = pokerSeatPosition(index, count, viewerIndex) as { left: string; top: string };
  const left = Number.parseFloat(seat.left);
  const top = Number.parseFloat(seat.top);
  const inward = 0.55;
  return {
    left: `${50 + (left - 50) * inward}%`,
    top: `${48 + (top - 48) * inward}%`,
  };
}

export function PokerSeat({
  seat,
  view,
  style,
  index,
}: {
  seat: PokerSeatView;
  view: PokerTableView;
  style: CSSProperties;
  index: number;
}) {
  const status = pokerSeatStatus(seat, view);
  const isYou = seat.userId === view.viewerId;
  const actor = Boolean(seat.isActor && view.phase !== "HAND_COMPLETE" && view.phase !== "SHOWDOWN" && view.phase !== "POKER_SETUP");
  const setup = view.phase === "POKER_SETUP";
  const won = view.phase === "HAND_COMPLETE" && view.winners.some((winner) => winner.userId === seat.userId);
  const award = view.winners.find((winner) => winner.userId === seat.userId);
  const streetMillis = BigInt(seat.streetContribution.millis || "0");
  const showWager = !setup && streetMillis > 0n && view.phase !== "HAND_COMPLETE";

  return (
    <>
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
        {award ? (
          <em className="tt-seat-status is-won" data-award="true">
            WON {award.amount.label}
          </em>
        ) : status ? (
          <em className="tt-seat-status">{status}</em>
        ) : null}
      </section>
      {showWager ? (
        <div
          className="tt-seat-wager"
          style={pokerWagerPosition(index, view.seats.length, view.seats.findIndex((item) => item.userId === view.viewerId))}
          data-street-commit="true"
          data-wager-for={seat.userId}
          aria-label={`${seat.name} wager ${seat.streetContribution.label}`}
        >
          <ChipStack millis={seat.streetContribution.millis} max={3} />
          <strong>{seat.streetContribution.label}</strong>
        </div>
      ) : null}
    </>
  );
}
