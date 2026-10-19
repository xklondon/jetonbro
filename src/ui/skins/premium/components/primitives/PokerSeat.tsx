"use client";

import type { CSSProperties } from "react";
import type { PokerSeatView } from "@/application/queries/views";
import { CasinoChipStack } from "./CasinoJeton";

/** Starting stack — real CasinoJeton denominations (not blank green pills). */
function StartingStack({ millis, label }: { millis: string; label: string }) {
  return (
    <div className="pm-poker-stack" data-starting-stack="true" aria-label={`${label} jetons`}>
      <CasinoChipStack millis={millis} label={label} size="md" max={4} />
      <strong>{label}</strong>
    </div>
  );
}

export function PokerSeat({
  seat,
  style,
  showStartingStack = false,
}: {
  seat: PokerSeatView;
  style: CSSProperties;
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
    <div
      className={`pm-poker-seat${seat.isActor ? " is-actor" : ""}`}
      style={style}
      data-seat-id={seat.userId}
      data-seat-edge="overlay"
      data-viewer-seat={showStartingStack ? "true" : undefined}
    >
      {showStartingStack ? (
        <StartingStack millis={seat.available.millis} label={seat.available.label} />
      ) : null}
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
  );
}
