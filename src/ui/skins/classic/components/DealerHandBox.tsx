"use client";

import { useState, type ReactNode } from "react";
import type { HandView } from "@/application/queries/views";

import { CardEntryPanel } from "./CardEntryPanel";

export function DealerHandBox({
  name,
  hand,
  status,
  showDealerWon,
  onDealerWon,
  cardAssist,
  onAdd,
  onRemove,
  onComplete,
  onReopen,
  onClear,
}: {
  name: string;
  hand?: HandView;
  status: string;
  showDealerWon?: boolean;
  onDealerWon?: () => void;
  cardAssist?: "OFF" | "CONFIRM" | "AUTO";
  onAdd?: (rank: string) => void;
  onRemove?: (index: number) => void;
  onComplete?: () => void;
  onReopen?: () => void;
  onClear?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const extra: ReactNode = showDealerWon ? (
    confirm ? (
      <div className="dealer-won-confirm">
        <p>Dealer wins against all unresolved boxes?</p>
        <div className="card-assist-actions">
          <button
            type="button"
            className="primary"
            onClick={() => {
              onDealerWon?.();
              setConfirm(false);
            }}
          >
            Confirm
          </button>
          <button type="button" className="text-link" onClick={() => setConfirm(false)}>
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <button type="button" className="add-cards is-compact" onClick={() => setConfirm(true)}>
        DEALER WON
      </button>
    )
  ) : null;

  return (
    <div className="payout-row blackjack-box-row dealer-hand-row is-idle" data-dealer-box="true" data-blackjack-box-row="true">
      <div className="payout-row-inner">
        <div>
          <span className="dealer-tag">DEALER</span>
          <strong>{name}</strong>
          <div className="muted">{status}</div>
        </div>
        <span className="chip-pile compact" aria-hidden="true" />
      </div>
      {cardAssist && cardAssist !== "OFF" && onAdd && onRemove && onComplete && onReopen && onClear ? (
        <CardEntryPanel
          hand={hand}
          completeLabel="DEALER COMPLETE"
          canClear
          compact
          showCards={false}
          onAdd={onAdd}
          onRemove={onRemove}
          onComplete={onComplete}
          onReopen={onReopen}
          onClear={onClear}
        />
      ) : null}
      {extra}
    </div>
  );
}
