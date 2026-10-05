"use client";

import type { WaitingTableView } from "@/application/queries/views";
import { Shell } from "./Shell";
import { DealerMark } from "./Spot";
import { PhaseDisplay } from "./primitives/PhaseDisplay";
import { PlayerBox } from "./primitives/PlayerBox";
import { TableName } from "./primitives/TableName";
import { Wallet } from "./primitives/JetonTray";

/** Player Phase 0: empty betting box on the felt and the permanent wallet below. */
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
      <PhaseDisplay label="Waiting for the table to open betting." />
      <TableName name={view.tableName} />
      <div className="tt-stage">
        <div className="tt-boxes" data-box-stage="true" data-box-count="1" data-count="1">
          <PlayerBox empty />
        </div>
      </div>
    </Shell>
  );
}
