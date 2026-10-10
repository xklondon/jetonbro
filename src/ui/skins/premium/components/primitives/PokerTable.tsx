"use client";

import type { PokerSeatView } from "@/application/queries/views";
import { PhaseJourney } from "./PhaseJourney";
import { PokerPot } from "./PokerPot";
import { PokerSeat } from "./PokerSeat";

/**
 * Stable portrait seat anchors (percent of stage).
 * Centre corridor (~32–68% x, ~28–52% y) reserved for name / journey / pot.
 */
function seatLayout(count: number): { left: string; top: string; wagerLeft: string; wagerTop: string }[] {
  if (count <= 2) {
    return [
      { left: "50%", top: "84%", wagerLeft: "50%", wagerTop: "68%" },
      { left: "50%", top: "16%", wagerLeft: "50%", wagerTop: "30%" },
    ];
  }
  if (count === 3) {
    return [
      { left: "50%", top: "84%", wagerLeft: "50%", wagerTop: "68%" },
      { left: "16%", top: "36%", wagerLeft: "28%", wagerTop: "46%" },
      { left: "84%", top: "36%", wagerLeft: "72%", wagerTop: "46%" },
    ];
  }
  return [
    { left: "50%", top: "84%", wagerLeft: "50%", wagerTop: "68%" },
    { left: "14%", top: "48%", wagerLeft: "26%", wagerTop: "52%" },
    { left: "50%", top: "14%", wagerLeft: "50%", wagerTop: "28%" },
    { left: "86%", top: "48%", wagerLeft: "74%", wagerTop: "52%" },
  ];
}

export function PokerTable({
  tableName,
  instruction,
  phase,
  pot,
  seats,
  viewerId,
}: {
  tableName: string;
  /** Setup-only short instruction — never a live phase heading. */
  instruction?: string;
  phase: string;
  pot: string;
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
        <div className="pm-poker-overlay">
          {setup && instruction ? (
            <div className="pm-poker-setup-copy" data-phase-stack="true">
              <strong data-phase-heading>TABLE SETUP</strong>
              <em>{instruction}</em>
            </div>
          ) : null}
          <div className="pm-poker-felt-name" data-felt-name="true" data-table-name-anchor="true">
            <span data-table-name>{tableName}</span>
          </div>
          <PhaseJourney phase={phase} />
          {showPot ? <PokerPot amount={pot} /> : null}
          {ordered.map((seat, index) => {
            const pos = layout[Math.min(index, layout.length - 1)]!;
            const isViewer = seat.userId === viewerId;
            return (
              <PokerSeat
                key={seat.userId}
                seat={seat}
                showStartingStack={setup && isViewer}
                style={{ left: pos.left, top: pos.top }}
                wagerStyle={
                  !setup && seat.streetContribution.label !== "0"
                    ? { left: pos.wagerLeft, top: pos.wagerTop }
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
