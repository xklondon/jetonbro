"use client";

import type { BankrollView } from "@/application/queries/views";

export function BankrollPanel({
  bankroll,
  manage,
  onToggle,
}: {
  bankroll?: BankrollView;
  manage?: boolean;
  onToggle?: (mode: "OPEN" | "LIMITED") => void;
}) {
  if (!bankroll) return null;
  const limited = bankroll.mode === "LIMITED";
  return (
    <div className="bankroll-panel compact-funding">
      <div className="funding-toggle-row">
        <span>OPEN BANK</span>
        <button
          type="button"
          role="switch"
          aria-checked={limited}
          className={`funding-switch${limited ? " on" : ""}`}
          disabled={!manage || !bankroll.canToggle}
          onClick={() => onToggle?.(limited ? "OPEN" : "LIMITED")}
        >
          <span className="funding-knob" />
        </button>
        <span>LIMITED BANK</span>
      </div>
      <div className="bankroll-line">
        {limited
          ? `${bankroll.available.label} available · ${bankroll.reserved.label} reserved`
          : "Unlimited"}
      </div>
      {manage && bankroll.lockedReason ? <p className="muted">{bankroll.lockedReason}</p> : null}
    </div>
  );
}
