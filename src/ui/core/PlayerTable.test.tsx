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
  expect(html).toContain("2×");
  expect(html).toContain("SPLIT");
  expect(html).toContain('data-play-controls="true"');
  expect(html).toContain('data-player-action="insurance"');
  expect(html).toMatch(/data-player-action="insurance"[^>]*disabled/);
  expect(html).not.toContain("PLACE INSURANCE");
  expect(html).toContain("data-box-stage");
  expect(html).toContain("BOX 1");
  expect(html).not.toContain("+ CARDS");
  expect(html).not.toContain("+ ADD CARDS");
  expect(html).not.toContain("bj-rail");
  expect(html).not.toContain("table-rail");
  expect(html.indexOf("2×")).toBeLessThan(html.indexOf("YOUR JETONS"));
  expect(html).toContain("selected");
  expect(html).not.toContain("OPEN BANK");
  expect(html).not.toContain("LIMITED BANK");
});

test("optional ranks stay off the main Player surface unless Card Assist is on", () => {
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
  expect(html).not.toContain("data-box-cards");
  expect(html).not.toContain("+ CARDS");
  expect(html).not.toContain("HAND COMPLETE");
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
  expect(html).toContain("Betting is open.");
  expect(html).not.toContain("WAITING FOR PLAYERS");
  expect(html).toContain("Amount");
  expect(html).toContain("PLACE BET");
  expect(html).toContain("ADD BOX");
  expect(html.indexOf("ADD BOX")).toBeLessThan(html.indexOf("PLACE BET"));
  expect(html).toContain("YOUR JETONS");
  expect(html).toContain("Retract 25 jetons from Box 1");
  expect(html).toContain("data-box-stage");
  expect(html).toContain('data-box-slot="1"');
  expect(html).toContain('data-box-slot="2"');
  expect(html).not.toContain("player-boxes two");
  expect(html.indexOf("Amount")).toBeLessThan(html.indexOf("YOUR JETONS"));
  expect(html).not.toContain("DOUBLE");
  expect(html).not.toContain("SPLIT");
  expect(html).not.toContain("data-play-controls");
  expect(html).not.toContain("PLACE INSURANCE");
});

test("a single player box begins centred on the fixed stage", () => {
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
  expect(html).toContain("data-box-stage");
  expect(html).toContain('data-box-slot="1"');
  expect(html).toContain("BOX 1");
  expect(html).not.toContain("player-boxes one");
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
  expect(html).toContain("PAYOUT");
  expect(html).toContain("YOUR JETONS");
  expect(html).not.toContain("2×");
  expect(html).not.toContain("SPLIT");
  expect(html).not.toContain("data-play-controls");
  expect(html).not.toContain("PLACE BET");
  expect(html).not.toContain("ADD BOX");
  expect(html).not.toContain("PLACE INSURANCE");
  expect(html).not.toContain('data-player-action="insurance"');
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
  expect(html).toContain("YOUR JETONS");
  expect(html).not.toContain("outcome-celebration");
});

test("player payout stacks identity, MAIN, and Insurance on separate lines", () => {
  const longName = "Alexandria-Maximilienne-of-the-Long-Table";
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: {
        ...view,
        phase: "PAYOUT",
        boxes: [
          {
            ...view.boxes[0]!,
            playerName: longName,
            label: `YOUR BOX 1 · ${longName}`,
            outcome: "WON",
            returned: { millis: "50000", label: "50" },
            insurance: { millis: "12500", label: "12.5" },
            insuranceResult: "INSURANCE LOST",
          },
          {
            ...view.boxes[1]!,
            playerName: longName,
            outcome: "LOST",
            returned: { millis: "0", label: "0" },
            insurance: null,
            insuranceResult: null,
          },
        ],
        actions: { ...view.actions, double: false, split: false, insurance: false },
      },
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("is-payout");
  expect(html).toContain('data-payout-main="true"');
  expect(html).toContain('data-payout-insurance="true"');
  expect(html).toContain("BOX 1");
  expect(html).toContain("Won +50");
  expect(html).toContain("INSURANCE LOST");
  expect(html).toContain("Lost");
  expect(html.indexOf("data-payout-main")).toBeLessThan(html.indexOf("data-payout-insurance"));
  expect(html).toContain("box-head");
  expect(html).toContain("YOUR BOX");
  expect(html).toContain(longName);
  const box2 = html.slice(html.indexOf('data-box-id="2"'), html.indexOf('data-box-id="1"'));
  expect(box2).not.toContain("data-payout-insurance");
  expect(html).not.toContain("DOUBLE");
  expect(html).not.toContain("data-play-controls");
});

test("player payout Insurance won stays on its own line", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: {
        ...view,
        phase: "PAYOUT",
        boxes: [
          {
            ...view.boxes[0]!,
            outcome: "LOST",
            returned: { millis: "0", label: "0" },
            insurance: { millis: "12500", label: "12.5" },
            insuranceResult: "INSURANCE WON · return 37.5",
          },
        ],
        actions: { ...view.actions, double: false, split: false, insurance: false },
      },
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("Won +37.5");
  expect(html).toContain('data-insurance-result="INSURANCE WON · return 37.5"');
  expect(html).toContain("Lost");
  expect(html).not.toContain("DOUBLE");
  expect(html).not.toContain("data-play-controls");
});

test("player Insurance uses short copy and keeps the fixed box stage", () => {
  const html = renderToStaticMarkup(
    createElement(ClassicPlayerTable, {
      view: {
        ...view,
        insuranceWindowOpen: true,
        actions: { ...view.actions, insurance: true, double: true, split: true },
      },
      selectedBoxId: "1",
      onSelectBox: () => undefined,
      onCommand: () => undefined,
    }),
  );
  expect(html).toContain("INSURANCE OPEN");
  expect(html).toContain("INSURANCE");
  expect(html).toContain("2×");
  expect(html).toContain('data-player-action="insurance"');
  expect(html).toContain("data-insurance-panel");
  expect(html).toContain("MAX");
  expect(html).toContain("data-box-stage");
  expect(html).toContain('data-box-slot="1"');
  expect(html).toContain('data-box-slot="2"');
});
