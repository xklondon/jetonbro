"use client";

import type { PokerLegalActionView, PokerTableView } from "@/application/queries/views";
import {
  pokerActorLayout,
  pokerComposeBounds,
  pokerComposeSeed,
  type PokerActorLayout,
  type PokerComposeKind,
} from "@/application/queries/poker-controls";

function boardRow(layout: PokerActorLayout): PokerLegalActionView[] {
  const actions = [layout.primary, ...layout.secondary].filter((action): action is PokerLegalActionView => Boolean(action));
  const pick = (type: string) => actions.find((action) => action.type === type);
  const row = layout.owed
    ? [pick("FOLD"), pick("CALL"), pick("RAISE"), pick("ALL_IN")]
    : [pick("FOLD"), pick("CHECK"), pick("BET") ?? pick("RAISE"), pick("ALL_IN")];
  return row.filter((action): action is PokerLegalActionView => Boolean(action));
}

/** Actor action row + optional BET/RAISE composer above the tray. */
export function PokerActionDock({
  view,
  layout,
  compose,
  staged,
  busy,
  onAction,
  onOpenCompose,
  onStageChange,
  onConfirm,
  onClear,
  onCancel,
}: {
  view: PokerTableView;
  layout: PokerActorLayout;
  compose: PokerComposeKind | null;
  staged: string;
  busy: boolean;
  onAction: (type: string) => void;
  onOpenCompose: (kind: PokerComposeKind) => void;
  onStageChange: (value: string) => void;
  onConfirm: () => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const actions = boardRow(layout);
  if (actions.length === 0) return null;
  const bounds = compose ? pokerComposeBounds(view, compose) : null;

  return (
    <div className="tt-actor" data-actor-controls="true" data-compose={compose ?? "closed"}>
      {actions.map((action) => (
        <button
          key={action.type}
          type="button"
          className={`tt-btn${action.type === "CALL" || action.type === "CHECK" ? " gold" : ""}`}
          disabled={busy}
          aria-pressed={compose === action.type}
          onClick={() => {
            if (action.type === "BET" || action.type === "RAISE") {
              if (compose === action.type) {
                onCancel();
                return;
              }
              onOpenCompose(action.type);
              return;
            }
            onAction(action.type);
          }}
        >
          {action.label}
        </button>
      ))}
      {compose && bounds ? (
        <div className="tt-compose" data-raise-composer="true">
          <small data-raise-convention={bounds.convention}>
            {bounds.convention} · min {bounds.min}
          </small>
          <input
            className="tt-input"
            aria-label={compose === "RAISE" ? "Raise to" : "Bet amount"}
            inputMode="numeric"
            value={staged}
            placeholder={pokerComposeSeed(view, compose)}
            onChange={(event) => onStageChange(event.target.value.replace(/[^\d]/g, ""))}
          />
          <button type="button" className="tt-btn gold" disabled={busy} onClick={onConfirm}>
            {compose === "RAISE" ? "CONFIRM RAISE" : "CONFIRM BET"}
          </button>
          <button type="button" className="tt-btn" onClick={onClear}>
            CLEAR
          </button>
          <button type="button" className="tt-btn" onClick={onCancel}>
            CANCEL
          </button>
        </div>
      ) : null}
    </div>
  );
}

