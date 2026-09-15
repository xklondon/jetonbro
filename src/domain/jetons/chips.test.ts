import { expect, test } from "vitest";
import { chipCompositionFromMillis } from "./chips";
import { jeton } from "../money";

test("25 is one removable 25 jeton", () => {
  expect(chipCompositionFromMillis(jeton(25))).toEqual([{ millis: 25000n, label: "25", exact: false }]);
});

test("85 is 50 + 25 + 10", () => {
  expect(chipCompositionFromMillis(jeton(85)).map((chip) => chip.label)).toEqual(["50", "25", "10"]);
});

test("leftover that is not a standard denomination is one exact token", () => {
  const chips = chipCompositionFromMillis(jeton("7"));
  expect(chips).toEqual([
    { millis: 5000n, label: "5", exact: false },
    { millis: 2000n, label: "2", exact: true },
  ]);
});

test("zero stake has no chips", () => {
  expect(chipCompositionFromMillis(0n)).toEqual([]);
});
