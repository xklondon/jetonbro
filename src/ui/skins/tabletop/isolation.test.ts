import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVE_SKIN_ID, SKINS } from "../registry";

const ROOT = join(process.cwd(), "src/ui/skins/tabletop");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(ROOT);
const sources = files.filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts"));
const CLASSIC_IMPORT = /from\s+["'][^"']*(?:skins\/classic|\.\.\/classic|\/classic\/)[^"']*["']|import\s+["'][^"']*classic[^"']*["']/;

describe("tabletop skin isolation", () => {
  it("index.ts imports only its own stylesheet", () => {
    const index = readFileSync(join(ROOT, "index.ts"), "utf8");
    const cssImports = [...index.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
    expect(cssImports).toEqual(["./tabletop.css"]);
    expect(index).not.toMatch(CLASSIC_IMPORT);
  });

  it("no tabletop source imports Classic components, helpers or CSS", () => {
    expect(sources.length).toBeGreaterThan(10);
    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      expect(source, relative(process.cwd(), file)).not.toMatch(CLASSIC_IMPORT);
    }
    const tsx = sources.filter((file) => file.endsWith(".tsx"));
    for (const file of tsx) {
      expect(readFileSync(file, "utf8"), relative(process.cwd(), file)).not.toMatch(/import\s+["'][^"']+\.css["']/);
    }
  });

  it("tabletop.css is scoped under .tabletop-skin and does not style Classic selectors", () => {
    const css = readFileSync(join(ROOT, "tabletop.css"), "utf8");
    expect(css).toContain(".tabletop-skin");
    expect(css).toContain('[data-skin="tabletop"]');
    expect(css).not.toMatch(/\.classic-|classic-skin|skins\/classic/);
    const rules = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("}")
      .map((block) => block.split("{")[0]!.trim())
      .filter((selector) => selector && !selector.startsWith("@") && !/^\d+%|^from$|^to$/.test(selector));
    for (const selectorList of rules) {
      for (const selector of selectorList.split(",").map((part) => part.trim())) {
        if (!selector) continue;
        expect(selector, selector).toMatch(/^(\.tabletop-skin|\[data-skin="tabletop"\])/);
      }
    }
  });

  it("registry registers both skins and activates tabletop", () => {
    expect(ACTIVE_SKIN_ID).toBe("tabletop");
    expect(Object.keys(SKINS).sort()).toEqual(["classic", "tabletop"]);
    expect(SKINS.tabletop.id).toBe("tabletop");
    expect(SKINS.classic.id).toBe("classic");
  });

  it("Shell root exposes the tabletop skin hooks", () => {
    const shell = readFileSync(join(ROOT, "components/Shell.tsx"), "utf8");
    expect(shell).toContain('data-skin="tabletop"');
    expect(shell).toContain('className="tabletop-skin"');
  });
});
