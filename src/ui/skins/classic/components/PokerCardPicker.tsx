"use client";

import { useState } from "react";
import { POKER_RANKS, POKER_SUITS, SUIT_GLYPH, type PokerCard } from "@/domain/poker/cards";
import type { PokerCardView } from "@/application/queries/views";

export function PokerCardPicker({
  label,
  cards,
  max,
  onSave,
}: {
  label: string;
  cards: PokerCardView[];
  max: number;
  onSave: (cards: PokerCard[]) => void;
}) {
  const [rank, setRank] = useState<(typeof POKER_RANKS)[number]>("A");
  const [suit, setSuit] = useState<(typeof POKER_SUITS)[number]>("S");
  const selected = cards.map((card) => ({ rank: card.rank as PokerCard["rank"], suit: card.suit as PokerCard["suit"] }));

  return (
    <div className="poker-card-picker" data-card-picker={label}>
      <div className="picker-head">{label}</div>
      <div className="rank-tray" role="group" aria-label={`${label} rank`}>
        {POKER_RANKS.map((item) => (
          <button key={item} type="button" className={rank === item ? "active" : ""} onClick={() => setRank(item)}>
            {item}
          </button>
        ))}
      </div>
      <div className="suit-tray" role="group" aria-label={`${label} suit`}>
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
          disabled={selected.length >= max}
          onClick={() => onSave([...selected, { rank, suit }])}
        >
          ADD
        </button>
        <button type="button" disabled={selected.length === 0} onClick={() => onSave(selected.slice(0, -1))}>
          UNDO
        </button>
      </div>
    </div>
  );
}
