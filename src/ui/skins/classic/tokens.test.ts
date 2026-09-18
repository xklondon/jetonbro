import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

test("classic tokens define one emerald, felt, cream, gold and black dock", () => {
  const tokens = readFileSync(join(process.cwd(), "src/ui/skins/classic/tokens.css"), "utf8");
  expect(tokens).toContain("--emerald:");
  expect(tokens).toContain("--felt:");
  expect(tokens).toContain("--cream:");
  expect(tokens).toContain("--gold:");
  expect(tokens).toContain("--dock: #05080a");
  expect(tokens).toContain("--rail:");
  expect(tokens).toContain("--outcome-won:");
  expect(tokens).toContain("--font-display:");
  expect(tokens).toContain("color: var(--cream)");
  const layouts = readFileSync(join(process.cwd(), "src/ui/skins/classic/layouts.css"), "utf8");
  expect(layouts).toContain("background: var(--dock)");
  expect(layouts).toContain("min-height: var(--control-height)");
  expect(layouts).toContain("border-radius: var(--radius)");
  expect(layouts).not.toContain("#10241f");
});
