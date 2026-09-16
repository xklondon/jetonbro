import { expect, test } from "vitest";
import { pokerChipAction } from "./poker-chip-action";
import type { PokerLegalActionView } from "@/application/queries/views";

const money = (millis: string, label: string) => ({ millis, label });

const bet: PokerLegalActionView = { type: "BET", amount: money("100000", "100"), label: "BET" };
const call: PokerLegalActionView = { type: "CALL", amount: money("10000", "10"), label: "CALL 10" };
const raise: PokerLegalActionView = {
  type: "RAISE",
  amount: money("90000", "90"),
  raiseTo: money("20000", "20"),
  label: "RAISE TO",
};
const fold: PokerLegalActionView = { type: "FOLD", amount: money("0", "0"), label: "FOLD" };

test("tray tap bets the chip when BET is legal", () => {
  expect(pokerChipAction([fold, bet], "25", "0")).toEqual({ type: "BET", amount: "25" });
});

test("tray tap calls when the chip does not exceed the amount owed", () => {
  expect(pokerChipAction([fold, call, raise], "10", "0")).toEqual({ type: "CALL" });
  expect(pokerChipAction([fold, call, raise], "5", "5000")).toEqual({ type: "CALL" });
});

test("tray tap raises to street contribution plus the chip", () => {
  expect(pokerChipAction([fold, call, raise], "25", "0")).toEqual({ type: "RAISE", amount: "25" });
  expect(pokerChipAction([fold, call, raise], "25", "5000")).toEqual({ type: "RAISE", amount: "30" });
});

test("tray does nothing without a wager action", () => {
  expect(pokerChipAction([fold], "25", "0")).toBeNull();
});
