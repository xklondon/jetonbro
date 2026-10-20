"use client";

import { useEffect, useState } from "react";
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

/** Table Settings — owner-owned outcome FX (persisted on the table). */
export function PremiumCelebrationSettings({
  open,
  onClose,
  prefs: prefsProp,
  onCommand,
}: {
  open: boolean;
  onClose: () => void;
  prefs?: OutcomeFxPrefs | null;
  onCommand: (command: string, payload?: Record<string, string>) => void | boolean | Promise<void | boolean>;
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

  return (
    <div className="pm-sheet-mask" data-celebration-settings="true" role="dialog" aria-modal="true" aria-label="Result animations">
      <div className="pm-sheet">
        <h3>Result animations</h3>
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
