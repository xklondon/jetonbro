"use client";

import type { CSSProperties } from "react";
import type { PokerSeatView } from "@/application/queries/views";

/** Compact physical stack derived from seat available label — display only. */
function StartingStack({ label }: { label: string }) {
  const n = Math.max(1, Math.min(4, Math.ceil(Number(label) / 25) || 1));
  return (
    <div className="pm-poker-stack" data-starting-stack="true" aria-label={`${label} jetons`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="pm-poker-stack-chip" style={{ zIndex: n - i }} />
      ))}
      <strong>{label}</strong>
    </div>
  );
}

export function PokerSeat({
  seat,
  style,
  wagerStyle,
  showStartingStack = false,
}: {
  seat: PokerSeatView;
  style: CSSProperties;
  wagerStyle?: CSSProperties;
  showStartingStack?: boolean;
}) {
  const initial = (seat.name || "?").slice(0, 1).toUpperCase();
  const markers = [
    seat.isDealer ? "D" : null,
    seat.isSmallBlind ? "SB" : null,
    seat.isBigBlind ? "BB" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div
        className={`pm-poker-seat${seat.isActor ? " is-actor" : ""}`}
        style={style}
        data-seat-id={seat.userId}
        data-seat-edge="overlay"
        data-viewer-seat={showStartingStack ? "true" : undefined}
      >
        {showStartingStack ? <StartingStack label={seat.available.label} /> : null}
        <div className="pm-poker-seat-medal" aria-hidden="true">
          {initial}
        </div>
        <div className="pm-poker-seat-plaque">
          <strong>{seat.name}</strong>
          <span data-seat-balance="true">{seat.available.label}</span>
          {markers ? <span className="pm-poker-seat-markers">{markers}</span> : null}
          {seat.status && seat.status !== "ACTIVE" ? (
            <span className="pm-poker-seat-status">{seat.status.replace(/_/g, " ")}</span>
          ) : null}
        </div>
      </div>
      {seat.streetContribution.label !== "0" && wagerStyle ? (
        <div className="pm-poker-wager" style={wagerStyle}>
          {seat.streetContribution.label}
        </div>
      ) : null}
    </>
  );
}
