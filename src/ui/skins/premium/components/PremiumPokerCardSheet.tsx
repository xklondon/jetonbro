"use client";

import { useState } from "react";
import { POKER_RANKS, POKER_SUITS, SUIT_GLYPH, type PokerCard } from "@/domain/poker/cards";
import type { PokerCardView } from "@/application/queries/views";

function toCards(cards: PokerCardView[]): PokerCard[] {
  return cards.map((card) => ({ rank: card.rank as PokerCard["rank"], suit: card.suit as PokerCard["suit"] }));
}

/** Optional Card Assist picker — same workflow as tabletop PokerCardSheet. */
export function PremiumPokerCardSheet({
  title,
  cards,
  max,
  onSave,
  onClose,
}: {
  title: string;
  cards: PokerCardView[];
  max: number;
  onSave: (cards: PokerCard[]) => void;
  onClose: () => void;
}) {
  const [rank, setRank] = useState<(typeof POKER_RANKS)[number]>("A");
  const [suit, setSuit] = useState<(typeof POKER_SUITS)[number]>("S");
  const [draft, setDraft] = useState<PokerCard[]>(() => toCards(cards));

  return (
    <div className="pm-sheet-mask" data-poker-card-sheet={title} role="dialog" aria-modal="true" aria-labelledby="pm-card-sheet-title">
      <div className="pm-sheet pm-card-sheet">
        <header className="pm-card-sheet-head">
          <h3 id="pm-card-sheet-title">{title}</h3>
          <button type="button" className="pm-sheet-cancel" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="pm-card-draft" data-selected-cards="true">
          {draft.length === 0 ? <p className="pm-sheet-hint">No cards selected</p> : null}
          {draft.map((card, index) => (
            <span key={`${card.rank}${card.suit}-${index}`} className="pm-playing-card" data-poker-card={`${card.rank}${card.suit}`}>
              {card.rank}
              {SUIT_GLYPH[card.suit]}
            </span>
          ))}
        </div>
        <div className="pm-card-segment" role="group" aria-label={`${title} rank`}>
          {POKER_RANKS.map((item) => (
            <button key={item} type="button" className={rank === item ? "is-active" : ""} onClick={() => setRank(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="pm-card-segment" role="group" aria-label={`${title} suit`}>
          {POKER_SUITS.map((item) => (
            <button key={item} type="button" className={suit === item ? "is-active" : ""} onClick={() => setSuit(item)}>
              {SUIT_GLYPH[item]}
            </button>
          ))}
        </div>
        <div className="pm-sheet-actions">
          <button
            type="button"
            className="pm-console-btn is-primary"
            disabled={draft.length >= max}
            onClick={() => setDraft([...draft, { rank, suit }])}
          >
            ADD
          </button>
          <button type="button" className="pm-console-btn is-ghost" disabled={draft.length === 0} onClick={() => setDraft([])}>
            CLEAR
          </button>
        </div>
        <div className="pm-sheet-actions">
          <button
            type="button"
            className="pm-console-btn is-primary"
            data-card-save="true"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            SAVE
          </button>
          <button type="button" className="pm-sheet-cancel" onClick={onClose}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tools sheet: hole (own seat) and board (owner) entry — privacy unchanged. */
export function PremiumPokerCardToolsMenu({
  canEditHole,
  canEditCommunity,
  onHole,
  onBoard,
  onClose,
}: {
  canEditHole: boolean;
  canEditCommunity: boolean;
  onHole: () => void;
  onBoard: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pm-sheet-mask" data-poker-card-tools="true" role="dialog" aria-modal="true" aria-label="Card tools">
      <div className="pm-sheet">
        <h3>Optional tools</h3>
        <p className="pm-sheet-hint">Display-only card records. No scoring.</p>
        <div className="pm-sheet-actions is-stack">
          {canEditHole ? (
            <button type="button" className="pm-console-btn is-primary" data-edit-hole="true" onClick={onHole}>
              + HOLE CARDS
            </button>
          ) : null}
          {canEditCommunity ? (
            <button type="button" className="pm-console-btn is-primary" data-edit-board="true" onClick={onBoard}>
              + BOARD CARDS
            </button>
          ) : null}
        </div>
        <button type="button" className="pm-sheet-cancel" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
