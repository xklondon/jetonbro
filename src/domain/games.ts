export const ENABLED_GAMES = ["BLACKJACK"] as const;
export const FUTURE_GAMES = ["POKER", "ZILCH"] as const;

export type EnabledGame = (typeof ENABLED_GAMES)[number];
export type FutureGame = (typeof FUTURE_GAMES)[number];
export type GameId = EnabledGame | FutureGame;

export function isPlayableGame(game: string): game is EnabledGame {
  return (ENABLED_GAMES as readonly string[]).includes(game);
}
