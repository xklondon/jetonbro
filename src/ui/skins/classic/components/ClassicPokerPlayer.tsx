"use client";

import { useState } from "react";
import type { PokerTableView } from "@/application/queries/views";
import { communityCardLimit } from "@/domain/poker/cards";
import { pokerTurnLabel } from "@/application/queries/poker-controls";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { OutcomeCelebrationOverlay } from "./OutcomeCelebration";
import { PokerFelt } from "./PokerFelt";
import { PokerGameControls } from "./PokerGameControls";
import { PokerStreetRail } from "./PokerStreetRail";
import { PokerCardSheet } from "./PokerCardPicker";
import { SheetOverlay } from "./SheetOverlay";

export function ClassicPokerPlayer({
  view,
  onCommand,
  notice,
}: {
  view: PokerTableView;
  onCommand: (command: string, payload?: Record<string, string>) => void;
  notice?: string | null;
}) {
  const [sheet, setSheet] = useState<"menu" | null>(null);
  const [cards, setCards] = useState<"hole" | "board" | null>(null);
  const selfWon = view.phase === "HAND_COMPLETE" && view.winners.some((winner) => winner.userId === view.viewerId);
  const turn =
    view.phase === "HAND_COMPLETE" || view.phase === "SHOWDOWN" || view.phase === "POKER_SETUP"
      ? null
      : pokerTurnLabel(view.waitingCopy);
  const ownHole = view.seats.find((seat) => seat.userId === view.viewerId)?.holeCards ?? [];

  return (
    <TableShell onMenu={() => setSheet("menu")}>
      <PhaseBar label={view.phaseLabel.replaceAll("_", " ")}>
        {turn ? (
          <div className={`poker-turn-banner${turn.you ? " is-you" : ""}`} data-turn-state={turn.you ? "you" : "other"}>
            {turn.label}
          </div>
        ) : null}
        <PokerStreetRail stops={view.streetRail} />
      </PhaseBar>
      <PokerFelt view={view} />
      <PokerGameControls view={view} onCommand={onCommand} notice={notice} />
      {selfWon ? <OutcomeCelebrationOverlay celebration={{ kind: "rain", copy: "WINNER!", overlay: true }} /> : null}
      {cards === "board" ? (
        <PokerCardSheet
          title="Board cards"
          cards={view.communityCards}
          max={communityCardLimit(view.phase)}
          onSave={(next) => onCommand("setPokerCommunityCards", { cards: JSON.stringify(next) })}
          onClose={() => setCards(null)}
        />
      ) : null}
      {cards === "hole" ? (
        <PokerCardSheet
          title="Hole cards"
          cards={ownHole}
          max={2}
          onSave={(next) => onCommand("setPokerHoleCards", { cards: JSON.stringify(next) })}
          onClose={() => setCards(null)}
        />
      ) : null}
      <SheetOverlay open={sheet === "menu"} onClose={() => setSheet(null)}>
        {sheet === "menu" ? (
            <>
              <h3>Table</h3>
              <div className="field-label">OPTIONAL TOOLS</div>
              {view.canEditHole ? (
                <button type="button" onClick={() => { setSheet(null); setCards("hole"); }}>
                  + HOLE CARDS
                </button>
              ) : null}
              {view.canEditCommunity ? (
                <button type="button" onClick={() => { setSheet(null); setCards("board"); }}>
                  + BOARD CARDS
                </button>
              ) : null}
              {!view.canEditHole && !view.canEditCommunity ? (
                <p className="muted">Card Assist stays off the felt. Open this menu during a live hand to enter optional ranks.</p>
              ) : null}
              <button className="text-link" type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </>
          ) : null}
      </SheetOverlay>
    </TableShell>
  );
}
