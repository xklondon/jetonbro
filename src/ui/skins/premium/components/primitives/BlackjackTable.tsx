"use client";

import type { ReactNode } from "react";
import { BlackjackDealerPosition } from "./BlackjackDealerPosition";

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
  /** TABLE SETUP — no betting-box stage */
  setup?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className="pm-bj-table"
      data-blackjack-table-surface="true"
      data-premium-bj-table="true"
      data-bj-setup={setup ? "true" : "false"}
    >
      <div className="pm-bj-stage" data-bj-stage="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="pm-bj-base"
          src="/skins/premium/blackjack-premium-table-base.jpg?v=3"
          alt=""
          draggable={false}
        />
        <div className="pm-bj-overlay">
          <div className="pm-bj-phase" data-phase-stack="true">
            <strong data-phase-heading>{phaseLabel}</strong>
            {phaseInstruction ? <em data-phase-instruction="true">{phaseInstruction}</em> : null}
          </div>
          <div className="pm-bj-dealer-slot" data-dealer-anchor="true">
            <BlackjackDealerPosition name={dealerName} ranks={dealerRanks} />
          </div>
          <div className="pm-bj-name" data-felt-name="true" data-table-name-anchor="true">
            <strong data-table-name>{tableName}</strong>
          </div>
          {setup ? (
            <div className="pm-bj-setup-layer" data-table-zone="setup">
              {children}
            </div>
          ) : (
            <div className="pm-bj-boxes" data-table-zone="boxes" data-player-layer="true">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
