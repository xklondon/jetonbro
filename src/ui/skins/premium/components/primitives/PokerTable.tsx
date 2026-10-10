"use client";

import type { PokerSeatView } from "@/application/queries/views";
import { PhaseJourney } from "./PhaseJourney";
import { PokerPot } from "./PokerPot";
import { PokerSeat } from "./PokerSeat";

/** Portrait racetrack seat anchors (percent of stage). Viewer near bottom. */
function seatLayout(count: number): { left: string; top: string; wagerLeft: string; wagerTop: string }[] {
  if (count <= 2) {
    return [
      { left: "50%", top: "78%", wagerLeft: "50%", wagerTop: "62%" },
      { left: "50%", top: "22%", wagerLeft: "50%", wagerTop: "34%" },
    ];
  }
  if (count === 3) {
    return [
      { left: "50%", top: "80%", wagerLeft: "50%", wagerTop: "64%" },
      { left: "18%", top: "38%", wagerLeft: "30%", wagerTop: "44%" },
      { left: "82%", top: "38%", wagerLeft: "70%", wagerTop: "44%" },
    ];
  }
  return [
    { left: "50%", top: "80%", wagerLeft: "50%", wagerTop: "64%" },
    { left: "16%", top: "48%", wagerLeft: "28%", wagerTop: "50%" },
    { left: "50%", top: "20%", wagerLeft: "50%", wagerTop: "32%" },
    { left: "84%", top: "48%", wagerLeft: "72%", wagerTop: "50%" },
  ];
}

export function PokerTable({
  tableName,
  phaseLabel,
  instruction,
  phase,
  pot,
  seats,
  viewerId,
}: {
  tableName: string;
  phaseLabel: string;
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
    <div className="pm-poker-table" data-poker-table="true" data-seat-layout={ordered.length <= 2 ? "heads-up" : "multi"}>
      <div className="pm-poker-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="pm-poker-base"
          src="/skins/premium/poker-premium-racetrack-base.png"
          alt=""
          draggable={false}
        />
        <div className="pm-poker-overlay">
          <div className="pm-poker-phase" data-phase-stack="true">
            <strong data-phase-heading>{phaseLabel}</strong>
            <em>{instruction || "\u00a0"}</em>
          </div>
          <div className="pm-poker-felt-name" data-felt-name="true">
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
