"use client";

import { useEffect, useState } from "react";
import {
  pokerActorLayout,
  pokerComposeBounds,
  pokerComposeSeed,
  pokerControls,
  pokerTrayEnabled,
  visiblePokerLegalActions,
  type PokerComposeKind,
} from "@/application/queries/poker-controls";
import type { PokerTableView } from "@/application/queries/views";
import { addChipToAmount } from "@/ui/core/poker-chip-action";
import { PlayerWallet } from "./PlayerWallet";

export function PokerGameControls({
  view,
  onCommand,
  notice,
  onOwnerSheet,
}: {
  view: PokerTableView;
  onCommand: (command: string, payload?: Record<string, string>) => void;
  notice?: string | null;
  onOwnerSheet?: (sheet: "menu" | "seats" | "player" | "jetons" | "game" | "winners") => void;
}) {
  const layout = pokerActorLayout(visiblePokerLegalActions(view));
  const ownerControls = pokerControls(view).filter((control) => control.layer === "owner" && control.surface === "dock");
  const showControls = Boolean(
    notice || ownerControls.length > 0 || layout.primary || layout.secondary.length > 0,
  );
  const [compose, setCompose] = useState<PokerComposeKind | null>(null);
  const [staged, setStaged] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCompose(null);
    setStaged("");
    setBusy(false);
  }, [view.turnNumber, view.currentActorId]);

  function send(type: string, payload: Record<string, string> = {}) {
    if (busy) return;
    setBusy(true);
    onCommand("pokerAct", { type, ...payload });
  }

  function openCompose(kind: PokerComposeKind) {
    setCompose(kind);
    setStaged(pokerComposeSeed(view, kind));
  }

  function stageChip(amount: string) {
    const kind = compose ?? (view.legalActions.some((action) => action.type === "BET") ? "BET" : "RAISE");
    if (!view.legalActions.some((action) => action.type === kind)) return;
    setCompose(kind);
    setStaged((current) => addChipToAmount(compose ? current : "0", amount));
  }

  function confirmCompose() {
    if (!compose || busy || !/^\d+$/.test(staged.trim())) return;
    const bounds = pokerComposeBounds(view, compose);
    const requested = BigInt(staged.trim()) * 1000n;
    if (requested < bounds.minMillis && requested < bounds.maxMillis) return;
    const amount = requested > bounds.maxMillis ? bounds.max : staged.trim();
    send(compose, { amount });
  }

  return (
    <footer className="dock player-dock">
      {showControls ? (
        <div className="game-controls" data-game-controls="true">
          {notice ? <div className="error">{notice}</div> : null}
          {ownerControls.length > 0 ? (
            <div className="owner-controls" data-owner-controls="true">
              {ownerControls.map((control) => {
                if (control.id === "assignWinners") {
                  return (
                    <button key={control.id} type="button" className="gold-button" onClick={() => onOwnerSheet?.("winners")}>
                      {control.label}
                    </button>
                  );
                }
                if (control.id === "dealStreet") {
                  return (
                    <div key={control.id} className="owner-street">
                      <button
                        type="button"
                        className={control.enabled ? "gold-button" : undefined}
                        disabled={!control.enabled}
                        onClick={() => onCommand("advancePokerStreet")}
                      >
                        {control.label}
                      </button>
                      {control.hint ? <small>{control.hint}</small> : null}
                    </div>
                  );
                }
                if (control.id === "startHand") {
                  return (
                    <button
                      key={control.id}
                      type="button"
                      className="gold-button"
                      disabled={!control.enabled}
                      onClick={() => onCommand("startTexasHoldem")}
                    >
                      {control.label}
                    </button>
                  );
                }
                if (control.id === "nextHand") {
                  return (
                    <button key={control.id} type="button" className="gold-button" onClick={() => onCommand("startNextPokerHand")}>
                      {control.label}
                    </button>
                  );
                }
                if (control.id === "scheduleNextHand") {
                  return (
                    <button key={control.id} type="button" onClick={() => onCommand("scheduleNextPokerHand")}>
                      {control.label}
                    </button>
                  );
                }
                return null;
              })}
            </div>
          ) : null}
          {layout.primary || layout.secondary.length > 0 ? (
            <div className="actor-actions" data-actor-controls="true" data-compose={compose ?? "closed"}>
              {layout.primary ? (
                <button
                  type="button"
                  className="actor-primary gold-button"
                  disabled={busy}
                  onClick={() => send(layout.primary!.type)}
                >
                  {layout.primary.label}
                </button>
              ) : null}
              <div className="actor-secondary">
                {layout.secondary.map((action) => (
                  <button
                    key={action.type}
                    type="button"
                    disabled={busy}
                    aria-pressed={compose === action.type}
                    onClick={() => {
                      if (action.type === "BET" || action.type === "RAISE") {
                        if (compose === action.type) {
                          setCompose(null);
                          setStaged("");
                          return;
                        }
                        openCompose(action.type);
                        return;
                      }
                      send(action.type);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              {compose ? (
                <div className="actor-compose" data-raise-composer="true">
                  <small data-raise-convention={pokerComposeBounds(view, compose).convention}>
                    {pokerComposeBounds(view, compose).convention} · min {pokerComposeBounds(view, compose).min}
                  </small>
                  <input
                    aria-label={compose === "RAISE" ? "Raise to" : "Bet amount"}
                    inputMode="numeric"
                    value={staged}
                    onChange={(event) => setStaged(event.target.value.replace(/[^\d]/g, ""))}
                    placeholder={pokerComposeSeed(view, compose)}
                  />
                  <button type="button" className="gold-button" disabled={busy} onClick={confirmCompose}>
                    {compose === "RAISE" ? "CONFIRM RAISE" : "CONFIRM BET"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStaged("");
                    }}
                  >
                    CLEAR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCompose(null);
                      setStaged("");
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <PlayerWallet
        available={view.available}
        trayEnabled={pokerTrayEnabled(view)}
        dropSelector="[data-drop-pot]"
        onTap={stageChip}
        onDrop={(amount) => stageChip(amount)}
      />
    </footer>
  );
}
