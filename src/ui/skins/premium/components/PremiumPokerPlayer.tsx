"use client";

import { useEffect, useState } from "react";
import {
  pokerActPayload,
  pokerAggressionLabel,
  pokerDockTrio,
  pokerTrayChipAct,
  pokerTrayEnabled,
  visiblePokerLegalActions,
} from "@/application/queries/poker-controls";
import type { PokerTableView } from "@/application/queries/views";
import { pokerPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumOutcomeFx } from "./PremiumOutcomeFx";
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
  const handDone = view.phase === "HAND_COMPLETE";
  const showdown = view.phase === "SHOWDOWN";
  /** Keep tray slot through showdown/hand-complete so dock height stays stable. */
  const liveStreet = !setup && !handDone && !showdown;
  const legal = visiblePokerLegalActions(view);
  const trio = pokerDockTrio(legal);
  const [selectedChip, setSelectedChip] = useState<string | null>("25");
  const showTray = !setup;
  const trayEnabled = Boolean(liveStreet && pokerTrayEnabled(view));
  const waitingHint = liveStreet && phaseCopy.instruction ? phaseCopy.instruction : null;
  const [fxSeed, setFxSeed] = useState("");
  const [fxTone, setFxTone] = useState<"win" | "loss">("win");
  const [fxActive, setFxActive] = useState(false);

  useEffect(() => {
    if (view.phase !== "HAND_COMPLETE") {
      setFxActive(false);
      return;
    }
    const won = view.winners?.some((w) => w.userId === view.viewerId);
    setFxTone(won ? "win" : "loss");
    setFxSeed(`${view.handNumber}-${view.viewerId}-${won ? "w" : "l"}`);
    setFxActive(true);
  }, [view.phase, view.handNumber, view.viewerId, view.winners]);

  return (
    <PremiumShell
      title="JETONBRO"
      board="POKER_PLAYER"
      dock={
        <CasinoConsole
          variant={setup ? "setup" : "default"}
          notice={
            notice || waitingHint ? (
              <div className="pm-console-notice" data-poker-turn-hint="true">
                {notice ?? waitingHint}
              </div>
            ) : null
          }
          toCall={liveStreet && view.toCall.label !== "0" ? view.toCall.label : null}
          available={!setup ? view.available.label : undefined}
          showTray={showTray}
          reserveTray={!setup}
          trayEnabled={trayEnabled}
          selectedChip={selectedChip}
          onChip={(value) => {
            setSelectedChip(value);
            const act = pokerTrayChipAct(view, value);
            if (!act) return;
            void onCommand("pokerAct", { type: act.type, amount: act.amount });
          }}
          primary={
            trio.respond
              ? {
                  label: trio.respond.label,
                  onClick: () => void onCommand("pokerAct", pokerActPayload(trio.respond!)),
                }
              : null
          }
          secondary={
            trio.fold
              ? {
                  label: trio.fold.label,
                  onClick: () => void onCommand("pokerAct", { type: "FOLD", amount: "0" }),
                }
              : null
          }
          tertiary={
            trio.aggression
              ? {
                  label: pokerAggressionLabel(trio.aggression),
                  onClick: () => void onCommand("pokerAct", pokerActPayload(trio.aggression!)),
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
      <PremiumOutcomeFx active={fxActive} tone={fxTone} seed={fxSeed} />
    </PremiumShell>
  );
}
