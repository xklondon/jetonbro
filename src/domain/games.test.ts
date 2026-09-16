import { expect, test } from "vitest";
import { GAME_CATALOG, ENABLED_GAMES, isPlayableGame } from "./games";

test("Blackjack and Texas Hold’em are enabled; Zilch is not", () => {
  expect(ENABLED_GAMES).toEqual(["BLACKJACK", "POKER"]);
  expect(isPlayableGame("BLACKJACK")).toBe(true);
  expect(isPlayableGame("POKER")).toBe(true);
  expect(isPlayableGame("ZILCH")).toBe(false);
});

test("Zilch stays catalogued as coming later", () => {
  const poker = GAME_CATALOG.find((game) => game.id === "POKER");
  const zilch = GAME_CATALOG.find((game) => game.id === "ZILCH");
  const blackjack = GAME_CATALOG.find((game) => game.id === "BLACKJACK");
  expect(blackjack?.available).toBe(true);
  expect(poker?.available).toBe(true);
  expect(zilch?.available).toBe(false);
  expect(zilch?.comingLater).toBe("Coming later");
});
