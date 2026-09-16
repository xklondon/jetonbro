"use client";

import { GAME_CATALOG, type GameId } from "@/domain/games";

const SUITS: Record<string, string> = {
  BLACKJACK: "♠",
  POKER: "♥",
  ZILCH: "⚀",
};

export function ClassicGameCards({
  selectedId,
  onSelect,
  compact,
}: {
  selectedId: string | null;
  onSelect: (gameId: GameId) => void;
  compact?: boolean;
}) {
  return (
    <div className={`game-pick${compact ? " compact" : ""}`}>
      {GAME_CATALOG.map((game) => {
        const available = game.available;
        return (
          <button
            key={game.id}
            type="button"
            className={`game-card${selectedId === game.id ? " is-selected" : ""}${available ? "" : " is-disabled"}`}
            disabled={!available}
            aria-disabled={!available}
            aria-pressed={available ? selectedId === game.id : undefined}
            onClick={() => {
              if (available) onSelect(game.id);
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
