"use client";

import type { ReactNode } from "react";
import { PhaseDisplay } from "./PhaseDisplay";
import { TableName } from "./TableName";

/** Decorative SVG table markings — presentation only; never invents boxes or Players. */
function FeltMarkings() {
  return (
    <svg className="tt-bj-markings" viewBox="0 0 390 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="tt-bj-cloth" cx="50%" cy="38%" r="72%">
          <stop offset="0%" stopColor="#0d6b52" />
          <stop offset="48%" stopColor="#075744" />
          <stop offset="100%" stopColor="#031a14" />
        </radialGradient>
        <pattern id="tt-bj-noise" width="48" height="48" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="8" r="0.6" fill="rgba(255,255,255,0.035)" />
          <circle cx="22" cy="18" r="0.5" fill="rgba(0,0,0,0.05)" />
          <circle cx="36" cy="30" r="0.55" fill="rgba(255,255,255,0.03)" />
          <circle cx="12" cy="38" r="0.45" fill="rgba(0,0,0,0.04)" />
        </pattern>
      </defs>
      <rect width="390" height="640" fill="url(#tt-bj-cloth)" />
      <rect width="390" height="640" fill="url(#tt-bj-noise)" />
      <ellipse cx="195" cy="320" rx="210" ry="280" fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="48" />
      {/* Double gold rail */}
      <path
        d="M18 78 C 70 18, 320 18, 372 78"
        fill="none"
        stroke="rgba(223,189,105,0.72)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M28 84 C 78 28, 312 28, 362 84"
        fill="none"
        stroke="rgba(244,220,150,0.35)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Insurance arc */}
      <path
        id="tt-bj-ins-arc"
        d="M70 168 C 130 118, 260 118, 320 168"
        fill="none"
        stroke="rgba(223,189,105,0.55)"
        strokeWidth="1.4"
      />
      <text className="tt-bj-mark-text is-arc" fill="rgba(223,189,105,0.7)">
        <textPath href="#tt-bj-ins-arc" startOffset="50%" textAnchor="middle">
          INSURANCE PAYS 2 TO 1
        </textPath>
      </text>
      <text x="195" y="214" textAnchor="middle" className="tt-bj-mark-text is-bj">
        BLACKJACK PAYS 3 TO 2
      </text>
      <text x="195" y="236" textAnchor="middle" className="tt-bj-mark-text is-rule">
        Dealer must draw to 16 and stand on 17
      </text>
      {/* Betting-box outline arcs along lower cloth */}
      <path d="M55 470 C 95 430, 145 430, 185 470" fill="none" stroke="rgba(223,189,105,0.28)" strokeWidth="1.5" />
      <path d="M205 470 C 245 430, 295 430, 335 470" fill="none" stroke="rgba(223,189,105,0.28)" strokeWidth="1.5" />
      <path d="M120 510 C 160 475, 230 475, 270 510" fill="none" stroke="rgba(223,189,105,0.22)" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * Canonical Blackjack table base: one physical felt with markings and overlays.
 * Dealer position and box stage / payout bars sit on the cloth; the table name is printed on the felt.
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
  /** Payout reserves a settlement region so embroidered name never overlaps bars. */
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
      data-felt-markings="true"
    >
      <FeltMarkings />
      <div className="tt-bj-table-chrome">
        <PhaseDisplay label={phaseLabel} instruction={phaseInstruction} />
        {timers}
        {insurance}
      </div>
      <div className="tt-bj-table-body">
        {dealer ? (
          <section className="tt-bj-dealer-position" data-dealer-slot="true" aria-label="Dealer">
            {dealer}
          </section>
        ) : (
          <section className="tt-bj-dealer-position is-quiet" data-dealer-slot="true" aria-hidden="true" />
        )}
        <div
          className="tt-bj-player-layer"
          data-player-layer="true"
          data-dealer-boxes={anatomy === "dealer" ? "true" : undefined}
        >
          {children}
        </div>
        <div className="tt-bj-felt-name" data-felt-name="true">
          <TableName name={tableName} />
        </div>
      </div>
    </div>
  );
}
