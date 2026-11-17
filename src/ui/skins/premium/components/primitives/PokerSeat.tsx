"use client";

import type { CSSProperties } from "react";
import type { PokerSeatView } from "@/application/queries/views";
import { CasinoChipStack, CasinoJeton } from "./CasinoJeton";

/** Starting stack — real CasinoJeton denominations (not blank green pills). */
function StartingStack({ millis, label }: { millis: string; label: string }) {
  return (
    <div className="pm-poker-stack" data-starting-stack="true" aria-label={`${label} jetons`}>
      <CasinoChipStack millis={millis} label={label} size="md" max={4} />
      <strong>{label}</strong>
    </div>
  );
}

function RoleBadge({
  kind,
  label,
}: {
  kind: "dealer" | "sb" | "bb";
  label: string;
}) {
  return (
    <span
      className={`pm-poker-role-badge is-${kind}`}
      data-dealer-button={kind === "dealer" ? "true" : undefined}
      data-blind-badge={kind === "dealer" ? undefined : kind}
      aria-label={kind === "dealer" ? "Dealer button" : kind === "sb" ? "Small blind" : "Big blind"}
    >
      {label}
    </span>
  );
}

/**
 * Compact cockpit seat — same structure for every player including the local viewer.
 * D / SB / BB live as external badges; active turn is a red panel border only.
 */
export function PokerSeat({
  seat,
  style,
  showStartingStack = false,
  isMe = false,
  toneIndex = 0,
  pendingWager = null,
  pendingChips = [],
}: {
  seat: PokerSeatView;
  style: CSSProperties;
  showStartingStack?: boolean;
  isMe?: boolean;
  /** Stable color lane for non-ME seats (0–3). */
  toneIndex?: number;
  /** Compose wager shown on the felt beside ME until Confirm. */
  pendingWager?: string | null;
  pendingChips?: string[];
}) {
  const displayName = isMe ? "YOU" : seat.name;
  const tone = isMe ? "me" : String(toneIndex % 4);
  const showPending = Boolean(isMe && pendingWager && pendingWager !== "0");

  return (
    <div
      className={`pm-poker-seat is-cockpit${seat.isActor ? " is-actor" : ""}${isMe ? " is-me" : ""}${
        seat.isDealer ? " is-dealer" : ""
      }${showPending ? " has-pending-wager" : ""} is-tone-${tone}`}
      style={style}
      data-seat-id={seat.userId}
      data-seat-edge="overlay"
      data-viewer-seat={isMe || showStartingStack ? "true" : undefined}
      data-seat-me={isMe ? "true" : undefined}
      data-seat-actor={seat.isActor ? "true" : undefined}
      data-seat-dealer={seat.isDealer ? "true" : undefined}
    >
      {seat.isDealer ? <RoleBadge kind="dealer" label="D" /> : null}
      {seat.isSmallBlind ? <RoleBadge kind="sb" label="SB" /> : null}
      {seat.isBigBlind ? <RoleBadge kind="bb" label="BB" /> : null}
      {showPending ? (
        <div
          className="pm-poker-pending-wager"
          data-pending-felt="true"
          data-pending-total={pendingWager ?? undefined}
          aria-label={`Pending wager ${pendingWager}`}
        >
          <div className="pm-poker-pending-wager-chips" data-pending-stack="true">
            {(pendingChips.length > 0 ? pendingChips : [pendingWager!]).slice(0, 6).map((face, index) => (
              <span key={`${face}-${index}`} className="pm-poker-pending-wager-chip">
                <CasinoJeton denomination={face} size="sm" label={face} />
              </span>
            ))}
          </div>
          <strong>{pendingWager}</strong>
        </div>
      ) : null}
      {showStartingStack ? (
        <StartingStack millis={seat.available.millis} label={seat.available.label} />
      ) : null}
      <div className="pm-poker-seat-cockpit" data-seat-cockpit="true">
        <strong className="pm-poker-seat-name">{displayName}</strong>
        <span className="pm-poker-seat-balance" data-seat-balance="true">
          <span className="pm-poker-seat-chip-ico" aria-hidden="true" />
          {seat.available.label}
        </span>
        {seat.status && seat.status !== "ACTIVE" ? (
          <span className="pm-poker-seat-status">{seat.status.replace(/_/g, " ")}</span>
        ) : null}
      </div>
    </div>
  );
}
