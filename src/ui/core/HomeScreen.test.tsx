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

const homeProps = {
  displayName: "Alex",
  defaultTableName: "Alex's table",
  onSetupTable: async () => undefined,
  onJoinTable: () => undefined,
  onOpenTable: () => undefined,
};

test("create table is one setup surface", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicHome, {
      ...homeProps,
      tables: [],
    }),
  );
  expect(html).toContain("CREATE A TABLE");
  expect((html.match(/SET UP TABLE/g) ?? []).length).toBe(1);
  expect(html).toContain("Player email");
  expect(html).toContain("Starting jetons per player");
  expect(html).toContain("Blackjack");
  expect(html).not.toContain("CREATE TABLE");
});

test("empty authenticated home shows create and join", () => {
  const html = renderToStaticMarkup(createElement(ClassicHome, { ...homeProps, tables: [] }));
  expect(html).toContain("Welcome to the table, Alex");
  expect(html).toContain("CREATE A TABLE");
  expect(html).toContain("JOIN A TABLE");
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
      ...homeProps,
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
    }),
  );
  expect(html).toContain("CREATE NEW TABLE");
  expect(html).toContain("Salon table");
  expect(html).toContain("RETURN TO TABLE");
});

test("single setup includes invites and hides advanced settings", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicCreateTable, {
      defaultTableName: "Alex's table",
      onBack: () => undefined,
      onCreate: async () => undefined,
    }),
  );
  expect(html).toMatch(/Alex(&#x27;|')s table/);
  expect(html).toContain("SET UP TABLE");
  expect(html).toContain("Player email");
  expect(html).toContain("+ Add another player");
  expect(html).not.toContain("Maximum boxes per player");
});

test("welcome celebration is decorative and session-limited", () => {
  const html = renderToStaticMarkup(createElement(WelcomeParticles));
  expect(html).toContain('aria-hidden="true"');
  const storage = new Map<string, string>();
  const mem = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };
  expect(shouldPlayWelcomeCelebration(mem, false)).toBe(true);
  markWelcomeCelebrationPlayed(mem);
  expect(beginWelcomeCelebration(mem, false, {})).toBe(false);
});

describe("reduced motion", () => {
  test("does not schedule particle movement", () => {
    expect(shouldPlayWelcomeCelebration({ getItem: () => null }, true)).toBe(false);
  });
});
