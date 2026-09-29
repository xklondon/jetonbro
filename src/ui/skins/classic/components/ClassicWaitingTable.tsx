"use client";

import type { WaitingTableView } from "@/application/queries/views";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { TableIdentity } from "./TableIdentity";
import { DealerRow } from "./DealerRow";
import { PlayerWallet } from "./PlayerWallet";

export function ClassicWaitingTable({ view }: { view: WaitingTableView }) {
  return (
    <TableShell>
      <PhaseBar label="TABLE SETUP" />
      <main className="felt setup-felt">
        <div className="table-surface">
          <TableIdentity name={view.tableName} />
          {view.bankName ? <DealerRow name={view.bankName} /> : null}
          <div className="muted">{view.copy}</div>
        </div>
      </main>
      <footer className="dock player-dock">
        <PlayerWallet available={view.available} trayEnabled={false} dropSelector="[data-drop-box]" />
      </footer>
    </TableShell>
  );
}
