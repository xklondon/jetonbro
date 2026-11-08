"use client";

import { useState } from "react";
import { CARD_RANKS } from "@/domain/blackjack/cards";

/** Rank-only Card Assist picker for Blackjack boxes / dealer hand. */
export function PremiumBlackjackCardSheet({
  title,
  ranks,
  enabled,
  onAdd,
  onRemoveLast,
  onClose,
}: {
  title: string;
  ranks: string[];
  enabled: boolean;
  onAdd: (rank: string) => void;
  onRemoveLast?: () => void;
  onClose: () => void;
}) {
  const [rank, setRank] = useState<(typeof CARD_RANKS)[number]>("A");

  return (
    <div className="pm-sheet-mask" data-bj-card-sheet={title} role="dialog" aria-modal="true" aria-labelledby="pm-bj-card-title">
      <div className="pm-sheet pm-card-sheet">
        <header className="pm-card-sheet-head">
          <h3 id="pm-bj-card-title">{title}</h3>
          <button type="button" className="pm-sheet-cancel" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="pm-card-draft" data-selected-cards="true">
          {ranks.length === 0 ? <p className="pm-sheet-hint">No cards</p> : null}
          {ranks.map((item, index) => (
            <span key={`${item}-${index}`} className="pm-playing-card" data-bj-card={item}>
              {item}
            </span>
          ))}
        </div>
        <div className="pm-card-segment" role="group" aria-label={`${title} rank`}>
          {CARD_RANKS.map((item) => (
            <button key={item} type="button" className={rank === item ? "is-active" : ""} onClick={() => setRank(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="pm-sheet-actions">
          <button
            type="button"
            className="pm-console-btn is-primary"
            disabled={!enabled}
            data-bj-add-rank="true"
            onClick={() => onAdd(rank)}
          >
            ADD
          </button>
          <button
            type="button"
            className="pm-console-btn is-ghost"
            disabled={!enabled || ranks.length === 0}
            onClick={() => onRemoveLast?.()}
          >
            UNDO
          </button>
        </div>
        <button type="button" className="pm-sheet-cancel" onClick={onClose}>
          DONE
        </button>
      </div>
    </div>
  );
}
