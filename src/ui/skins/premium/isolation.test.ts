import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVE_SKIN_ID, SKINS } from "../registry";

const ROOT = join(process.cwd(), "src/ui/skins/premium");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(ROOT);
const sources = files.filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts"));
const FOREIGN_SKIN =
  /from\s+["'][^"']*(?:skins\/(?:classic|tabletop)|\.\.\/(?:classic|tabletop)|\/(?:classic|tabletop)\/)[^"']*["']|import\s+["'][^"']*(?:classic|tabletop)[^"']*\.css["']/;

describe("premium skin isolation", () => {
  it("index.ts imports only its own stylesheet", () => {
    const index = readFileSync(join(ROOT, "index.ts"), "utf8");
    const cssImports = [...index.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
    expect(cssImports).toEqual(["./premium.css"]);
    expect(index).not.toMatch(FOREIGN_SKIN);
  });

  it("no premium source imports Classic or Tabletop components/CSS", () => {
    expect(sources.length).toBeGreaterThan(8);
    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(process.cwd(), file)).not.toMatch(FOREIGN_SKIN);
    }
    const tsx = sources.filter((file) => file.endsWith(".tsx") && !file.endsWith("PremiumShell.tsx"));
    for (const file of tsx) {
      expect(readFileSync(file, "utf8"), relative(process.cwd(), file)).not.toMatch(/import\s+["'][^"']+\.css["']/);
    }
    expect(readFileSync(join(ROOT, "components/PremiumShell.tsx"), "utf8")).toMatch(/import\s+["']\.\.\/premium\.css["']/);
  });

  it("premium.css is scoped under [data-skin=premium] only", () => {
    const css = readFileSync(join(ROOT, "premium.css"), "utf8");
    expect(css).toContain('[data-skin="premium"]');
    expect(css).not.toMatch(/\.tabletop-skin|tabletop\.css|\.classic-|classic-skin|skins\/(?:classic|tabletop)/);
    const rules = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .map((block) => block.split("{")[0]!.trim())
      .filter((selector) => selector && !selector.startsWith("@") && !/^\d+%|^from$|^to$/.test(selector));
    for (const selectorList of rules) {
      for (const selector of selectorList.split(",").map((part) => part.trim())) {
        if (!selector) continue;
        expect(selector, selector).toMatch(/^\[data-skin="premium"\]/);
      }
    }
  });

  it("Premium is registered and active; Classic/Tabletop remain rollback", () => {
    expect(ACTIVE_SKIN_ID).toBe("premium");
    expect(Object.keys(SKINS).sort()).toEqual(["classic", "premium", "tabletop"]);
    const registry = readFileSync(join(process.cwd(), "src/ui/skins/registry.ts"), "utf8");
    expect(registry).toMatch(/from\s+["']\.\/premium["']/);
    expect(registry).toContain('ACTIVE_SKIN_ID = "premium"');
    expect(registry).not.toMatch(/^\s*import\s+["']\.\/classic\/styles["']/m);
  });

  it("PremiumShell root exposes the premium skin hook", () => {
    const shell = readFileSync(join(ROOT, "components/PremiumShell.tsx"), "utf8");
    expect(shell).toContain('data-skin="premium"');
  });

  it("locks Premium screen geometry with CSS variables", () => {
    const css = readFileSync(join(ROOT, "premium.css"), "utf8");
    expect(css).toContain("--premium-header-height");
    expect(css).toContain("--premium-table-height");
    expect(css).toContain("--premium-console-height");
    expect(css).toContain("--premium-safe-area");
  });

  it("Blackjack setup does not mount betting-box stage", () => {
    const table = readFileSync(join(ROOT, "components/primitives/BlackjackTable.tsx"), "utf8");
    expect(table).toMatch(/data-table-zone=\{setup \? "setup" : "payout"\}/);
    expect(table).toContain('data-table-zone="boxes"');
    expect(table).toContain("blackjack-player-betting-authority.png");
    const player = readFileSync(join(ROOT, "components/PremiumBlackjackPlayer.tsx"), "utf8");
    expect(player).toContain('variant="blackjack"');
    expect(player).not.toMatch(/BlackjackBox\s+empty/);
    const waiting = readFileSync(join(ROOT, "components/PremiumBlackjackWaiting.tsx"), "utf8");
    expect(waiting).not.toMatch(/BlackjackBox/);
  });

  it("rejects obsolete Blackjack composition selectors", () => {
    const css = readFileSync(join(ROOT, "premium.css"), "utf8");
    expect(css).not.toContain(".pm-bj-table");
    expect(css).not.toContain(".pm-bj-overlay");
    expect(css).not.toContain(".pm-bj-dealer-ring");
    expect(css).not.toContain(".pm-console-walnut");
    expect(css).toContain(".pm-console.is-bj");
    expect(css).toContain(".pm-console-available");
    expect(css).toContain(".pm-jeton-lip");
    expect(css).toContain("grid-template-columns: 1fr 1.15fr");
    expect(css).not.toContain("!important");
  });
});


