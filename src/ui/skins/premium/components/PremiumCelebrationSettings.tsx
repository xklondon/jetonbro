"use client";

import { useEffect, useState } from "react";
import type { PokerSeatView } from "@/application/queries/views";
import {
  DEFAULT_OUTCOME_FX_PREFS,
  type OutcomeFxFrequency,
  type OutcomeFxPrefs,
} from "@/domain/tables/outcome-fx";

const FREQ: { id: OutcomeFxFrequency; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "occasional", label: "Occasional" },
  { id: "often", label: "Often" },
  { id: "always", label: "Always" },
];

function moveSeatOrder(ids: string[], index: number, delta: -1 | 1): string {
  const next = [...ids];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next.join(",");
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next.join(",");
}

/** Table Settings — outcome FX + owner seat order (persisted on the table). */
export function PremiumCelebrationSettings({
  open,
  onClose,
  prefs: prefsProp,
  onCommand,
  seats = null,
  canReorderSeats = false,
}: {
  open: boolean;
  onClose: () => void;
  prefs?: OutcomeFxPrefs | null;
  onCommand: (command: string, payload?: Record<string, string>) => void | boolean | Promise<void | boolean>;
  seats?: PokerSeatView[] | null;
  canReorderSeats?: boolean;
}) {
  const [prefs, setPrefs] = useState<OutcomeFxPrefs>(prefsProp ?? DEFAULT_OUTCOME_FX_PREFS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrefs(prefsProp ?? DEFAULT_OUTCOME_FX_PREFS);
  }, [open, prefsProp]);

  if (!open) return null;

  async function commit(next: OutcomeFxPrefs) {
    setPrefs(next);
    setBusy(true);
    try {
      await onCommand("setOutcomeFx", {
        enabled: next.enabled ? "true" : "false",
        frequency: next.frequency,
      });
    } finally {
      setBusy(false);
    }
  }

  async function reorder(seatOrder: string) {
    setBusy(true);
    try {
      await onCommand("configurePoker", { seatOrder });
    } finally {
      setBusy(false);
    }
  }

  const showSeats = Boolean(canReorderSeats && seats && seats.length > 0);

  return (
    <div className="pm-sheet-mask" data-celebration-settings="true" role="dialog" aria-modal="true" aria-label="Table settings">
      <div className="pm-sheet">
        <h3>Table settings</h3>
        {showSeats ? (
          <>
            <h4 className="pm-sheet-subhead">Player order</h4>
            <p className="pm-muted">
              Dealer button, blinds and action follow this order. Change only between hands.
            </p>
            <ol className="pm-seat-order" aria-label="Seat order" data-seat-order="true">
              {seats!.map((seat, index) => {
                const ids = seats!.map((entry) => entry.userId);
                return (
                  <li key={seat.userId}>
                    <span>
                      {index + 1}. {seat.name}
                    </span>
                    <span className="pm-seat-order-controls">
                      <button
                        type="button"
                        aria-label={`Move ${seat.name} up`}
                        data-seat-move="up"
                        disabled={busy || index === 0}
                        onClick={() => void reorder(moveSeatOrder(ids, index, -1))}
                      >
                        MOVE UP
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${seat.name} down`}
                        data-seat-move="down"
                        disabled={busy || index === seats!.length - 1}
                        onClick={() => void reorder(moveSeatOrder(ids, index, 1))}
                      >
                        MOVE DOWN
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}
        <h4 className="pm-sheet-subhead">Result animations</h4>
        <p className="pm-muted" data-celebration-storage="table">
          Funny win/loss bursts for this table. Honours reduced-motion.
        </p>
        <label className="pm-check">
          <input
            type="checkbox"
            checked={prefs.enabled}
            disabled={busy}
            onChange={(event) => void commit({ ...prefs, enabled: event.target.checked })}
          />
          Animations on
        </label>
        <fieldset className="pm-fieldset" disabled={busy}>
          <legend>Frequency</legend>
          {FREQ.map((item) => (
            <label key={item.id} className="pm-radio">
              <input
                type="radio"
                name="fx-freq"
                checked={prefs.frequency === item.id}
                onChange={() => void commit({ ...prefs, frequency: item.id })}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
        <button type="button" className="pm-console-btn is-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
