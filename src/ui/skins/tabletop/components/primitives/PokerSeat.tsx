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
  return "";
}

export function pokerSeatInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  const compact = (parts[0] ?? "P").replace(/[^a-zA-Z0-9]/g, "");
  return (compact.slice(0, 2) || "P").toUpperCase();
}

export type PokerSeatEdge = "north" | "south" | "east" | "west";

function seatAngleDeg(index: number, count: number, viewerIndex: number): number {
  const start = viewerIndex >= 0 ? viewerIndex : 0;
  const relative = (index - start + count) % Math.max(count, 1);
  if (count <= 1) return 90;
  if (count === 2) return relative === 0 ? 90 : -90;
  if (count === 3) return [90, 215, 325][relative]!;
  if (count === 4) return [90, 0, -90, 180][relative]!;
  return 90 + (relative * 360) / count;
}

export function pokerSeatEdge(index: number, count: number, viewerIndex: number): PokerSeatEdge {
  const deg = ((seatAngleDeg(index, count, viewerIndex) % 360) + 360) % 360;
  if (deg > 45 && deg < 135) return "south";
  if (deg > 225 && deg < 315) return "north";
  if (deg >= 135 && deg <= 225) return "west";
  return "east";
}

/**
 * Perimeter anchors on the portrait racetrack stage.
 * Viewer at bottom rail; radii keep seats outside the centre safe zone.
 * Coordinates are % of `.tt-poker-stage`, not the viewport.
 */
export function pokerSeatPosition(index: number, count: number, viewerIndex: number): CSSProperties {
  const angleDeg = seatAngleDeg(index, count, viewerIndex);
  const angle = (angleDeg * Math.PI) / 180;
  // HU sits on the rails; multi-seat keeps a clearer centre safe zone.
  // Keep HU south seat high enough that the ledger is never clipped by the dock.
  const radiusX = count <= 2 ? 34 : count <= 4 ? 42 : 43;
  const radiusY = count <= 2 ? 44.5 : count <= 4 ? 41.5 : 42;
  return {
    left: `${50 + radiusX * Math.cos(angle)}%`,
    top: `${50 + radiusY * Math.sin(angle)}%`,
  };
}

/** Committed chips sit inward from the seat, still outside the pot safe zone. */
export function pokerWagerPosition(index: number, count: number, viewerIndex: number): CSSProperties {
  const seat = pokerSeatPosition(index, count, viewerIndex) as { left: string; top: string };
  const left = Number.parseFloat(seat.left);
  const top = Number.parseFloat(seat.top);
  const inward = count <= 2 ? 0.78 : 0.72;
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
        data-seat-edge={pokerSeatEdge(index, view.seats.length, view.seats.findIndex((item) => item.userId === view.viewerId))}
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
