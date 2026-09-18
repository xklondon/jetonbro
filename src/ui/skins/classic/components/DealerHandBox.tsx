"use client";

import { useState } from "react";
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

  return (
    <div className="box dealer-hand-box is-compact" data-dealer-box="true">
      <span className="dealer-tag">DEALER</span>
      <span className="box-name">{name}</span>
      {ranks.length ? (
        <span className="box-cards" data-dealer-cards="true" data-box-cards="true">
          {ranks.map((rank, index) => (
            <PlayingCard key={`${rank}-${index}`} rank={rank} size="box" />
          ))}
        </span>
      ) : null}
      {hand?.label ? <span className="hand-total">{hand.label}</span> : null}
      <span className="hint">{status}</span>
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
