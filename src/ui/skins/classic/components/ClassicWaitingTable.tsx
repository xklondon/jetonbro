"use client";

import type { WaitingTableView } from "@/application/queries/views";
import { TableShell } from "./TableShell";
import { PlayerWallet } from "./PlayerWallet";

export function ClassicWaitingTable({ view }: { view: WaitingTableView }) {
  return (
    <TableShell title={view.tableName} balance={view.available.label}>
      <main className="felt bj-player" data-table-board="PHASE_ZERO_PLAYER" data-box-count="1">
        <div className="bj-phase">
          <strong data-phase-heading>Waiting for the table to open betting.</strong>
        </div>
        <div className="bj-dealer-spot" data-dealer-row="true">
          DEALER
        </div>
        <div className="bj-boxes" data-box-stage="true" data-box-count="1">
          <div className="box" data-empty-slot={1} data-box-slot={1} aria-hidden="true">
            <span className="box-name">BOX 1</span>
            <span className="amount">0</span>
          </div>
        </div>
      </main>
      <footer className="dock player-dock">
        <PlayerWallet available={view.available} trayEnabled={false} dropSelector="[data-drop-box]" />
      </footer>
    </TableShell>
  );
}
