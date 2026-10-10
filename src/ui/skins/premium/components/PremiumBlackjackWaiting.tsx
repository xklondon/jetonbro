"use client";

import type { WaitingTableView } from "@/application/queries/views";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import { PremiumShell } from "./PremiumShell";
import { CasinoConsole } from "./primitives/CasinoConsole";
import { BlackjackTable } from "./primitives/BlackjackTable";
import { BlackjackBox } from "./primitives/BlackjackBox";

export function PremiumBlackjackWaiting({ view }: { view: WaitingTableView }) {
  const phaseCopy = blackjackPhaseCopy({ role: "PLAYER", phase: "TABLE_SETUP" });
  return (
    <PremiumShell
      title={view.tableName}
      balance={view.available.label}
      board="PHASE_ZERO_PLAYER"
      dock={
        <CasinoConsole available={view.available.label} showTray trayEnabled={false} selectedChip={null} />
      }
    >
      <BlackjackTable
        tableName={view.tableName}
        phaseLabel={phaseCopy.primary}
        phaseInstruction={phaseCopy.instruction}
        dealerName={view.bankName || "Dealer"}
      >
        <BlackjackBox empty />
      </BlackjackTable>
    </PremiumShell>
  );
}
