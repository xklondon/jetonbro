import { expect, test } from "vitest";
import { formatJetons, parseJetonInput } from "./money";

test("jeton formatting round-trips fractional values without floats", () => {
  expect(parseJetonInput("62.5")).toBe(62500n);
  expect(formatJetons(62500n)).toBe("62.5");
  expect(formatJetons(25000n)).toBe("25");
});
