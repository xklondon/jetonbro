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
  headline: "SETUP",
  playerCount: 1,
  boxCount: 0,
  bankName: "Alex",
  ownerName: "Alex",
  role: "Bank / Dealer",
  updatedAt: new Date().toISOString(),
  saved: false,
  closed: false,
  isOwner: true,
  players: [{ userId: "sam", name: "Sam", available: { millis: "100000", label: "100" }, locked: { millis: "0", label: "0" }, isBankDealer: false }],
  canSave: true,
  canClose: true,
  canDeleteDraft: false,
  canDeleteArchived: false,
  canEndAndDelete: true,
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
  joinUrl: "http://127.0.0.1:3000/join/verified/shared-token",
  guestJoinUrl: "http://127.0.0.1:3000/join/guest/guest-token",
  verifiedJoinUrl: "http://127.0.0.1:3000/join/verified/shared-token",
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
  expect(html).toContain("CREATE TABLE");
  expect(html).not.toContain("START TABLE");
  expect(html).not.toContain("SET UP TABLE");
  expect(html).not.toContain("Player email");
});

test("empty authenticated home shows create", () => {
  const html = renderToStaticMarkup(createElement(ClassicHome, { ...homeProps, tables: [] }));
  expect(html).toContain("Welcome, Alex");
  expect(html).toContain("CREATE TABLE");
  expect(html).not.toContain("JOIN TABLE");
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
  expect(html).toContain("CREATE TABLE");
  expect(html).toContain("Salon table");
  expect(html).toContain("RESUME");
  expect(html).toContain("data-home-heading");
  expect(html).toContain("SAVED TABLES");
  expect(html).toContain("Resume a table or create a new one.");
  expect(html).toContain("SETUP");
  expect(html).toContain("home-table-row");
  expect(html).toContain("home-resume");
  expect(html).not.toContain("0 boxes");
  expect(html).not.toContain("home-table-players");
  expect(html).not.toContain("phase-head");
});

test("owner home card shows compact summary and table menu", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicHome, { ...homeProps, tables: [homeCard()] }),
  );
  expect(html).toContain("Table menu");
  expect(html).toContain("END &amp; DELETE");
  expect(html).toContain("home-table-reveal");
  expect(html).not.toContain("home-table-players");
});

test("non-owner home card hides owner actions and other player balances", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicHome, {
      ...homeProps,
      tables: [
        homeCard({
          isOwner: false,
          role: "Player",
          playerCount: 2,
          canSave: false,
          canClose: false,
          canDeleteDraft: false,
          canDeleteArchived: false,
          canEndAndDelete: false,
          closePreview: null,
          players: [
            { userId: "sam", name: "Sam", available: { millis: "100000", label: "100" }, locked: null, isBankDealer: false },
            { userId: "jo", name: "Jo", available: null, locked: null, isBankDealer: false },
          ],
        }),
      ],
    }),
  );
  expect(html).toContain("Salon table");
  expect(html).toContain("SETUP");
  expect(html).not.toContain("Table menu");
  expect(html).not.toContain("SAVE TABLE");
  expect(html).not.toContain("END &amp; DELETE");
  expect(html).not.toContain("data-home-details");
  expect(html).not.toContain("home-table-players");
});

test("full create table setup includes game, bank and START TABLE", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicCreateTable, {
      defaultTableName: "Alex's table",
      onBack: () => undefined,
      onCreate: async () => undefined,
    }),
  );
  expect(html).toMatch(/Alex(&#x27;|')s table/);
  expect(html).toContain("START TABLE");
  expect(html).toContain("Starting jetons");
  expect(html).toContain("Blackjack");
  expect(html).toContain("OPEN BANK");
  expect(html).toContain("GUEST QR");
  expect(html).not.toContain("ADD NEW PLAYER");
  expect(html).not.toContain("JOIN WITHOUT EMAIL");
  expect(html).not.toContain("Guest QR — no email");
  expect(html).not.toContain("Maximum boxes per player");
  expect(html).not.toContain("CARD ASSIST");
});

test("Phase 0 shows compact waiting rows and START BETTING", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicSetupTable, {
      view: setupView({ setupCompleted: true }),
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("data-phase-heading");
  expect(html).toContain("Table setup");
  expect(html).toContain('data-dealer-dock="true"');
  expect(html).toContain('data-dock-columns="2"');
  expect(html).not.toContain("phase-zero-meta");
  expect(html).not.toContain("Owner · Alex");
  expect(html).not.toContain("DEALER · Alex");
  expect(html).not.toContain("setup-mask");
  expect(html).not.toContain("waiting-room");
  expect(html).toContain("ADD PLAYER");
  expect(html).not.toContain("JOIN WITHOUT EMAIL");
  expect(html).not.toContain("Guest QR — no email");
  expect(html).toContain("START BETTING");
  expect(html).not.toContain("START BLACKJACK");
  expect(html).not.toContain("START POKER");
  expect(html).toContain("data-phase-action");
  expect(html).toMatch(/data-table-name="Alex[^"]*table"/);
  expect(html).not.toContain('aria-label="Dealer"');
});

test("Phase 0 empty waiting is a compact card, not a blank placeholder", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicSetupTable, {
      view: setupView({
        setupCompleted: true,
        invitations: [],
        seats: [{ id: "bank", name: "Alex", status: "Bank / Dealer" }],
      }),
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain('data-player-count="0"');
  expect(html).toContain("Table setup");
  expect(html).toContain("START BETTING");
  expect(html).not.toContain("waiting-room");
  expect(html).not.toContain("setup-mask");
});

test("START TABLE completed table does not keep a second setup form", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicSetupTable, {
      view: setupView({
        setupCompleted: true,
        seats: [
          { id: "bank", name: "Alex", status: "Bank / Dealer" },
          { id: "sam", name: "Sam", status: "Joined" },
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
          {
            userId: "sam",
            name: "Sam",
            email: "sam@example.com",
            isOwner: false,
            isBankDealer: false,
            available: { millis: "100000", label: "100" },
          },
        ],
        canStartBetting: true,
        startBlockedReason: null,
      }),
      onCommand: () => undefined,
    }),
  );
  expect(html).not.toContain("SET UP TABLE");
  expect(html).not.toContain("setup-mask");
  expect(html).not.toContain("waiting-room");
  expect(html).not.toContain("data-seat-status=\"empty\"");
  expect(html).toContain("data-phase-heading");
  expect(html).toContain("Table setup");
  expect(html).toContain("Sam");
  expect(html).toContain("ADD PLAYER");
  expect(html).not.toContain("JOIN WITHOUT EMAIL");
  expect(html).toContain("START BETTING");
  expect(html).toContain("dock");
  expect(html).toMatch(/data-table-name="Alex[^"]*table"/);
  expect(html).not.toContain("xklondon");
});

test("invited seats render as compact rows and START BETTING stays gated", () => {
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

test("incomplete setup still uses the full Create Table screen", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicSetupTable, {
      view: setupView({ setupCompleted: false }),
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("START TABLE");
  expect(html).toContain("OPEN BANK");
  expect(html).not.toContain("START BETTING");
  expect(html).not.toContain("data-seat-status=\"empty\"");
  expect(html).not.toContain("START BLACKJACK");
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
