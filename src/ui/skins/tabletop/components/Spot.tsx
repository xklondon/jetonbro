"use client";

import { useEffect, useState } from "react";
import { chipsFromMillis } from "./chips";

/** Small pile of jetons derived from a stake (display only). */
export function ChipPile({ millis, max = 5 }: { millis: string; max?: number }) {
  const chips = chipsFromMillis(millis);
  const shown = chips.slice(0, max);
  return (
    <span className={`tt-pile${shown.length === 0 ? " is-empty" : ""}`} aria-hidden="true">
      {shown.length === 0 ? (
        <span className="tt-chip tt-c0">0</span>
      ) : (
        shown.map((chip, index) => (
          <span key={`${chip.label}-${index}`} className={`tt-chip tt-${chip.className}`}>
            {chip.label}
          </span>
        ))
      )}
    </span>
  );
}

/** Compact countdown pill driven by a server deadline. */
export function Countdown({ deadline, label }: { deadline: string | null; label: string }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) {
      setSeconds(null);
      return;
    }
    function tick() {
      const remaining = Math.ceil((Date.parse(deadline!) - Date.now()) / 1000);
      setSeconds(remaining > 0 ? remaining : null);
    }
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [deadline]);
  if (!seconds) return null;
  return (
    <div className="tt-countdown" aria-live="polite">
      {label} {seconds}
    </div>
  );
}

/** Compact phase pill printed near the top of the felt. */
export function PhasePill({ display, label, instruction }: { display?: string; label: string; instruction?: string }) {
  return (
    <div className="tt-phase">
      {display ? <span className="tt-phase-display">{display}</span> : null}
      <strong data-phase-heading>{label}</strong>
      {instruction ? <em>{instruction}</em> : null}
    </div>
  );
}

export function DealerMark({ name }: { name?: string }) {
  return (
    <div className="tt-dealer-mark" data-dealer-row="true">
      <span aria-hidden="true">♠</span> DEALER{name ? <small> · {name}</small> : null}
    </div>
  );
}

export function ClothName({ name }: { name: string }) {
  return (
    <div className="tt-cloth-name" data-table-name={name}>
      {name}
    </div>
  );
}
