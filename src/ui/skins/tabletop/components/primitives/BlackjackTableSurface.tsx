"use client";

import type { ReactNode } from "react";
import { PhaseDisplay } from "./PhaseDisplay";
import { TableName } from "./TableName";

/**
 * Cloth markings printed into the emerald felt — not page headings.
 * One insurance arc + payout / house rules + subtle betting arcs.
 */
function ClothMarkings() {
  return (
    <div className="tt-bj-cloth-marks" data-felt-markings="true" aria-hidden="true">
      <svg className="tt-bj-ins-arc" viewBox="0 0 360 40" preserveAspectRatio="xMidYMid meet" focusable="false">
        <path
          d="M28 30 C 100 8, 260 8, 332 30"
          fill="none"
          stroke="rgba(212,184,130,0.48)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <p className="tt-bj-mark is-ins">INSURANCE PAYS 2 TO 1</p>
      <p className="tt-bj-mark is-bj">BLACKJACK PAYS 3 TO 2</p>
      <p className="tt-bj-mark is-dealer17">DEALER STANDS ON 17</p>
      <svg className="tt-bj-bet-arcs" viewBox="0 0 360 56" preserveAspectRatio="xMidYMid meet" focusable="false">
        <path d="M48 44 C 110 12, 250 12, 312 44" fill="none" stroke="rgba(212,184,130,0.28)" strokeWidth="1.2" />
        <path d="M78 48 C 130 22, 230 22, 282 48" fill="none" stroke="rgba(212,184,130,0.2)" strokeWidth="1.05" />
        <ellipse cx="180" cy="40" rx="38" ry="14" fill="none" stroke="rgba(212,184,130,0.18)" strokeWidth="1" />
      </svg>
    </div>
  );
}

/**
 * Canonical Blackjack physical table for every phase (Dealer + Player).
 * Materials are owned here — not a full-height green Shell rectangle.
 * Zone geometry is fixed; only slot contents change by phase.
 */
export function BlackjackTableSurface({
  tableName,
  anatomy,
  phaseLabel,
  phaseInstruction,
  layout = "play",
  dealer,
  insurance,
  timers,
  children,
}: {
  tableName: string;
  anatomy: "dealer" | "player";
  phaseLabel: string;
  phaseInstruction?: string;
  layout?: "play" | "payout";
  dealer?: ReactNode;
  insurance?: ReactNode;
  timers?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="tt-bj-table"
      data-bj-felt="true"
      data-bj-anatomy={anatomy}
      data-bj-layout={layout}
      data-blackjack-table-surface="true"
      data-table-outer-rail="true"
    >
      <div className="tt-bj-physical" aria-hidden="true">
        <div className="tt-bj-wood" />
        <div className="tt-bj-leather" />
        <div className="tt-bj-gold" />
        <div className="tt-bj-cloth" data-poker-felt="false" />
      </div>

      <div className="tt-bj-zones" data-bj-zones="true">
        <div className="tt-bj-zone is-phase" data-table-zone="phase">
          <PhaseDisplay label={phaseLabel} instruction={phaseInstruction} />
          {timers}
          {insurance}
        </div>

        <div className="tt-bj-zone is-dealer" data-table-zone="dealer">
          {dealer ? (
            <section className="tt-bj-dealer-position" data-dealer-slot="true" aria-label="Dealer">
              {dealer}
            </section>
          ) : (
            <section className="tt-bj-dealer-position is-quiet" data-dealer-slot="true" aria-hidden="true" />
          )}
        </div>

        <div className="tt-bj-zone is-identity" data-table-zone="identity" data-felt-name="true">
          <TableName name={tableName} />
        </div>

        <div className="tt-bj-zone is-rules" data-table-zone="rules">
          <ClothMarkings />
        </div>

        <div
          className="tt-bj-zone is-boxes"
          data-table-zone="boxes"
          data-player-layer="true"
          data-dealer-boxes={anatomy === "dealer" ? "true" : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
