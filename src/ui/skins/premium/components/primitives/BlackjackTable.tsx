"use client";

import type { ReactNode } from "react";
import { BlackjackDealerPosition } from "./BlackjackDealerPosition";

/**
 * Premium Blackjack physical table — composition authority:
 * design/reference/premium/blackjack-player-betting-authority.png
 *
 * Raster owns: walnut/leather chrome, emerald felt, curved rules.
 * JSX owns: phase copy, embroidered table name, dealer slot, dynamic boxes.
 */
export function BlackjackTable({
  tableName,
  phaseLabel,
  phaseInstruction,
  dealerName,
  dealerRanks,
  setup = false,
  children,
}: {
  tableName: string;
  phaseLabel: string;
  phaseInstruction?: string;
  dealerName: string;
  dealerRanks?: string[];
  setup?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="pm-bj" data-blackjack-table-surface="true" data-premium-bj-table="true" data-bj-setup={setup ? "true" : "false"}>
      <div className="pm-bj-frame" data-bj-stage="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="pm-bj-photo"
          src="/skins/premium/blackjack-premium-table-base.jpg?v=5"
          alt=""
          draggable={false}
        />
        <div className="pm-bj-layer">
          <div className="pm-bj-phase" data-phase-stack="true">
            <strong data-phase-heading>{phaseLabel}</strong>
            <em data-phase-instruction={phaseInstruction ? "true" : "false"}>
              {phaseInstruction || "\u00a0"}
            </em>
          </div>
          <div className="pm-bj-dealer" data-dealer-anchor="true">
            <BlackjackDealerPosition name={dealerName} ranks={dealerRanks} />
          </div>
          <div className="pm-bj-felt-name" data-felt-name="true" data-table-name-anchor="true">
            <strong data-table-name>{tableName}</strong>
            <i aria-hidden="true" />
          </div>
          {setup ? (
            <div className="pm-bj-setup" data-table-zone="setup">
              {children}
            </div>
          ) : (
            <div className="pm-bj-boxes" data-table-zone="boxes" data-player-layer="true">
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
