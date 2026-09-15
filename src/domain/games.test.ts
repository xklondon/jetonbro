import { expect, test } from "vitest";
import { ENABLED_GAMES, isPlayableGame } from "./games";

test("Blackjack is the only enabled game", () => {
  expect(ENABLED_GAMES).toEqual(["BLACKJACK"]);
  expect(isPlayableGame("BLACKJACK")).toBe(true);
  expect(isPlayableGame("POKER")).toBe(false);
  expect(isPlayableGame("ZILCH")).toBe(false);
});
