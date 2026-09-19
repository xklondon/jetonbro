"use client";

import { useState } from "react";
import { POKER_RANKS, POKER_SUITS, SUIT_GLYPH, type PokerCard } from "@/domain/poker/cards";
import type { PokerCardView } from "@/application/queries/views";
import { PlayingCard } from "./PlayingCard";

function toCards(cards: PokerCardView[]): PokerCard[] {
  return cards.map((card) => ({ rank: card.rank as PokerCard["rank"], suit: card.suit as PokerCard["suit"] }));
}

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
    <div className="sheet open" data-card-sheet={title}>
      <div className="sheet-panel">
        <h3>{title}</h3>
        <div className="poker-card-draft" data-selected-cards="true">
          {draft.length === 0 ? <p className="muted">No cards selected</p> : null}
          {draft.map((card, index) => (
            <PlayingCard key={`${card.rank}${card.suit}-${index}`} rank={card.rank} suit={card.suit} size="hole" />
          ))}
        </div>
        <div className="rank-tray" role="group" aria-label={`${title} rank`}>
          {POKER_RANKS.map((item) => (
            <button key={item} type="button" className={rank === item ? "active" : ""} onClick={() => setRank(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="suit-tray" role="group" aria-label={`${title} suit`}>
          {POKER_SUITS.map((item) => (
            <button key={item} type="button" className={suit === item ? "active" : ""} onClick={() => setSuit(item)}>
              {SUIT_GLYPH[item]}
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <button
            type="button"
            className="gold-button"
            disabled={draft.length >= max}
            onClick={() => setDraft([...draft, { rank, suit }])}
          >
            ADD
          </button>
          <button type="button" disabled={draft.length === 0} onClick={() => setDraft([])}>
            CLEAR
          </button>
        </div>
        <div className="sheet-actions">
          <button
            type="button"
            className="gold-button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            SAVE
          </button>
          <button type="button" className="text-link" onClick={onClose}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

export function PokerCardPicker(props: {
  label: string;
  cards: PokerCardView[];
  max: number;
  onSave: (cards: PokerCard[]) => void;
  onClose: () => void;
}) {
  return <PokerCardSheet title={props.label} cards={props.cards} max={props.max} onSave={props.onSave} onClose={props.onClose} />;
}
