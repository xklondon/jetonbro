import { expect, test } from "vitest";
import { addChipToAmount } from "./poker-chip-action";

test("chip taps add to a staged amount and do not imply a committed action", () => {
  expect(addChipToAmount("", "5")).toBe("5");
  expect(addChipToAmount("20", "5")).toBe("25");
  expect(addChipToAmount("25", "10")).toBe("35");
});

test("invalid chips leave the staged amount unchanged", () => {
  expect(addChipToAmount("20", "x")).toBe("20");
  expect(addChipToAmount("20", "0")).toBe("20");
});
