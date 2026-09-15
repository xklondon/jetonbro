import { expect, test } from "vitest";
import { GAME_CATALOG, ENABLED_GAMES, isPlayableGame } from "./games";

test("Blackjack is the only enabled game", () => {
  expect(ENABLED_GAMES).toEqual(["BLACKJACK"]);
  expect(isPlayableGame("BLACKJACK")).toBe(true);
  expect(isPlayableGame("POKER")).toBe(false);
  expect(isPlayableGame("ZILCH")).toBe(false);
});

test("Poker and Zilch are catalogued as coming later", () => {
  const poker = GAME_CATALOG.find((game) => game.id === "POKER");
  const zilch = GAME_CATALOG.find((game) => game.id === "ZILCH");
  const blackjack = GAME_CATALOG.find((game) => game.id === "BLACKJACK");
  expect(blackjack?.available).toBe(true);
  expect(poker?.available).toBe(false);
  expect(poker?.comingLater).toBe("Coming later");
  expect(zilch?.available).toBe(false);
  expect(zilch?.comingLater).toBe("Coming later");
});
