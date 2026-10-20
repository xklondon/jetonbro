"use client";

import { useEffect, useState } from "react";
import {
  CELEBRATION_PREFS_KEY,
  DEFAULT_CELEBRATION_PREFS,
  loadCelebrationPrefs,
  saveCelebrationPrefs,
  type CelebrationFrequency,
  type CelebrationPrefs,
} from "@/ui/core/celebration-prefs";

const FREQ: { id: CelebrationFrequency; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "occasional", label: "Occasional" },
  { id: "often", label: "Often" },
  { id: "always", label: "Always" },
];

/** Table FX prefs — localStorage only. */
export function PremiumCelebrationSettings({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<CelebrationPrefs>(DEFAULT_CELEBRATION_PREFS);

  useEffect(() => {
    if (!open) return;
    setPrefs(loadCelebrationPrefs(typeof localStorage !== "undefined" ? localStorage : null));
  }, [open]);

  if (!open) return null;

  function commit(next: CelebrationPrefs) {
    setPrefs(next);
    saveCelebrationPrefs(typeof localStorage !== "undefined" ? localStorage : null, next);
  }

  return (
    <div className="pm-sheet-mask" data-celebration-settings="true" role="dialog" aria-modal="true" aria-label="Result animations">
      <div className="pm-sheet">
        <h3>Result animations</h3>
        <p className="pm-muted" data-celebration-storage={CELEBRATION_PREFS_KEY}>
          Funny win/loss bursts on this device. Honours reduced-motion.
        </p>
        <label className="pm-check">
          <input
            type="checkbox"
            checked={prefs.enabled}
            onChange={(event) => commit({ ...prefs, enabled: event.target.checked })}
          />
          Animations on
        </label>
        <fieldset className="pm-fieldset">
          <legend>Frequency</legend>
          {FREQ.map((item) => (
            <label key={item.id} className="pm-radio">
              <input
                type="radio"
                name="fx-freq"
                checked={prefs.frequency === item.id}
                onChange={() => commit({ ...prefs, frequency: item.id })}
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
