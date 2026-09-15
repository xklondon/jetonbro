import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ClassicHome } from "@/ui/skins/classic/components/ClassicHome";
import { ClassicCreateTable } from "@/ui/skins/classic/components/ClassicCreateTable";
import { ClassicGameCards } from "@/ui/skins/classic/components/ClassicGameCards";
import { WelcomeParticles } from "@/ui/skins/classic/components/WelcomeCelebration";
import {
  WELCOME_CELEBRATION_KEY,
  beginWelcomeCelebration,
  markWelcomeCelebrationPlayed,
  shouldPlayWelcomeCelebration,
} from "@/ui/core/welcome-celebration";

test("empty authenticated home shows create, join and game cards", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicHome, {
      displayName: "Alex",
      tables: [],
      onCreateTable: () => undefined,
      onJoinTable: () => undefined,
      onOpenTable: () => undefined,
    }),
  );
  expect(html).toContain("Welcome to the table, Alex");
  expect(html).toContain("Pick a game, bring your friends, run the Bank.");
  expect(html).toContain("CREATE A TABLE");
  expect(html).toContain("JOIN A TABLE");
  expect(html).toContain("Blackjack");
  expect(html).toContain("Poker");
  expect(html).toContain("Zilch");
  expect(html).toContain("Coming later");
});

test("Blackjack is selectable while Poker and Zilch are not", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicGameCards, {
      selectedId: "BLACKJACK",
      onSelectBlackjack: () => undefined,
    }),
  );
  expect(html).toContain("Blackjack");
  expect(html).toContain("Coming later");
  expect((html.match(/aria-disabled="true"/g) ?? []).length).toBe(2);
  expect(html).toContain('aria-pressed="true"');
});

test("existing tables remain on the compact home", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicHome, {
      displayName: "Alex",
      tables: [
        {
          id: "t1",
          name: "Salon table",
          game: "Blackjack",
          phase: "TABLE_SETUP",
          playerCount: 2,
          role: "Bank / Dealer",
        },
      ],
      onCreateTable: () => undefined,
      onJoinTable: () => undefined,
      onOpenTable: () => undefined,
    }),
  );
  expect(html).toContain("CREATE NEW TABLE");
  expect(html).toContain("Salon table");
  expect(html).toContain("RETURN TO TABLE");
  expect(html).toContain("Bank / Dealer");
  expect(html).toContain("TABLE SETUP");
});

test("blackjack setup uses domain defaults and create action", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicCreateTable, {
      defaultTableName: "Alex's table",
      initialGame: "BLACKJACK",
      onBack: () => undefined,
      onCreate: async () => undefined,
    }),
  );
  expect(html).toMatch(/Alex(&#x27;|')s table/);
  expect(html).toContain("Starting jetons per player");
  expect(html).toContain("3:2");
  expect(html).toContain("6:5");
  expect(html).toContain("Maximum boxes per player");
  expect(html).toContain("Insurance enabled");
  expect(html).toContain("CREATE TABLE");
});

test("welcome celebration is decorative and session-limited", () => {
  const html = renderToStaticMarkup(createElement(WelcomeParticles));
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("welcome-particle");
  expect(html).not.toContain("pointer-events: auto");

  const storage = new Map<string, string>();
  const mem = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };
  expect(shouldPlayWelcomeCelebration(mem, false)).toBe(true);
  expect(shouldPlayWelcomeCelebration(mem, true)).toBe(false);
  markWelcomeCelebrationPlayed(mem);
  expect(storage.get(WELCOME_CELEBRATION_KEY)).toBe("1");
  expect(shouldPlayWelcomeCelebration(mem, false)).toBe(false);
  const memory: Record<string, unknown> = {};
  const fresh = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };
  expect(beginWelcomeCelebration(fresh, false, memory)).toBe(false);
});

describe("reduced motion", () => {
  test("does not schedule particle movement", () => {
    expect(shouldPlayWelcomeCelebration({ getItem: () => null }, true)).toBe(false);
    const memory: Record<string, unknown> = {};
    expect(
      beginWelcomeCelebration(
        {
          getItem: () => null,
          setItem: () => undefined,
        },
        true,
        memory,
      ),
    ).toBe(false);
  });
});
