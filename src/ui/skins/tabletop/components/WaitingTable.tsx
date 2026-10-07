"use client";

import type { WaitingTableView } from "@/application/queries/views";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import { Shell } from "./Shell";
import { PlayerBox } from "./primitives/PlayerBox";
import { BlackjackTableSurface } from "./primitives/BlackjackTableSurface";
import { Wallet } from "./primitives/JetonTray";

/** Player Phase 0: same BlackjackTableSurface as Dealer; empty box on the felt. */
export function WaitingTable({ view }: { view: WaitingTableView }) {
  const phaseCopy = blackjackPhaseCopy({ role: "PLAYER", phase: "TABLE_SETUP" });
  return (
    <Shell
      hideBrand
      balance={view.available.label}
      rail={<Wallet available={view.available} trayEnabled={false} dropSelector="[data-drop-box]" />}
      feltClassName="tt-bj-player"
      feltProps={{ "data-table-board": "PHASE_ZERO_PLAYER", "data-box-count": 1 }}
    >
      <BlackjackTableSurface
        tableName={view.tableName}
        anatomy="player"
        phaseLabel={phaseCopy.primary}
        phaseInstruction={phaseCopy.instruction}
        dealer={
          <header className="tt-bj-dealer-band-head">
            <span>DEALER</span>
            <strong>Dealer</strong>
          </header>
        }
      >
        <div className="tt-bj-box-stage" data-box-stage="true" data-box-stage-y="lower">
          <div className="tt-bj-box-track" data-box-track="true" data-count="1" data-order="newest-left">
            <PlayerBox empty />
          </div>
        </div>
      </BlackjackTableSurface>
    </Shell>
  );
}
