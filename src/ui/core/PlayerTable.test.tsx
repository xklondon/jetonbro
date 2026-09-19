import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ClassicPlayerTable } from "@/ui/skins/classic/components/ClassicPlayerTable";
import type { PlayerTableView } from "@/application/queries/views";

const view: PlayerTableView = {
  role: "PLAYER",
  phase: "PLAYING",
  tableName: "Salon",
  title: "Play your hands",
  copy: "Select a box",
  available: { millis: "75000", label: "75" },
  insuranceWindowOpen: false,
  bettingCloseDeadlineAt: null,
  nextRoundDeadlineAt: null,
  actions: {
    bet: false,
    retract: false,
    addBox: false,
    removeEmptyBox: false,
    double: true,
    split: true,
    insurance: false,
  },
  boxes: [
    {
      id: "1",
      playerId: "p1",
      playerName: "Alex",
      label: "YOUR BOX 1",
      boxNumber: 1,
      bet: { millis: "25000", label: "25" },
      originalStake: { millis: "25000", label: "25" },
      isDoubled: false,
      isSplit: false,
      insurance: null,
      insuranceMax: { millis: "12500", label: "12.5" },
      insuranceResult: null,
      outcome: null,
      returned: null,
      payoutActions: [],
      hand: { ranks: [], complete: false, label: "", suggestedOutcome: null, canEdit: true },
    },
    {
      id: "2",
      playerId: "p1",
      playerName: "Alex",
      label: "YOUR BOX 2",
      boxNumber: 2,
      bet: { millis: "10000", label: "10" },
      originalStake: { millis: "10000", label: "10" },
      isDoubled: false,
      isSplit: false,
      insurance: null,
      insuranceMax: { millis: "5000", label: "5" },
      insuranceResult: null,
      outcome: null,
      returned: null,
      payoutActions: [],
      hand: { ranks: [], complete: false, label: "", suggestedOutcome: null, canEdit: true },
    },
  ],
};

test("player sees all own boxes together and keeps jetons visible while playing", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view,
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("YOUR BOX 1");
  expect(html).toContain("YOUR BOX 2");
  expect(html).toContain('data-box-nav="true"');
  expect(html).toContain('data-selected-box="1"');
  expect(html).toContain('data-phase-heading');
  expect(html).not.toContain("Select a box");
  expect(html).toContain("YOUR JETONS");
  expect(html).toContain("AVAILABLE");
  expect(html).toContain("data-player-wallet");
  expect(html).toContain('data-table-name="Salon"');
  expect(html).not.toContain("xklondon");
  expect(html).not.toContain("AVAILABLE VALUE");
  expect(html).toContain("75");
  expect(html).toContain("Insurance");
  expect(html).toContain("Double");
  expect(html).toContain("Split");
  expect(html).toContain("+ CARDS");
  expect(html).not.toContain("+ ADD CARDS");
  expect(html).not.toContain("bj-rail");
  expect(html).not.toContain("table-rail");
  expect(html.indexOf("Insurance")).toBeLessThan(html.indexOf("YOUR JETONS"));
  expect(html).toContain("selected");
  expect(html).not.toContain("OPEN BANK");
  expect(html).not.toContain("LIMITED BANK");
});

test("entered Blackjack ranks sit inside the betting box above the card controls", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: {
        ...view,
        boxes: [
          {
            ...view.boxes[0]!,
            hand: { ranks: ["10", "6"], complete: false, label: "16", suggestedOutcome: null, canEdit: true },
          },
          view.boxes[1]!,
        ],
      },
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("data-box-cards");
  expect(html).toContain("playing-card is-box");
  expect(html.indexOf("data-box-cards")).toBeGreaterThan(html.indexOf("class=\"box"));
  expect(html.indexOf("data-box-cards")).toBeLessThan(html.indexOf("data-game-controls"));
  expect(html.indexOf("+ CARDS") === -1 || html.indexOf("HAND COMPLETE") > html.indexOf("class=\"box")).toBe(true);
  expect(html.indexOf("HAND COMPLETE")).toBeGreaterThan(html.indexOf("class=\"box"));
  expect(html.indexOf("HAND COMPLETE")).toBeLessThan(html.indexOf("data-game-controls"));
  expect(html).not.toContain("+ ADD CARDS");
});


test("player never sees the Open/Limited Bank toggle even when a bankroll snapshot is present", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: {
        ...view,
        phase: "BETTING",
        actions: { ...view.actions, bet: true, retract: true, addBox: true, double: false, split: false, insurance: false },
        bankroll: {
          mode: "OPEN",
          available: { millis: "0", label: "0" },
          reserved: { millis: "0", label: "0" },
          total: { millis: "0", label: "0" },
          canToggle: false,
          lockedReason: null,
          canCoverMore: true,
        },
      },
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("YOUR JETONS");
  expect(html).not.toContain("OPEN BANK");
  expect(html).not.toContain("LIMITED BANK");
  expect(html).not.toContain("funding-switch");
});

test("player betting keeps the permanent jeton dock below exact-amount controls", () => {
  const bettingView: PlayerTableView = {
    ...view,
    phase: "BETTING",
    title: "Place your bets",
    actions: { ...view.actions, bet: true, retract: true, addBox: true, double: false, split: false, insurance: false },
  };
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: bettingView,
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("Amount");
  expect(html).toContain("YOUR JETONS");
  expect(html).toContain("Retract 25 jetons from Box 1");
  expect(html).toContain("player-boxes two");
  expect(html.indexOf("Amount")).toBeLessThan(html.indexOf("YOUR JETONS"));
});

test("a single player box is centred on the felt", () => {
  const oneBox: PlayerTableView = {
    ...view,
    phase: "BETTING",
    boxes: [view.boxes[0]!],
    bettingCloseDeadlineAt: null,
    actions: { ...view.actions, bet: true, retract: true, addBox: true, double: false, split: false, insurance: false },
  };
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: oneBox,
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("player-boxes one");
});

test("player payout keeps the jeton dock visible under settlement status", () => {
  const payoutView: PlayerTableView = {
    ...view,
    phase: "PAYOUT",
    title: "Waiting for the Bank",
    actions: { ...view.actions, double: false, split: false, insurance: false },
  };
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: payoutView,
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("Waiting for the Bank");
  expect(html).toContain("YOUR JETONS");
  expect(html.indexOf("Waiting for the Bank")).toBeLessThan(html.indexOf("YOUR JETONS"));
});

test("player payout shows Hand complete after every box is resolved", () => {
  const payoutView: PlayerTableView = {
    ...view,
    phase: "PAYOUT",
    title: "Hand complete",
    boxes: view.boxes.map((box) => ({ ...box, outcome: "LOST" as const })),
    actions: { ...view.actions, double: false, split: false, insurance: false },
  };
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: payoutView,
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("Hand complete");
  expect(html).toContain("YOUR JETONS");
  expect(html).not.toContain("outcome-celebration");
});
