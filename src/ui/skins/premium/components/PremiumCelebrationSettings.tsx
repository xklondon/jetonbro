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

/** Table Settings — blinds, outcome FX + owner seat order (persisted on the table). */
export function PremiumCelebrationSettings({
  open,
  onClose,
  prefs: prefsProp,
  onCommand,
  seats = null,
  canReorderSeats = false,
  smallBlind = "5",
  bigBlind = "10",
  canEditBlinds = false,
}: {
  open: boolean;
  onClose: () => void;
  prefs?: OutcomeFxPrefs | null;
  onCommand: (command: string, payload?: Record<string, string>) => void | boolean | Promise<void | boolean>;
  seats?: PokerSeatView[] | null;
  canReorderSeats?: boolean;
  smallBlind?: string;
  bigBlind?: string;
  canEditBlinds?: boolean;
}) {
  const [prefs, setPrefs] = useState<OutcomeFxPrefs>(prefsProp ?? DEFAULT_OUTCOME_FX_PREFS);
  const [busy, setBusy] = useState(false);
  const [sb, setSb] = useState(smallBlind);
  const [bb, setBb] = useState(bigBlind);

  useEffect(() => {
    if (!open) return;
    setPrefs(prefsProp ?? DEFAULT_OUTCOME_FX_PREFS);
    setSb(smallBlind);
    setBb(bigBlind);
  }, [open, prefsProp, smallBlind, bigBlind]);

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

  async function saveBlinds() {
    setBusy(true);
    try {
      await onCommand("configurePoker", { smallBlind: sb, bigBlind: bb });
    } finally {
      setBusy(false);
    }
  }

  const showSeats = Boolean(canReorderSeats && seats && seats.length > 0);

  return (
    <div className="pm-sheet-mask" data-celebration-settings="true" role="dialog" aria-modal="true" aria-label="Table settings">
      <div className="pm-sheet">
        <h3>Table settings</h3>
        {canEditBlinds ? (
          <>
            <h4 className="pm-sheet-subhead">Blinds</h4>
            <p className="pm-muted">Change only between hands. Applies to the next deal.</p>
            <label className="pm-sheet-field">
              Small blind
              <input
                value={sb}
                onChange={(event) => setSb(event.target.value)}
                aria-label="Small blind"
                inputMode="decimal"
                data-blind-edit="sb"
                disabled={busy}
              />
            </label>
            <label className="pm-sheet-field">
              Big blind
              <input
                value={bb}
                onChange={(event) => setBb(event.target.value)}
                aria-label="Big blind"
                inputMode="decimal"
                data-blind-edit="bb"
                disabled={busy}
              />
            </label>
            <button
              type="button"
              className="pm-console-btn is-ghost"
              data-blind-save="true"
              disabled={busy}
              onClick={() => void saveBlinds()}
            >
              SAVE BLINDS
            </button>
          </>
        ) : null}
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
