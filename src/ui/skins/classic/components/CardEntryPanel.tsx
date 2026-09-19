"use client";

import { useState } from "react";
import { CARD_RANKS } from "@/domain/blackjack/cards";
import type { HandView } from "@/application/queries/views";

export function CardEntryPanel({
  title,
  hand,
  completeLabel,
  canClear,
  showCards = true,
  compact = false,
  onAdd,
  onRemove,
  onComplete,
  onReopen,
  onClear,
}: {
  title?: string;
  hand?: HandView;
  completeLabel: string;
  canClear?: boolean;
  showCards?: boolean;
  compact?: boolean;
  onAdd: (rank: string) => void;
  onRemove: (index: number) => void;
  onComplete: () => void;
  onReopen: () => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ranks = hand?.ranks ?? [];
  const canEdit = Boolean(hand?.canEdit);

  if (!canEdit && ranks.length === 0 && !hand?.label) {
    return null;
  }

  const showTray = open && canEdit && !hand?.complete;

  return (
    <div className={`card-assist${compact ? " is-compact" : ""}`}>
      {title ? <div className="card-assist-title">{title}</div> : null}
      {compact && !open ? (
        <div className="card-assist-actions">
          {canEdit && ranks.length === 0 ? (
            <button type="button" className="add-cards is-compact" onClick={() => setOpen(true)}>
              + CARDS
            </button>
          ) : null}
          {canEdit && ranks.length > 0 && !hand?.complete ? (
            <>
              <button type="button" className="add-cards is-compact" onClick={() => setOpen(true)}>
                + CARDS
              </button>
              <button type="button" className="primary" onClick={onComplete}>
                {completeLabel}
              </button>
            </>
          ) : null}
          {canEdit && hand?.complete ? (
            <button type="button" onClick={onReopen}>
              REOPEN
            </button>
          ) : null}
        </div>
      ) : !open && ranks.length === 0 ? (
        <button type="button" className={`add-cards${compact ? " is-compact" : ""}`} onClick={() => setOpen(true)} disabled={!canEdit}>
          + CARDS
        </button>
      ) : (
        <>
          {showCards ? (
          <div className="entered-cards">
            {ranks.map((rank, index) => (
              <button
                key={`${rank}-${index}`}
                type="button"
                className="tactile-card"
                disabled={!canEdit || hand?.complete}
                onClick={() => canEdit && !hand?.complete && onRemove(index)}
                aria-label={`Remove ${rank}`}
              >
                {rank}
              </button>
            ))}
            {hand?.label ? <span className="hand-total">{hand.label}</span> : null}
          </div>
          ) : hand?.label ? (
            <span className="hand-total">{hand.label}</span>
          ) : null}
          {showTray ? (
            <div className="rank-tray" role="group" aria-label="Card ranks">
              {CARD_RANKS.map((rank) => (
                <button key={rank} type="button" onClick={() => onAdd(rank)}>
                  {rank}
                </button>
              ))}
            </div>
          ) : null}
          {canEdit ? (
            <div className="card-assist-actions">
              {hand?.complete ? (
                <button type="button" onClick={onReopen}>
                  REOPEN
                </button>
              ) : (
                <button type="button" className="primary" disabled={ranks.length === 0} onClick={onComplete}>
                  {completeLabel}
                </button>
              )}
              {canClear ? (
                <button type="button" onClick={onClear}>
                  CLEAR
                </button>
              ) : null}
              <button type="button" className="text-link" onClick={() => setOpen(false)}>
                Hide
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
