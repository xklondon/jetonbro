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

export function pokerSeatInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  const compact = (parts[0] ?? "P").replace(/[^a-zA-Z0-9]/g, "");
  return (compact.slice(0, 2) || "P").toUpperCase();
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
  const radiusX = count <= 2 ? 32 : count <= 4 ? 36 : 39;
  const radiusY = count <= 2 ? 34 : count <= 4 ? 37 : 40;
  return { left: `${50 + radiusX * Math.cos(angle)}%`, top: `${50 + radiusY * Math.sin(angle)}%` };
}

/** Chip stack sits inward from the seat toward the pot centre. */
export function pokerWagerPosition(index: number, count: number, viewerIndex: number): CSSProperties {
  const seat = pokerSeatPosition(index, count, viewerIndex) as { left: string; top: string };
  const left = Number.parseFloat(seat.left);
  const top = Number.parseFloat(seat.top);
  const inward = 0.52;
  return {
    left: `${50 + (left - 50) * inward}%`,
    top: `${50 + (top - 50) * inward}%`,
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
  const displayName = isYou ? "You" : seat.name;

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
            {seat.isSmallBlind ? (
              <span className="tt-blind is-sb" aria-label="Small Blind">
                SB
              </span>
            ) : null}
            {seat.isBigBlind ? (
              <span className="tt-blind is-bb" aria-label="Big Blind">
                BB
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="tt-seat-medal" aria-hidden="true" data-seat-initials="true">
          <span>{pokerSeatInitials(seat.name)}</span>
        </div>
        <div className="tt-seat-ledger">
          <strong className="tt-seat-name">{displayName}</strong>
          <span className="tt-seat-line" data-seat-balance="true">
            {seat.available.label}
          </span>
        </div>
        {award ? (
          <em className="tt-seat-status is-won" data-award="true">
            WON {award.amount.label}
          </em>
        ) : status === "YOUR TURN" || status === "TURN" ? (
          <em className={`tt-seat-turn${status === "YOUR TURN" ? " is-you" : ""}`} data-turn-badge="true">
            {status}
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
