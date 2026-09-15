"use client";

import { PhoneShell } from "./PhoneShell";
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
        <div className="dock-top">
          <div>
            <small>YOUR JETONS</small>
            <strong>{view.available.label}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <small>AVAILABLE VALUE</small>
            <strong>{view.available.label}</strong>
          </div>
        </div>
        <div className="jetons">
          {["5", "10", "25", "50"].map((denom) => (
            <span key={denom} className={`chip c${denom}`}>
              {denom}
            </span>
          ))}
        </div>
      </footer>
    </PhoneShell>
  );
}
