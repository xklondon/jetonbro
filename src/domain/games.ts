export const ENABLED_GAMES = ["BLACKJACK", "POKER"] as const;
export const FUTURE_GAMES = ["ZILCH"] as const;

export type EnabledGame = (typeof ENABLED_GAMES)[number];
export type FutureGame = (typeof FUTURE_GAMES)[number];
export type GameId = EnabledGame | FutureGame;

export const GAME_CATALOG = [
  {
    id: "BLACKJACK" as const,
    label: "Blackjack",
    tagline: "Boxes, Insurance, Bank on the felt.",
    available: true,
    comingLater: null,
  },
  {
    id: "POKER" as const,
    label: "Texas Hold’em",
    tagline: "Pots and positions.",
    available: true,
    comingLater: null,
  },
  {
    id: "ZILCH" as const,
    label: "Zilch",
    tagline: "Dice stay at the table.",
    available: false,
    comingLater: "Coming later",
  },
] as const;

export function isPlayableGame(game: string): game is EnabledGame {
  return (ENABLED_GAMES as readonly string[]).includes(game);
}
