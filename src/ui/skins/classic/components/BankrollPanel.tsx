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
  if (bankroll.mode === "OPEN") {
    return (
      <div className="bankroll-panel">
        <div className="bankroll-line">OPEN BANK · Unlimited</div>
        {manage && onToggle ? (
          <button type="button" disabled={!bankroll.canToggle} onClick={() => onToggle("LIMITED")}>
            LIMITED BANK
          </button>
        ) : null}
        {manage && bankroll.lockedReason ? <p className="muted">{bankroll.lockedReason}</p> : null}
      </div>
    );
  }
  return (
    <div className="bankroll-panel">
      <div className="bankroll-line">LIMITED BANK</div>
      <div className="bankroll-stats">
        <span>Available {bankroll.available.label}</span>
        <span>Reserved {bankroll.reserved.label}</span>
        <span>Total {bankroll.total.label}</span>
      </div>
      {manage && onToggle ? (
        <button type="button" disabled={!bankroll.canToggle} onClick={() => onToggle("OPEN")}>
          OPEN BANK
        </button>
      ) : null}
      {manage && bankroll.lockedReason ? <p className="muted">{bankroll.lockedReason}</p> : null}
    </div>
  );
}
