"use client";

import type { PokerTableView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";
import { OutcomeCelebrationOverlay } from "./OutcomeCelebration";
import { PokerFelt } from "./PokerFelt";
import { PokerGameControls } from "./PokerGameControls";
import { PokerStreetRail } from "./PokerStreetRail";

export function ClassicPokerPlayer({
  view,
  onCommand,
  notice,
}: {
  view: PokerTableView;
  onCommand: (command: string, payload?: Record<string, string>) => void;
  notice?: string | null;
}) {
  const selfWon = view.phase === "HAND_COMPLETE" && view.winners.some((winner) => winner.userId === view.viewerId);

  return (
    <PhoneShell>
      <div className="phase-head">
        <span>
          Texas Hold’em · <strong data-phase-heading>{view.phaseLabel}</strong>
        </span>
        {view.waitingCopy ? (
          <div
            className={`poker-turn-banner${view.waitingCopy === "YOUR TURN" ? " is-you" : ""}`}
            data-turn-state={view.waitingCopy === "YOUR TURN" ? "you" : "waiting"}
          >
            {view.waitingCopy}
          </div>
        ) : null}
        <PokerStreetRail stops={view.streetRail} />
      </div>
      <PokerFelt view={view} onCommand={onCommand} />
      <PokerGameControls view={view} onCommand={onCommand} notice={notice} />
      {selfWon ? (
        <OutcomeCelebrationOverlay celebration={{ kind: "rain", copy: "WINNER!", overlay: true }} />
      ) : null}
    </PhoneShell>
  );
}
