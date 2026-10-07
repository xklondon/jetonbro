"use client";

import type { ReactNode } from "react";
import { PhaseDisplay } from "./PhaseDisplay";
import { TableName } from "./TableName";

/**
 * Rules-zone markings only — one shallow insurance arc + paired HTML copy.
 * No rails, no dark oval, no orphan lower arcs, no text behind Phase/Dealer.
 */
function RulesMarkings() {
  return (
    <div className="tt-bj-rules" data-felt-markings="true">
      <svg className="tt-bj-rules-arc" viewBox="0 0 320 36" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
        <path
          d="M24 28 C 88 6, 232 6, 296 28"
          fill="none"
          stroke="rgba(223,189,105,0.5)"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      </svg>
      <p className="tt-bj-rules-ins">INSURANCE PAYS 2 TO 1</p>
      <p className="tt-bj-rules-bj">BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17</p>
    </div>
  );
}

/**
 * Canonical Blackjack table: Shell owns the outer rail; this surface owns cloth zones.
 * Fixed non-overlapping zones for every phase — Dealer and Player share the same geometry.
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
  /** Payout keeps settlement in the boxes zone; identity stays above. */
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
    >
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

        <div className="tt-bj-zone is-rules" data-table-zone="rules">
          <RulesMarkings />
        </div>

        <div className="tt-bj-zone is-identity" data-table-zone="identity" data-felt-name="true">
          <TableName name={tableName} />
        </div>

        <div
          className="tt-bj-zone is-boxes"
          data-table-zone="boxes"
          data-player-layer="true"
          data-dealer-boxes={anatomy === "dealer" ? "true" : undefined}
        >
          {children}
        </div>

        <div className="tt-bj-zone is-clear" data-table-zone="clear" aria-hidden="true" />
      </div>
    </div>
  );
}
