"use client";

import { PhoneShell } from "./PhoneShell";
import { PlayerWallet } from "./PlayerWallet";
import type { WaitingTableView } from "@/application/queries/views";

export function ClassicWaitingTable({ view }: { view: WaitingTableView }) {
  return (
    <PhoneShell>
      <div className="phase-head">
        <strong>{view.tableName}</strong>
        <span>{view.game}</span>
      </div>
      <main className="felt">
        <div className="setup-card" style={{ width: "100%" }}>
          <strong>{view.copy}</strong>
          <p className="muted">Your jetons stay on this table until the Bank opens betting.</p>
        </div>
      </main>
      <footer className="dock player-dock">
        <PlayerWallet available={view.available} trayEnabled={false} dropSelector="[data-drop-box]" />
      </footer>
    </PhoneShell>
  );
}
