"use client";

import { useState } from "react";
import {
  pokerActorLayout,
  pokerTrayChipAct,
  pokerTrayEnabled,
  visiblePokerLegalActions,
} from "@/application/queries/poker-controls";
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
  const isActor = view.currentActorId === view.viewerId;
  const phaseCopy = pokerPhaseCopy({
    phase: view.phase,
    waitingCopy: view.waitingCopy,
    isActor,
    actorName: view.currentActorName,
  });
  const setup = view.phase === "POKER_SETUP" || view.phase === "TABLE_SETUP";
  const compactDock = setup || view.phase === "HAND_COMPLETE" || view.phase === "SHOWDOWN";
  const legal = visiblePokerLegalActions(view);
  const layout = pokerActorLayout(legal);
  const fold = legal.find((a) => a.type === "FOLD");
  const [selectedChip, setSelectedChip] = useState<string | null>("25");
  /** Live betting streets keep tray populated; chips only enable when BET/RAISE is legal. */
  const showTray = !compactDock;
  const trayEnabled = Boolean(showTray && pokerTrayEnabled(view));
  const waitingHint =
    !compactDock && phaseCopy.instruction ? phaseCopy.instruction : null;

  return (
    <PremiumShell
      title="JETONBRO"
      board="POKER_PLAYER"
      dock={
        <CasinoConsole
          variant={compactDock ? "setup" : "default"}
          notice={
            notice || waitingHint ? (
              <div className="pm-console-notice" data-poker-turn-hint="true">
                {notice ?? waitingHint}
              </div>
            ) : null
          }
          toCall={!compactDock && view.toCall.label !== "0" ? view.toCall.label : null}
          available={!compactDock ? view.available.label : undefined}
          showTray={showTray}
          reserveTray={false}
          trayEnabled={trayEnabled}
          selectedChip={selectedChip}
          onChip={(value) => {
            setSelectedChip(value);
            const act = pokerTrayChipAct(view, value);
            if (!act) return;
            void onCommand("pokerAct", { type: act.type, amount: act.amount });
          }}
          primary={
            layout.primary
              ? {
                  label: layout.primary.label,
                  onClick: () =>
                    void onCommand("pokerAct", {
                      type: layout.primary!.type,
                      amount: layout.primary!.amount.label,
                    }),
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
        instruction={setup ? phaseCopy.instruction : undefined}
        phase={view.phase}
        pot={view.pot.label}
        potMillis={view.pot.millis}
        pots={view.pots}
        seats={view.seats}
        viewerId={view.viewerId}
      />
    </PremiumShell>
  );
}
