"use client";

import type { WaitingTableView } from "@/application/queries/views";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { PlayerWallet } from "./PlayerWallet";
import { ClothName } from "./ClothName";

export function ClassicWaitingTable({ view }: { view: WaitingTableView }) {
  return (
    <TableShell feltIdentity balance={view.available.label}>
      <PhaseBar label="Waiting for the table to open betting." />
      <main className="felt setup-felt phase-zero-felt player-phase-zero player-play-felt" data-table-board="PHASE_ZERO_PLAYER" data-box-count="1">
        <div className="table-surface">
          <ClothName name={view.tableName} />
          <div className="player-context">
            <div className="player-dealer-ring" data-dealer-row="true">
              DEALER
            </div>
          </div>
          <div className="player-box-stage" data-box-stage="true" data-box-count="1">
            <div className="box-slot" data-empty-slot={1} data-stage-slot={1} data-box-slot={1} aria-hidden="true" />
            <div className="box-slot is-focal" data-empty-slot={2} data-stage-slot={2} data-box-slot={2} aria-hidden="true" />
            <div className="box-slot" data-empty-slot={3} data-stage-slot={3} data-box-slot={3} aria-hidden="true" />
          </div>
        </div>
      </main>
      <footer className="dock player-dock">
        <PlayerWallet available={view.available} trayEnabled={false} dropSelector="[data-drop-box]" />
      </footer>
    </TableShell>
  );
}
