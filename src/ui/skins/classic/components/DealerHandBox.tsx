"use client";

import { useState, type ReactNode } from "react";
import type { HandView } from "@/application/queries/views";
import { CardEntryPanel } from "./CardEntryPanel";
import { PlayingCard } from "./PlayingCard";

export function DealerHandBox({
  name,
  hand,
  status,
  showDealerWon,
  onDealerWon,
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
  onAdd: (rank: string) => void;
  onRemove: (index: number) => void;
  onComplete: () => void;
  onReopen: () => void;
  onClear: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const ranks = hand?.ranks ?? [];
  const cards: ReactNode =
    ranks.length > 0 ? (
      <div className="box-cards" data-dealer-cards="true" data-box-cards="true">
        {ranks.map((rank, index) => (
          <PlayingCard key={`${rank}-${index}`} rank={rank} size="box" />
        ))}
      </div>
    ) : null;

  return (
    <div className="payout-row blackjack-box-row dealer-hand-row is-idle" data-dealer-box="true" data-blackjack-box-row="true">
      <div className="payout-row-inner">
        <div>
          <span className="dealer-tag">DEALER</span>
          <strong>{name}</strong>
          <div className="muted">{status}</div>
        </div>
        {cards ?? <span className="chip-pile compact" aria-hidden="true" />}
        <div className="payout-state">
          {hand?.label ? <div className="muted">{hand.label}</div> : null}
        </div>
      </div>
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
      {showDealerWon ? (
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
      ) : null}
    </div>
  );
}
