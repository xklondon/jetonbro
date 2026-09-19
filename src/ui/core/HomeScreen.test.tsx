import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ClassicHome } from "@/ui/skins/classic/components/ClassicHome";
import { ClassicCreateTable } from "@/ui/skins/classic/components/ClassicCreateTable";
import { ClassicSetupTable } from "@/ui/skins/classic/components/ClassicSetupTable";
import { ClassicGameCards } from "@/ui/skins/classic/components/ClassicGameCards";
import { WelcomeParticles } from "@/ui/skins/classic/components/WelcomeCelebration";
import {
  beginWelcomeCelebration,
  markWelcomeCelebrationPlayed,
  shouldPlayWelcomeCelebration,
} from "@/ui/core/welcome-celebration";
import type { HomeTableCard } from "@/application/queries/home";
import type { SetupTableView } from "@/application/queries/views";

const homeCard = (overrides: Partial<HomeTableCard> = {}): HomeTableCard => ({
  id: "t1",
  name: "Salon table",
  game: "Blackjack",
  phase: "TABLE_SETUP",
  headline: "Blackjack · TABLE SETUP",
  playerCount: 1,
  boxCount: 0,
  bankName: "Alex",
  role: "Bank / Dealer",
  updatedAt: new Date().toISOString(),
  saved: false,
  closed: false,
  isOwner: true,
  players: [{ userId: "sam", name: "Sam", available: { millis: "100000", label: "100" }, locked: { millis: "0", label: "0" }, isBankDealer: false }],
  canSave: true,
  canClose: true,
  canDeleteDraft: false,
  closeBlockedReason: null,
  closePreview: {
    kind: "archive",
    confirmation: "Save each Player’s remaining jetons",
    players: [{ name: "Sam", available: "100", locked: "0" }],
  },
  ...overrides,
});

const homeProps = {
  displayName: "Alex",
  defaultTableName: "Alex's table",
  onCreateTable: async () => undefined,
  onJoinTable: () => undefined,
  onOpenTable: () => undefined,
};

const setupView = (overrides: Partial<SetupTableView> = {}): SetupTableView => ({
  role: "SETUP",
  phase: "TABLE_SETUP",
  tableName: "Alex's table",
  game: "Blackjack",
  gameOptions: [
    { id: "BLACKJACK", label: "Blackjack", available: true },
    { id: "POKER", label: "Poker · Coming later", available: false },
  ],
  ownerName: "Alex",
  bankName: "Alex",
  startingJetonsPerPlayer: { millis: "100000", label: "100" },
  seats: [
    { id: "bank", name: "Alex", status: "Bank / Dealer" },
    { id: "sam", name: "sam@example.com", status: "Invited" },
  ],
  members: [
    {
      userId: "bank",
      name: "Alex",
      email: "alex@example.com",
      isOwner: true,
      isBankDealer: true,
      available: { millis: "0", label: "0" },
    },
  ],
  invitations: [{ id: "inv1", kind: "EMAIL", email: "sam@example.com", pending: true }],
  joinUrl: "http://127.0.0.1:3000/join/shared-token",
  minBet: null,
  maxBet: null,
  blackjackPayout: "THREE_TWO",
  maxBoxesPerPlayer: 3,
  insuranceEnabled: true,
  bankMayDistributeJetons: true,
  canStartBetting: false,
  startBlockedReason: "Waiting for a player to join",
  isOwner: true,
  setupCompleted: false,
  tableStatus: "SETUP",
  paused: false,
  closePreview: null,
  ...overrides,
});

test("create table leaves home and does not keep a second setup form there", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicHome, {
      ...homeProps,
      tables: [],
    }),
  );
  expect(html).toContain("CREATE A TABLE");
  expect(html).not.toContain("START TABLE");
  expect(html).not.toContain("SET UP TABLE");
  expect(html).not.toContain("Player email");
  expect(html).not.toContain("CREATE TABLE");
});

test("empty authenticated home shows create and join", () => {
  const html = renderToStaticMarkup(createElement(ClassicHome, { ...homeProps, tables: [] }));
  expect(html).toContain("Welcome to the table, Alex");
  expect(html).toContain("CREATE A TABLE");
  expect(html).toContain("JOIN A TABLE");
});

test("Blackjack and Texas Hold’em are selectable while Zilch is not", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicGameCards, {
      selectedId: "BLACKJACK",
      onSelect: () => undefined,
    }),
  );
  expect(html).toContain("Blackjack");
  expect(html).toContain("Texas Hold’em");
  expect(html).toContain("Coming later");
  expect((html.match(/aria-disabled="true"/g) ?? []).length).toBe(1);
  expect(html).toContain('aria-pressed="true"');
});

test("existing tables remain on the compact home", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicHome, {
      ...homeProps,
      tables: [homeCard()],
    }),
  );
  expect(html).toContain("CREATE NEW TABLE");
  expect(html).toContain("Salon table");
  expect(html).toContain("RETURN TO TABLE");
  expect(html).toContain("Dealer · Alex");
  expect(html).toContain("Sam");
  expect(html).toContain("100");
  expect(html).toContain("home-table-row");
  expect(html).toContain("1 player");
  expect(html).toContain("0 boxes");
});

test("owner home card shows player balances and table menu", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicHome, { ...homeProps, tables: [homeCard()] }),
  );
  expect(html).toContain("Table menu");
  expect(html).toContain("Sam");
  expect(html).toContain("100");
});

test("non-owner home card hides other player balances", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicHome, {
      ...homeProps,
      tables: [
        homeCard({
          isOwner: false,
          role: "Player",
          canSave: false,
          canClose: false,
          canDeleteDraft: false,
          closePreview: null,
          players: [
            { userId: "sam", name: "Sam", available: { millis: "100000", label: "100" }, locked: null, isBankDealer: false },
            { userId: "jo", name: "Jo", available: null, locked: null, isBankDealer: false },
          ],
        }),
      ],
    }),
  );
  expect(html).toContain("Sam");
  expect(html).toContain("Jo");
  expect(html).toContain("100");
  expect(html).not.toContain("Table menu");
  expect(html).not.toContain("SAVE TABLE");
});

test("single setup mask includes invites, QR actions and CREATE TABLE", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicCreateTable, {
      defaultTableName: "Alex's table",
      joinUrl: "http://127.0.0.1:3000/join/shared-token",
      onBack: () => undefined,
      onCreate: async () => undefined,
    }),
  );
  expect(html).toMatch(/Alex(&#x27;|')s table/);
  expect(html).toContain("CREATE TABLE");
  expect(html).not.toContain("START TABLE");
  expect(html).toContain("SCAN TO JOIN TABLE");
  expect(html).toContain("OR INVITE BY EMAIL");
  expect(html).toContain("Player email");
  expect(html).toContain("+ ADD ANOTHER");
  expect(html).toContain("COPY LINK");
  expect(html).toContain("SHARE");
  expect(html.indexOf("SCAN TO JOIN TABLE")).toBeLessThan(html.indexOf("OR INVITE BY EMAIL"));
  expect(html.indexOf("COPY LINK")).toBeLessThan(html.indexOf("OR INVITE BY EMAIL"));
  expect(html.indexOf("OR INVITE BY EMAIL")).toBeLessThan(html.indexOf("CREATE TABLE"));
  expect(html).not.toContain("Maximum boxes per player");
});

test("setup mask sits over the dealer table and shows the shared QR", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicSetupTable, {
      view: setupView(),
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("CREATE TABLE");
  expect(html).toContain("data-phase-heading");
  expect(html).toContain("TABLE SETUP");
  expect(html).toContain(">DEALER<");
  expect(html).toContain("Alex");
  expect(html).toContain("data-blackjack-box-row");
  expect(html).toContain("setup-mask");
  expect(html).toContain("Shared table join QR code");
  expect(html).toContain("SCAN TO JOIN TABLE");
  expect(html).toContain("COPY LINK");
  expect(html).toContain("SHARE");
  expect(html).toContain("OR INVITE BY EMAIL");
  expect(html).not.toContain("waiting-room");
});

test("CREATE TABLE reveals dealer table seats, compact QR and OPEN BETTING", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicSetupTable, {
      view: setupView({
        setupCompleted: true,
        seats: [
          { id: "bank", name: "Alex", status: "Bank / Dealer" },
          { id: "sam", name: "Sam", status: "Joined" },
        ],
        canStartBetting: true,
        startBlockedReason: null,
      }),
      onCommand: () => undefined,
    }),
  );
  expect(html).not.toContain("SET UP TABLE");
  expect(html).not.toContain("CREATE TABLE");
  expect(html).not.toContain("setup-mask");
  expect(html).not.toContain("waiting-room");
  expect(html).not.toContain("Waiting for players");
  expect(html).toContain("data-phase-heading");
  expect(html).toContain("TABLE SETUP");
  expect(html).toContain(">DEALER<");
  expect(html).toContain("Alex");
  expect(html).toContain("dealer-list");
  expect(html).toContain("dealer-player");
  expect(html).toContain("data-blackjack-box-row");
  expect(html).toContain("Sam");
  expect(html).toContain("Joined");
  expect(html).toContain("+ PLAYER");
  expect(html).toContain(">QR<");
  expect(html).toContain("OPEN BETTING");
  expect(html).toContain('data-phase-controls="true"');
  expect(html).toContain("data-game-controls");
  expect(html).toContain("dock");
  expect(html).toMatch(/data-table-name="Alex[^"]*table"/);
  expect((html.match(/data-table-name=/g) ?? []).length).toBe(1);
  expect(html.indexOf("OPEN BETTING")).toBeLessThan(html.indexOf("dealer-list"));
  expect(html.indexOf("OPEN BETTING")).toBeLessThan(html.indexOf("data-game-controls"));
  expect(html).not.toContain("setup-seats");
  expect(html).not.toContain("setup-seat");
  expect(html).not.toContain("DEALER · Alex");
  expect(html).not.toContain("xklondon");
});

test("invited seats render as player boxes and Open Betting stays gated", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicSetupTable, {
      view: setupView({ setupCompleted: true }),
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("Invited");
  expect(html).toContain("sam@example.com");
  expect(html).toContain("disabled");
  expect(html).toContain("Waiting for a player to join");
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
