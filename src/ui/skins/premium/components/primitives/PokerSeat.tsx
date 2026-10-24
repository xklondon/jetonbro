"use client";

import type { CSSProperties } from "react";
import type { PokerSeatView } from "@/application/queries/views";
import { SUIT_GLYPH, type PokerCard } from "@/domain/poker/cards";
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

function HoleCards({ seat }: { seat: PokerSeatView }) {
  const visible = seat.holeCards ?? [];
  if (visible.length > 0) {
    return (
      <div className="pm-poker-hole" data-hole-cards="true" aria-label={`${seat.name} hole cards`}>
        {visible.map((card, index) => (
          <span
            key={`${card.rank}${card.suit}-${index}`}
            className="pm-playing-card is-mini"
            data-poker-card={`${card.rank}${card.suit}`}
          >
            {card.rank}
            {SUIT_GLYPH[card.suit as PokerCard["suit"]] ?? card.suit}
          </span>
        ))}
      </div>
    );
  }
  if (seat.hasHoleCards) {
    return (
      <div className="pm-poker-hole is-hidden" data-hole-cards="hidden" aria-label={`${seat.name} has hole cards`}>
        <span className="pm-playing-card is-mini is-back" />
        <span className="pm-playing-card is-mini is-back" />
      </div>
    );
  }
  return null;
}

export function PokerSeat({
  seat,
  style,
  showStartingStack = false,
  isMe = false,
  toneIndex = 0,
}: {
  seat: PokerSeatView;
  style: CSSProperties;
  showStartingStack?: boolean;
  isMe?: boolean;
  /** Stable color lane for non-ME seats (0–3). */
  toneIndex?: number;
}) {
  const initial = (seat.name || "?").slice(0, 1).toUpperCase();
  const markers = [
    seat.isDealer ? "D" : null,
    seat.isSmallBlind ? "SB" : null,
    seat.isBigBlind ? "BB" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const tone = isMe ? "me" : String(toneIndex % 4);

  return (
    <div
      className={`pm-poker-seat${seat.isActor ? " is-actor" : ""}${isMe ? " is-me" : ""} is-tone-${tone}`}
      style={style}
      data-seat-id={seat.userId}
      data-seat-edge="overlay"
      data-viewer-seat={isMe || showStartingStack ? "true" : undefined}
      data-seat-me={isMe ? "true" : undefined}
    >
      {showStartingStack ? (
        <StartingStack millis={seat.available.millis} label={seat.available.label} />
      ) : null}
      <HoleCards seat={seat} />
      <div className="pm-poker-seat-medal" aria-hidden="true">
        {isMe ? "ME" : initial}
      </div>
      <div className="pm-poker-seat-plaque">
        <strong>{isMe ? "ME" : seat.name}</strong>
        <span data-seat-balance="true">{seat.available.label}</span>
        {markers ? <span className="pm-poker-seat-markers">{markers}</span> : null}
        {seat.status && seat.status !== "ACTIVE" ? (
          <span className="pm-poker-seat-status">{seat.status.replace(/_/g, " ")}</span>
        ) : null}
      </div>
    </div>
  );
}
