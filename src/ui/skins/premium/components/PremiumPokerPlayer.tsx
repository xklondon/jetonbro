"use client";

import { useEffect, useState } from "react";
import {
  pokerActPayload,
  pokerAggressionLabel,
  pokerDockTrio,
  pokerTrayChipAct,
  pokerTrayEnabled,
  pokerTrayMinAmount,
  visiblePokerLegalActions,
} from "@/application/queries/poker-controls";
import type { PokerTableView } from "@/application/queries/views";
import { pokerPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { communityCardLimit } from "@/domain/poker/cards";
import { PremiumOutcomeFx } from "./PremiumOutcomeFx";
import { PremiumPokerCardSheet, PremiumPokerCardToolsMenu } from "./PremiumPokerCardSheet";
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
  const liveStreet = !setup && !handDone && !showdown;
  const legal = visiblePokerLegalActions(view);
  const trio = pokerDockTrio(legal);
  const [selectedChip, setSelectedChip] = useState<string | null>("25");
  const [cardToolsOpen, setCardToolsOpen] = useState(false);
  const [cards, setCards] = useState<"hole" | "board" | null>(null);
  /** Fixed tray through every Poker phase — same size/position. */
  const showTray = true;
  const trayEnabled = Boolean(liveStreet && pokerTrayEnabled(view));
  const minChip = trayEnabled ? pokerTrayMinAmount(view) : null;
  const chipAct = selectedChip && trayEnabled ? pokerTrayChipAct(view, selectedChip) : null;
  const waitingHint = liveStreet && phaseCopy.instruction ? phaseCopy.instruction : null;
  const ownHole = view.seats.find((seat) => seat.userId === view.viewerId)?.holeCards ?? [];
  const showCardTools = Boolean(view.canEditHole || view.canEditCommunity);
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

  useEffect(() => {
    if (!minChip || !selectedChip) return;
    if (Number(selectedChip) < minChip) {
      const next = ["5", "10", "25", "50", "100"].find((value) => Number(value) >= minChip) ?? null;
      if (next) setSelectedChip(next);
    }
  }, [minChip, selectedChip]);

  return (
    <PremiumShell
      title="JETONBRO"
      board="POKER_PLAYER"
      onMenu={showCardTools ? () => setCardToolsOpen(true) : undefined}
      dock={
        <CasinoConsole
          variant="default"
          notice={
            notice || waitingHint ? (
              <div className="pm-console-notice" data-poker-turn-hint="true">
                {notice ?? waitingHint}
              </div>
            ) : null
          }
          toCall={liveStreet && view.toCall.label !== "0" ? view.toCall.label : null}
          available={view.available.label}
          showTray={showTray}
          reserveTray
          trayEnabled={trayEnabled}
          selectedChip={selectedChip}
          minChipAmount={minChip}
          onChip={(value) => setSelectedChip(value)}
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
                  label: chipAct
                    ? `${chipAct.type} ${chipAct.amount}`
                    : pokerAggressionLabel(trio.aggression),
                  disabled: !chipAct,
                  title: chipAct ? undefined : "Select a legal chip amount",
                  onClick: () => {
                    if (!chipAct) return;
                    void onCommand("pokerAct", { type: chipAct.type, amount: chipAct.amount });
                  },
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
        communityCards={view.communityCards}
        seats={view.seats}
        viewerId={view.viewerId}
      />
      <PremiumOutcomeFx active={fxActive} tone={fxTone} seed={fxSeed} prefs={view.outcomeFx} />
      {cardToolsOpen ? (
        <PremiumPokerCardToolsMenu
          canEditHole={view.canEditHole}
          canEditCommunity={view.canEditCommunity}
          onHole={() => {
            setCardToolsOpen(false);
            setCards("hole");
          }}
          onBoard={() => {
            setCardToolsOpen(false);
            setCards("board");
          }}
          onClose={() => setCardToolsOpen(false)}
        />
      ) : null}
      {cards === "board" ? (
        <PremiumPokerCardSheet
          title="Board cards"
          cards={view.communityCards}
          max={communityCardLimit(view.phase)}
          onSave={(next) => void onCommand("setPokerCommunityCards", { cards: JSON.stringify(next) })}
          onClose={() => setCards(null)}
        />
      ) : null}
      {cards === "hole" ? (
        <PremiumPokerCardSheet
          title="Hole cards"
          cards={ownHole}
          max={2}
          onSave={(next) => void onCommand("setPokerHoleCards", { cards: JSON.stringify(next) })}
          onClose={() => setCards(null)}
        />
      ) : null}
    </PremiumShell>
  );
}
