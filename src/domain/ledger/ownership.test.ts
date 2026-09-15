import { expect, test } from "vitest";
import { BANK_VIRTUAL_RESERVE, VALUE_OWNERSHIP } from "./ownership";

test("every required operation names both sides of the value move", () => {
  const operations = VALUE_OWNERSHIP.map((move) => move.operation);
  expect(operations).toEqual(
    expect.arrayContaining([
      "Bank distributes jetons",
      "Player places bet",
      "Player retracts bet",
      "Player doubles",
      "Player splits",
      "Player takes Insurance",
      "Player loses",
      "Player wins",
      "Player pushes",
      "Player gets Blackjack",
      "Insurance wins",
      "Insurance loses",
      "Carry into another round",
      "Carry into another table",
    ]),
  );
  for (const move of VALUE_OWNERSHIP) {
    expect(move.from).toBeTruthy();
    expect(move.to).toBeTruthy();
  }
});

test("the Bank issues winnings and absorbs losses from an unlimited virtual reserve", () => {
  expect(VALUE_OWNERSHIP.find((move) => move.operation === "Bank distributes jetons")?.from).toBe(
    BANK_VIRTUAL_RESERVE,
  );
  expect(VALUE_OWNERSHIP.find((move) => move.operation === "Player loses")?.to).toBe(BANK_VIRTUAL_RESERVE);
  expect(VALUE_OWNERSHIP.find((move) => move.operation === "Player wins")?.from).toBe(BANK_VIRTUAL_RESERVE);
  expect(VALUE_OWNERSHIP.find((move) => move.operation === "Player takes Insurance")?.to).toBe("LOCKED_INSURANCE");
});
