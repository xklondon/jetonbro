"use client";

import type { ReactNode } from "react";
import { PhaseDisplay } from "./PhaseDisplay";
import { TableName } from "./TableName";

/**
 * Canonical Blackjack table base: one felt surface with overlays.
 * Dealer position and Player bars sit on the cloth; the table name is printed on the felt.
 * Never a nested “felt inside felt” or a separate name plaque below the Players.
 */
export function BlackjackTableSurface({
  tableName,
  anatomy,
  phaseLabel,
  phaseInstruction,
  dealer,
  insurance,
  timers,
  children,
}: {
  tableName: string;
  anatomy: "dealer" | "player";
  phaseLabel: string;
  phaseInstruction?: string;
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
      data-blackjack-table-surface="true"
    >
      <PhaseDisplay label={phaseLabel} instruction={phaseInstruction} />
      {timers}
      {insurance}
      <div className="tt-bj-table-body">
        {dealer ? (
          <section className="tt-bj-dealer-position" data-dealer-slot="true" aria-label="Dealer">
            {dealer}
          </section>
        ) : (
          <section className="tt-bj-dealer-position is-quiet" data-dealer-slot="true" aria-hidden="true" />
        )}
        <div className="tt-bj-player-layer" data-player-layer="true" data-dealer-boxes={anatomy === "dealer" ? "true" : undefined}>
          {children}
        </div>
        <div className="tt-bj-felt-name" data-felt-name="true">
          <TableName name={tableName} />
        </div>
      </div>
    </div>
  );
}
