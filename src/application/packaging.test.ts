import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

function dockerignorePatterns() {
  return readFileSync(".dockerignore", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function isIgnored(relPath: string, patterns: string[]) {
  return patterns.some((pattern) => {
    if (pattern.startsWith("*.") && (relPath.endsWith(pattern.slice(1)) || relPath.split("/").pop()?.endsWith(pattern.slice(1)))) {
      return true;
    }
    return relPath === pattern || relPath.startsWith(`${pattern}/`);
  });
}

test("Railway image keeps files required by prebuild guardrails", () => {
  const patterns = dockerignorePatterns();
  expect(isIgnored(".cursorfile", patterns)).toBe(false);
  expect(isIgnored("CHANGELOG.md", patterns)).toBe(false);
  expect(isIgnored("docs/architecture/CURSOR_GUARDRAILS.md", patterns)).toBe(false);
  expect(isIgnored("design/reference/classic/jetonbro-player-bank-insurance.html", patterns)).toBe(false);
  expect(isIgnored("e2e/release-lifecycle.spec.ts", patterns)).toBe(true);
  expect(isIgnored("docs/screenshots/classic/app-release-home-saved-390x844.png", patterns)).toBe(true);
});
