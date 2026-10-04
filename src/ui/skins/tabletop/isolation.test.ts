import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ACTIVE_SKIN_ID, SKINS, getSkin } from "../registry";
import { tabletopSkin } from "./index";

const ROOT = join(process.cwd(), "src/ui/skins/tabletop");
const REGISTRY = join(process.cwd(), "src/ui/skins/registry.ts");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(ROOT);
const sources = files.filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(".test."));
const CLASSIC_IMPORT =
  /from\s+["'][^"']*(?:skins\/classic|\.\.\/classic\/(?!skin)|\/classic\/)[^"']*["']|import\s+["'][^"']*classic[^"']*\.css["']/;

describe("tabletop skin isolation", () => {
  it("index.ts imports only its own stylesheet", () => {
    const index = readFileSync(join(ROOT, "index.ts"), "utf8");
    const cssImports = [...index.matchAll(/import\s+["']([^"']+\.css)["']/g)].map((match) => match[1]);
    expect(cssImports).toEqual(["./tabletop.css"]);
    expect(index).not.toMatch(CLASSIC_IMPORT);
  });

  it("registry does not import Classic stylesheets while tabletop is active", () => {
    const registry = readFileSync(REGISTRY, "utf8");
    expect(ACTIVE_SKIN_ID).toBe("tabletop");
    expect(registry).toContain('from "./classic/skin"');
    expect(registry).not.toMatch(/from\s+["']\.\/classic["']/);
    expect(registry).not.toMatch(/from\s+["']\.\/classic\/index["']/);
    expect(registry).not.toMatch(/^\s*import\s+["']\.\/classic\/styles["']/m);
    expect(registry).not.toMatch(/^\s*import\s+["'][^"']*\.css["']/m);
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
    expect(css).toContain("--tt-gold:");
    expect(css).toContain("--tt-display:");
    expect(css).not.toMatch(/\.classic-|classic-skin|skins\/classic/);
    expect(css).not.toMatch(/!important/);
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
    expect(getSkin().id).toBe("tabletop");
  });

  it("Shell root exposes the tabletop skin hooks", () => {
    const shell = readFileSync(join(ROOT, "components/Shell.tsx"), "utf8");
    expect(shell).toContain('data-skin="tabletop"');
    expect(shell).toContain('className="tabletop-skin"');
  });

  it("rendered boards mount one shell, one board, one rail and no classic classes", () => {
    const boards = [
      renderToStaticMarkup(
        createElement(tabletopSkin.PlayerTable, {
          view: {
            role: "PLAYER",
            phase: "BETTING",
            tableName: "K's Table",
            title: "Bet",
            copy: "",
            available: { millis: "100000", label: "100" },
            insuranceWindowOpen: false,
            isOwner: false,
            actions: { bet: true, retract: true, addBox: true, removeEmptyBox: false, double: false, split: false, insurance: false },
            boxes: [
              {
                id: "b1",
                playerId: "p1",
                playerName: "Alex",
                label: "YOUR BOX 1",
                boxNumber: 1,
                bet: { millis: "0", label: "0" },
                insurance: null,
                insuranceResult: null,
                outcome: null,
                returned: null,
                isDoubled: false,
                isSplit: false,
                insuranceMax: { millis: "0", label: "0" },
                coverage: { bet: true },
                payoutActions: [],
              },
            ],
            bankLimitReached: false,
            closePreview: null,
          } as never,
          selectedBoxId: "b1",
          onSelectBox: () => undefined,
          onCommand: async () => true,
          members: [],
        }),
      ),
      renderToStaticMarkup(
        createElement(tabletopSkin.BankTable, {
          view: {
            role: "BANK",
            phase: "BETTING",
            tableName: "K's Table",
            title: "Deal",
            copy: "",
            available: { millis: "0", label: "0" },
            isOwner: true,
            players: [],
            boxes: [],
            insurance: { window: "CLOSED" },
            actions: {
              dealCards: true,
              openInsurance: false,
              closeInsurance: false,
              enterPayout: false,
              startBetting: false,
              settleBoxes: false,
              changeBank: true,
              switchGame: true,
            },
            primaryAction: { id: "dealCards", label: "DEAL CARDS", enabled: true },
            guestJoinUrl: null,
            verifiedJoinUrl: null,
            emailConfigured: true,
            invitations: [],
            closePreview: null,
            bankroll: null,
            cardAssist: "OFF",
            countdownDeadline: null,
            countdownLabel: "",
          } as never,
          members: [],
          onCommand: async () => true,
        }),
      ),
    ];

    for (const html of boards) {
      expect(html).toContain('data-skin="tabletop"');
      expect(html.match(/tabletop-skin/g)?.length).toBe(1);
      expect(html.match(/data-table-board="/g)?.length).toBe(1);
      expect(html.match(/class="tt-rail"/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(html).not.toMatch(/classic-skin|classic-page|class="[^"]*classic-/);
      expect(html).not.toContain("classic-");
    }

    const player = boards[0]!;
    expect(player).toContain('data-player-wallet="true"');
    expect(player.match(/data-jeton-tray="true"/g)?.length).toBe(1);
    expect(player.match(/data-player-wallet="true"/g)?.length).toBe(1);
  });
});
