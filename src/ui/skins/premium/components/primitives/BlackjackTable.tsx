"use client";

import type { ReactNode } from "react";
import { BlackjackDealerPosition } from "./BlackjackDealerPosition";

export function BlackjackTable({
  tableName,
  phaseLabel,
  phaseInstruction,
  dealerName,
  dealerRanks,
  children,
}: {
  tableName: string;
  phaseLabel: string;
  phaseInstruction?: string;
  dealerName: string;
  dealerRanks?: string[];
  children: ReactNode;
}) {
  return (
    <div className="pm-bj-table" data-blackjack-table-surface="true" data-premium-bj-table="true">
      <div className="pm-bj-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="pm-bj-base"
          src="/skins/premium/blackjack-premium-table-base.jpg?v=2"
          alt=""
          draggable={false}
        />
        <div className="pm-bj-overlay">
          <div className="pm-bj-phase" data-phase-stack="true">
            <strong data-phase-heading>{phaseLabel}</strong>
            <em data-phase-instruction={phaseInstruction ? "true" : "false"}>{phaseInstruction || "\u00a0"}</em>
          </div>
          <div className="pm-bj-dealer-slot">
            <BlackjackDealerPosition name={dealerName} ranks={dealerRanks} />
          </div>
          <div className="pm-bj-name" data-felt-name="true">
            <strong data-table-name>{tableName}</strong>
          </div>
          <div className="pm-bj-boxes" data-table-zone="boxes" data-player-layer="true">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
