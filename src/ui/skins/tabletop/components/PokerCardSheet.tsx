"use client";

import { useState } from "react";
import { POKER_RANKS, POKER_SUITS, SUIT_GLYPH, type PokerCard } from "@/domain/poker/cards";
import type { PokerCardView } from "@/application/queries/views";
import { Sheet } from "./Sheet";

function toCards(cards: PokerCardView[]): PokerCard[] {
  return cards.map((card) => ({ rank: card.rank as PokerCard["rank"], suit: card.suit as PokerCard["suit"] }));
}

/** Optional Card Assist picker — kept off the felt until opened from the menu. */
export function PokerCardSheet({
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
    <Sheet open onClose={onClose} className="tt-card-sheet" labelledBy="tt-card-sheet-title">
      <header className="tt-sheet-head">
        <h3 id="tt-card-sheet-title">{title}</h3>
        <button className="tt-link" type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="tt-card-draft" data-selected-cards="true" data-card-sheet={title}>
        {draft.length === 0 ? <p className="tt-muted">No cards selected</p> : null}
        {draft.map((card, index) => (
          <span key={`${card.rank}${card.suit}-${index}`} className="tt-playing-card">
            {card.rank}
            {SUIT_GLYPH[card.suit]}
          </span>
        ))}
      </div>
      <div className="tt-segment" role="group" aria-label={`${title} rank`}>
        {POKER_RANKS.map((item) => (
          <button key={item} type="button" className={rank === item ? "active" : ""} onClick={() => setRank(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="tt-segment" role="group" aria-label={`${title} suit`}>
        {POKER_SUITS.map((item) => (
          <button key={item} type="button" className={suit === item ? "active" : ""} onClick={() => setSuit(item)}>
            {SUIT_GLYPH[item]}
          </button>
        ))}
      </div>
      <div className="tt-sheet-actions">
        <button className="tt-btn gold" type="button" disabled={draft.length >= max} onClick={() => setDraft([...draft, { rank, suit }])}>
          ADD
        </button>
        <button className="tt-btn" type="button" disabled={draft.length === 0} onClick={() => setDraft([])}>
          CLEAR
        </button>
      </div>
      <div className="tt-sheet-actions">
        <button
          className="tt-btn gold"
          type="button"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          SAVE
        </button>
        <button className="tt-link" type="button" onClick={onClose}>
          CANCEL
        </button>
      </div>
    </Sheet>
  );
}
