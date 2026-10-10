"use client";

import type { BoxOutcome } from "@/domain/blackjack/payouts";
import type { BoxView } from "@/application/queries/views";

const ACTIONS: { outcome: BoxOutcome; label: string; className: string }[] = [
  { outcome: "LOST", label: "LOST", className: "is-lost" },
  { outcome: "PUSH", label: "TIE", className: "is-tie" },
  { outcome: "BLACKJACK", label: "BJ", className: "is-bj" },
  { outcome: "WON", label: "WIN", className: "is-win" },
];

export function BlackjackSettlementBar({
  box,
  enabled,
  onSettle,
}: {
  box: BoxView;
  enabled?: boolean;
  onSettle?: (outcome: BoxOutcome) => void;
}) {
  return (
    <div className="pm-bj-settle" data-payout-rail="row" data-box-id={box.id}>
      <div className="pm-bj-settle-head">
        <strong>
          {box.playerName} · BOX {box.boxNumber}
        </strong>
        <span>{box.bet.label}</span>
      </div>
      <div className="pm-bj-settle-actions">
        {ACTIONS.map((action) => (
          <button
            key={action.outcome}
            type="button"
            className={action.className}
            data-payout-action="true"
            disabled={!enabled || Boolean(box.outcome)}
            onClick={() => onSettle?.(action.outcome)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
