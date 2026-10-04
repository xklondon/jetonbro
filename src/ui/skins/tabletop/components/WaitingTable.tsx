"use client";

import type { WaitingTableView } from "@/application/queries/views";
import { Shell } from "./Shell";
import { Wallet } from "./Tray";
import { ClothName, DealerMark, PhasePill } from "./Spot";

/** Player Phase 0: one empty betting spot on the felt and the permanent wallet below. */
export function WaitingTable({ view }: { view: WaitingTableView }) {
  return (
    <Shell
      hideBrand
      balance={view.available.label}
      rail={<Wallet available={view.available} trayEnabled={false} dropSelector="[data-drop-box]" />}
      feltClassName="tt-bj-player"
      feltProps={{ "data-table-board": "PHASE_ZERO_PLAYER", "data-box-count": 1 }}
    >
      <DealerMark />
      <PhasePill label="Waiting for the table to open betting." />
      <ClothName name={view.tableName} />
      <div className="tt-stage">
        <div className="tt-boxes" data-box-stage="true" data-box-count="1" data-count="1">
          <div className="tt-box-wrap" data-slot="1">
            <div className="tt-box is-ghost" data-empty-slot={1} data-box-slot={1} aria-hidden="true">
              <span className="tt-box-name">BOX 1</span>
              <span className="tt-amount">0</span>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
