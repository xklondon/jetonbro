"use client";

import { useEffect, useState } from "react";
import { ChipStack } from "./primitives/Jeton";
import { PhaseDisplay } from "./primitives/PhaseDisplay";
import { TableName } from "./primitives/TableName";

/** @deprecated Prefer ChipStack. */
export function ChipPile({ millis, max = 5 }: { millis: string; max?: number }) {
  return <ChipStack millis={millis} max={max} />;
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

/** @deprecated Prefer PhaseDisplay. */
export function PhasePill({ label, instruction }: { display?: string; label: string; instruction?: string }) {
  return <PhaseDisplay label={label} instruction={instruction} />;
}

export function DealerMark({ name }: { name?: string }) {
  return (
    <div className="tt-dealer-mark" data-dealer-row="true">
      <span aria-hidden="true">♠</span> DEALER{name ? <small> · {name}</small> : null}
    </div>
  );
}

/** @deprecated Prefer TableName. */
export function ClothName({ name }: { name: string }) {
  return <TableName name={name} />;
}
