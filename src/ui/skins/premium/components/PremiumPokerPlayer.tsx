"use client";

import { useState } from "react";
import type { PokerTableView } from "@/application/queries/views";
import { pokerPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumShell } from "./PremiumShell";
import { CasinoConsole } from "./primitives/CasinoConsole";
import { PokerTable } from "./primitives/PokerTable";

export function PremiumPokerPlayer({
  view,
  onCommand,
  notice,
}: {
  view: PokerTableView;
  onCommand: CommandHandler;
  notice?: string | null;
}) {
  const phaseCopy = pokerPhaseCopy({
    phase: view.phase,
    waitingCopy: view.waitingCopy,
    isActor: view.currentActorId === view.viewerId,
    actorName: view.currentActorName,
  });
  const setup = view.phase === "POKER_SETUP" || view.phase === "TABLE_SETUP";
  const primary = view.legalActions.find((a) => a.type === "CALL" || a.type === "CHECK" || a.type === "BET");
  const fold = view.legalActions.find((a) => a.type === "FOLD");
  const raise = view.legalActions.find((a) => a.type === "RAISE" || a.type === "BET");
  const [selectedChip, setSelectedChip] = useState<string | null>("25");
  const trayEnabled = Boolean(!setup && (raise || primary));

  return (
    <PremiumShell
      title={view.tableName}
      balance={view.available.label}
      board="POKER_PLAYER"
      dock={
        <CasinoConsole
          notice={notice ? <div className="pm-bj-empty">{notice}</div> : null}
          toCall={!setup && view.toCall.label !== "0" ? view.toCall.label : null}
          available={view.available.label}
          showTray={!setup}
          trayEnabled={trayEnabled}
          selectedChip={selectedChip}
          onChip={(value) => {
            setSelectedChip(value);
            if (raise) {
              void onCommand("pokerAct", { type: raise.type, amount: value });
            }
          }}
          primary={
            primary
              ? {
                  label: primary.label,
                  onClick: () => void onCommand("pokerAct", { type: primary.type, amount: primary.amount.label }),
                }
              : null
          }
          secondary={
            fold
              ? {
                  label: fold.label,
                  onClick: () => void onCommand("pokerAct", { type: "FOLD", amount: "0" }),
                }
              : null
          }
        />
      }
    >
      <PokerTable
        tableName={view.tableName}
        phaseLabel={phaseCopy.primary}
        instruction={phaseCopy.instruction}
        phase={view.phase}
        pot={view.pot.label}
        seats={view.seats}
        viewerId={view.viewerId}
      />
    </PremiumShell>
  );
}
