"use client";

import type { PokerPotView, PokerSeatView } from "@/application/queries/views";
import { PhaseJourney } from "./PhaseJourney";
import { PokerPot } from "./PokerPot";
import { PokerSeat } from "./PokerSeat";

/**
 * Stable portrait seat anchors (percent of stage).
 * Centre corridor reserved for name / journey / pot (+ pot chips).
 * Street wagers are shown at the pot — not duplicated at seats.
 */
function seatLayout(count: number): { left: string; top: string }[] {
  // Bottom seat fully clear of the fixed wallet (plaque + wood lip, 390×844).
  if (count <= 2) {
    return [
      { left: "50%", top: "62%" },
      { left: "50%", top: "11%" },
    ];
  }
  if (count === 3) {
    return [
      { left: "50%", top: "62%" },
      { left: "12%", top: "40%" },
      { left: "88%", top: "40%" },
    ];
  }
  return [
    { left: "50%", top: "62%" },
    { left: "10%", top: "46%" },
    { left: "50%", top: "9%" },
    { left: "90%", top: "46%" },
  ];
}

export function PokerTable({
  tableName,
  instruction,
  phase,
  pot,
  potMillis,
  pots = [],
  seats,
  viewerId,
}: {
  tableName: string;
  /** Setup-only short instruction — never a live phase heading. */
  instruction?: string;
  phase: string;
  pot: string;
  potMillis?: string;
  pots?: PokerPotView[];
  seats: PokerSeatView[];
  viewerId: string;
}) {
  const ordered = [...seats].sort((a, b) => {
    if (a.userId === viewerId) return -1;
    if (b.userId === viewerId) return 1;
    return a.orderIndex - b.orderIndex;
  });
  const layout = seatLayout(ordered.length);
  const setup = phase === "POKER_SETUP" || phase === "TABLE_SETUP";
  const showPot = !setup && pot !== "0";
  /**
   * Side-pot labels only when a real side pot exists (all-in split).
   * Never re-list main-pot slices during a normal multi-way street.
   */
  const hasAllIn = seats.some((seat) => seat.status === "ALL_IN");
  const sidePots =
    hasAllIn && pots.length > 1
      ? pots
          .filter((item) => item.index > 0 && item.amount.label !== "0" && item.amount.label !== pot)
          .map((item) => ({ index: item.index, label: item.amount.label }))
      : [];

  return (
    <div
      className="pm-poker-table"
      data-poker-table="true"
      data-seat-layout={ordered.length <= 2 ? "heads-up" : "multi"}
    >
      <div className="pm-poker-stage" data-poker-stage="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="pm-poker-base"
          src="/skins/premium/poker-premium-racetrack-base.png"
          alt=""
          draggable={false}
        />
        <div className={`pm-poker-overlay${setup ? " is-setup" : ""}`}>
          {setup ? (
            <div className="pm-poker-setup-copy" data-phase-stack="true">
              <strong data-phase-heading>TABLE SETUP</strong>
              <span className="pm-poker-setup-table" data-felt-name="true" data-table-name-anchor="true">
                <span data-table-name>{tableName}</span>
              </span>
              {instruction ? <em>{instruction}</em> : null}
            </div>
          ) : (
            <div className="pm-poker-felt-name" data-felt-name="true" data-table-name-anchor="true">
              <span data-table-name>{tableName}</span>
            </div>
          )}
          <PhaseJourney phase={phase} />
          {showPot ? <PokerPot amount={pot} millis={potMillis} sidePots={sidePots} /> : null}
          {ordered.map((seat, index) => {
            const pos = layout[Math.min(index, layout.length - 1)]!;
            return (
              <PokerSeat
                key={seat.userId}
                seat={seat}
                showStartingStack={false}
                style={{ left: pos.left, top: pos.top }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
