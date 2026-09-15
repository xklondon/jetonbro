"use client";

import { GAME_CATALOG } from "@/domain/games";

const SUITS: Record<string, string> = {
  BLACKJACK: "♠",
  POKER: "♥",
  ZILCH: "⚀",
};

export function ClassicGameCards({
  selectedId,
  onSelectBlackjack,
  compact,
}: {
  selectedId: string | null;
  onSelectBlackjack: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`game-pick${compact ? " compact" : ""}`}>
      {GAME_CATALOG.map((game) => {
        const available = game.available && game.id === "BLACKJACK";
        return (
          <button
            key={game.id}
            type="button"
            className={`game-card${selectedId === game.id ? " is-selected" : ""}${available ? "" : " is-disabled"}`}
            disabled={!available}
            aria-disabled={!available}
            aria-pressed={available ? selectedId === game.id : undefined}
            onClick={() => {
              if (available) onSelectBlackjack();
            }}
          >
            <span className="game-card-suit" aria-hidden="true">
              {SUITS[game.id]}
            </span>
            <strong>{game.label}</strong>
            {game.comingLater ? <em>Coming later</em> : <small>{game.tagline}</small>}
          </button>
        );
      })}
    </div>
  );
}
