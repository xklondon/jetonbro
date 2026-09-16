"use client";

import { useState } from "react";
import type { PokerTableView } from "@/application/queries/views";
import { pokerChipAction } from "@/ui/core/poker-chip-action";
import { JetonTray } from "./JetonTray";

export function PokerPlayerDock({
  view,
  onCommand,
  notice,
}: {
  view: PokerTableView;
  onCommand: (command: string, payload?: Record<string, string>) => void;
  notice?: string | null;
}) {
  const [raiseTo, setRaiseTo] = useState(view.legalActions.find((action) => action.raiseTo)?.raiseTo?.label ?? "");
  const raiseAction = view.legalActions.find((action) => action.type === "RAISE" || action.type === "BET");
  const self = view.seats.find((seat) => seat.userId === view.viewerId);
  const trayActionable = Boolean(pokerChipAction(view.legalActions, "5", self?.streetContribution.millis ?? "0"));

  function commitChip(amount: string) {
    const action = pokerChipAction(view.legalActions, amount, self?.streetContribution.millis ?? "0");
    if (!action) return;
    onCommand("pokerAct", action.amount ? { type: action.type, amount: action.amount } : { type: action.type });
  }

  return (
    <>
      {notice ? <div className="error">{notice}</div> : null}
      {view.waitingCopy ? (
        <div className="muted" data-turn-copy={view.waitingCopy === "YOUR TURN" ? "you" : "waiting"}>
          {view.waitingCopy}
        </div>
      ) : null}
      {view.legalActions.length > 0 ? (
        <div className="poker-actions">
          {raiseAction ? (
            <div className="raise-row">
              <input
                aria-label="Raise to"
                value={raiseTo}
                onChange={(event) => setRaiseTo(event.target.value)}
                placeholder={raiseAction.raiseTo?.label ?? "Amount"}
              />
            </div>
          ) : null}
          {view.legalActions.map((action) =>
            action.type === "BET" || action.type === "RAISE" ? (
              <button
                key={action.type}
                type="button"
                onClick={() =>
                  onCommand("pokerAct", {
                    type: action.type,
                    amount: raiseTo || action.raiseTo?.label || action.amount.label,
                  })
                }
              >
                {action.label}
              </button>
            ) : (
              <button key={action.type} type="button" onClick={() => onCommand("pokerAct", { type: action.type })}>
                {action.label}
              </button>
            ),
          )}
        </div>
      ) : null}
      <div className="dock-top">
        <div>
          <small>YOUR JETONS</small>
          <strong>{view.available.label}</strong>
        </div>
        <div style={{ textAlign: "right" }}>
          <small>IN POT</small>
          <strong>{view.contribution.label}</strong>
        </div>
      </div>
      <JetonTray
        enabled={trayActionable}
        dropSelector="[data-drop-pot]"
        onTap={commitChip}
        onDrop={(amount) => commitChip(amount)}
      />
    </>
  );
}
