"use client";

import type { WaitingTableView } from "@/application/queries/views";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { TableIdentity } from "./TableIdentity";
import { PlayerWallet } from "./PlayerWallet";

export function ClassicWaitingTable({ view }: { view: WaitingTableView }) {
  return (
    <TableShell>
      <PhaseBar label={view.copy || "WAITING FOR PLAYERS"} />
      <main className="felt setup-felt phase-zero-felt player-phase-zero" data-table-board="PHASE_ZERO_PLAYER">
        <div className="table-surface">
          <TableIdentity name={view.tableName} />
          <div className="muted phase-zero-meta">
            {view.game}
            {view.ownerName ? ` · Owner · ${view.ownerName}` : ""}
            {view.bankName ? ` · DEALER · ${view.bankName}` : ""}
          </div>
          <p className="muted phase-zero-empty">The Bank opens betting when ready.</p>
        </div>
      </main>
      <footer className="dock player-dock">
        <PlayerWallet available={view.available} trayEnabled={false} dropSelector="[data-drop-box]" />
      </footer>
    </TableShell>
  );
}
