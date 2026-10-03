"use client";

import type { WaitingTableView } from "@/application/queries/views";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { PlayerWallet } from "./PlayerWallet";
import { ClothName } from "./ClothName";

export function ClassicWaitingTable({ view }: { view: WaitingTableView }) {
  return (
    <TableShell feltIdentity balance={view.available.label}>
      <PhaseBar label={view.copy || "WAITING FOR PLAYERS"} />
      <main className="felt setup-felt phase-zero-felt player-phase-zero" data-table-board="PHASE_ZERO_PLAYER">
        <div className="table-surface">
          <ClothName name={view.tableName} />
        </div>
      </main>
      <footer className="dock player-dock">
        <PlayerWallet available={view.available} trayEnabled={false} dropSelector="[data-drop-box]" />
      </footer>
    </TableShell>
  );
}
