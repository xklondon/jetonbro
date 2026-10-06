import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BankTableView, BoxView, MemberView, PlayerTableView } from "@/application/queries/views";
import { evaluateHand } from "@/domain/blackjack/cards";
import { BankTable } from "./components/BankTable";
import { PlayerTable } from "./components/PlayerTable";
import { PlayerBox } from "./components/primitives/PlayerBox";
import { HandTiles, handStatusLabel } from "./components/primitives/HandCards";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });
const noop = () => undefined;

const members: MemberView[] = [
  { userId: "p1", name: "Casey", email: "c@x.io", isOwner: false, isBankDealer: false, available: money("100") },
  { userId: "p2", name: "Blair", email: "b@x.io", isOwner: false, isBankDealer: false, available: money("100") },
  { userId: "d1", name: "Dee", email: "d@x.io", isOwner: true, isBankDealer: true, available: money("0") },
];

function box(overrides: Partial<BoxView> & Pick<BoxView, "id" | "boxNumber" | "playerId" | "playerName">): BoxView {
  return {
    label: `BOX ${overrides.boxNumber}`,
    bet: money("25"),
    originalStake: money("25"),
    isDoubled: false,
    isSplit: false,
    insurance: null,
    insuranceMax: money("12.5", "12500"),
    insuranceResult: null,
    outcome: null,
    returned: null,
    payoutActions: [
      { outcome: "LOST", label: "LOST", title: "LOST" },
      { outcome: "PUSH", label: "STAND OFF", title: "STAND OFF" },
      { outcome: "BLACKJACK", label: "BLACKJACK", title: "BLACKJACK" },
      { outcome: "WON", label: "WON", title: "WON" },
    ],
    hand: { ranks: [], complete: false, label: "", suggestedOutcome: null, canEdit: true },
    ...overrides,
  };
}

function bank(phase: BankTableView["phase"], boxes: BoxView[], extra: Partial<BankTableView> = {}): BankTableView {
  const byPlayer = new Map<string, BoxView[]>();
  for (const item of boxes) {
    const list = byPlayer.get(item.playerId) ?? [];
    list.push(item);
    byPlayer.set(item.playerId, list);
  }
  return {
    role: "BANK",
    phase,
    tableName: "Salon",
    title: "",
    copy: "",
    phaseLabel: phase,
    primaryAction: {
      id: phase === "PAYOUT" ? "nextHand" : phase === "PLAYING" ? "payoutPhase" : "dealCards",
      label: phase === "PAYOUT" ? "START BETTING" : phase === "PLAYING" ? "ENTER PAYOUT" : "DEAL CARDS",
      enabled: phase !== "PAYOUT" || boxes.every((item) => item.outcome) ,
    },
    boxes,
    players: [...byPlayer.entries()].map(([userId, playerBoxes]) => ({
      userId,
      name: playerBoxes[0]!.playerName,
      available: money("100"),
      locked: money("25"),
      status: "",
      boxes: playerBoxes,
    })),
    playerCount: byPlayer.size,
    boxCount: boxes.length,
    lockedOrdinary: money("50"),
    insurance: { window: "CLOSED", total: money("0"), count: 0, resolution: null },
    actions: {
      dealCards: phase === "BETTING",
      scheduleDeal: phase === "BETTING",
      payoutPhase: phase === "PLAYING",
      nextHand: phase === "PAYOUT" && boxes.every((item) => item.outcome),
      scheduleNextRound: phase === "PAYOUT",
      openInsurance: phase === "PLAYING",
      closeInsurance: false,
      settleBoxes: phase === "PAYOUT",
      settleDealerWon: phase === "PAYOUT",
      settleInsurance: phase === "PAYOUT",
      addPlayer: phase === "BETTING",
      giveJetons: true,
      changeBank: true,
      saveTable: true,
      closeTable: true,
      switchGame: true,
    },
    insuranceSettleActions: [],
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    hasValidBet: true,
    isOwner: true,
    tableStatus: "ACTIVE",
    paused: false,
    closePreview: null,
    dealerHand: { ranks: ["K", "3"], complete: false, label: "Hard 13", suggestedOutcome: null, canEdit: phase === "PLAYING" },
    dealerName: "Dee",
    ...extra,
  };
}

function playerView(phase: PlayerTableView["phase"], boxes: BoxView[], extra: Partial<PlayerTableView> = {}): PlayerTableView {
  return {
    role: "PLAYER",
    phase,
    tableName: "Salon",
    title: "",
    copy: "",
    available: money("75"),
    boxes,
    insuranceWindowOpen: false,
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    actions: {
      bet: phase === "BETTING",
      retract: phase === "BETTING",
      addBox: phase === "BETTING",
      removeEmptyBox: false,
      double: phase === "PLAYING",
      split: phase === "PLAYING",
      insurance: phase === "PLAYING",
    },
    ...extra,
  };
}

describe("Blackjack polish — Dealer payout results", () => {
  it("uses CARDS / RESULT composition and large settled badges", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank("PAYOUT", [
          box({
            id: "b1",
            boxNumber: 1,
            playerId: "p1",
            playerName: "Casey",
            outcome: "WON",
            returned: money("50"),
            insurance: money("12.5", "12500"),
            insuranceResult: "WON return 37.5",
            hand: { ranks: ["10", "9"], complete: true, label: "19", suggestedOutcome: null, canEdit: false },
          }),
          box({
            id: "b2",
            boxNumber: 2,
            playerId: "p1",
            playerName: "Casey",
            bet: money("10"),
            outcome: "LOST",
            returned: money("0"),
            hand: { ranks: ["K", "Q"], complete: true, label: "20", suggestedOutcome: null, canEdit: false },
          }),
          box({
            id: "b3",
            boxNumber: 1,
            playerId: "p2",
            playerName: "Blair",
            bet: money("25"),
            outcome: "PUSH",
            returned: money("25"),
            hand: { ranks: ["9", "8"], complete: true, label: "17", suggestedOutcome: null, canEdit: false },
          }),
          box({
            id: "b4",
            boxNumber: 2,
            playerId: "p2",
            playerName: "Blair",
            bet: money("25"),
            outcome: "BLACKJACK",
            returned: money("62.5", "62500"),
            hand: { ranks: ["A", "K"], complete: true, label: "Blackjack", suggestedOutcome: null, canEdit: false },
          }),
        ]),
        members,
        onCommand: noop,
      }),
    );
    expect(html).toContain("CARDS");
    expect(html).toContain("RESULT");
    expect(html).not.toMatch(/data-ledger-mode="payout"[\s\S]*?>ACTION</);
    expect(html).toContain('data-box-result="WON"');
    expect(html).toContain('data-box-result="LOST"');
    expect(html).toContain('data-box-result="PUSH"');
    expect(html).toContain('data-box-result="BLACKJACK"');
    expect(html).toContain("tt-result-badge is-won");
    expect(html).toContain("tt-result-badge is-lost");
    expect(html).toContain("tt-result-badge is-push");
    expect(html).toContain("tt-result-badge is-blackjack");
    expect(html).toContain("INS WON");
    expect(html).not.toContain("Won · 50");
    expect(html.match(/data-blackjack-box-row="true"/g)?.length).toBe(4);
  });

  it("keeps double as one row and split as separate rows", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank("PAYOUT", [
          box({
            id: "b1",
            boxNumber: 1,
            playerId: "p1",
            playerName: "Casey",
            bet: money("50"),
            isDoubled: true,
            outcome: "WON",
            returned: money("100"),
          }),
          box({
            id: "b2",
            boxNumber: 2,
            playerId: "p1",
            playerName: "Casey",
            bet: money("25"),
            isSplit: true,
            outcome: "LOST",
            returned: money("0"),
          }),
          box({
            id: "b3",
            boxNumber: 3,
            playerId: "p1",
            playerName: "Casey",
            bet: money("25"),
            isSplit: true,
            outcome: null,
          }),
        ]),
        members,
        onCommand: noop,
      }),
    );
    expect(html.match(/data-blackjack-box-row="true"/g)?.length).toBe(3);
    expect(html).toContain('data-doubled="true"');
    expect(html.match(/data-split="true"/g)?.length).toBe(2);
  });
});

describe("Blackjack polish — card totals under cards", () => {
  it("places HARD 13 beneath the card row", () => {
    const html = renderToStaticMarkup(
      createElement(HandTiles, {
        hand: { ranks: ["K", "3"], complete: false, label: "Hard 13", suggestedOutcome: null, canEdit: false },
      }),
    );
    expect(html).toContain("tt-hand-rank-row");
    expect(html).toContain('data-hand-total="true"');
    expect(html.indexOf("tt-hand-rank-row")).toBeLessThan(html.indexOf("HARD 13"));
    expect(html.indexOf("tt-rank-tile")).toBeLessThan(html.indexOf("HARD 13"));
    expect(handStatusLabel({ ranks: ["K", "3"], complete: false, label: "Hard 13", suggestedOutcome: null, canEdit: false })).toBe("HARD 13");
  });

  it("Dealer Playing uses the same vertical card/total composition", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank("PLAYING", [
          box({
            id: "b1",
            boxNumber: 1,
            playerId: "p1",
            playerName: "Casey",
            hand: { ranks: ["10", "3"], complete: false, label: "Hard 13", suggestedOutcome: null, canEdit: true },
          }),
        ]),
        members,
        onCommand: noop,
      }),
    );
    expect(html).toContain("DEALER HAND");
    expect(html).toContain("tt-hand-rank-row");
    expect(html).toContain("HARD 13");
    expect(html.match(/data-hand-total="true"/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Blackjack polish — Player result presentation", () => {
  it("shows large WON/LOST/STAND OFF/BLACKJACK labels on Player boxes", () => {
    for (const [outcome, label] of [
      ["WON", "WON"],
      ["LOST", "LOST"],
      ["PUSH", "STAND OFF"],
      ["BLACKJACK", "BLACKJACK"],
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(PlayerBox, {
          box: box({
            id: `b-${outcome}`,
            boxNumber: 1,
            playerId: "p1",
            playerName: "Casey",
            outcome,
            returned: money("25"),
          }),
        }),
      );
      expect(html).toContain(`data-payout-state="${outcome}"`);
      expect(html).toContain(label);
      expect(html).toMatch(/tt-pbox-result is-/);
    }
  });

  it("keeps outcome text when celebrate class is absent on SSR refresh", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerTable, {
        view: playerView("PAYOUT", [
          box({
            id: "b1",
            boxNumber: 1,
            playerId: "p1",
            playerName: "Casey",
            outcome: "BLACKJACK",
            returned: money("62.5", "62500"),
            hand: { ranks: ["A", "K"], complete: true, label: "Blackjack", suggestedOutcome: null, canEdit: false },
          }),
        ]),
        selectedBoxId: "b1",
        onSelectBox: noop,
        onCommand: noop,
      }),
    );
    expect(html).toContain("BLACKJACK");
    expect(html).not.toContain("is-celebrate-blackjack");
    expect(html).toContain('data-hand-total="true"');
  });

  it("Ace soft/hard, Blackjack and Bust labels stay display-only", () => {
    expect(evaluateHand(["A", "K"]).label).toBe("Blackjack");
    expect(evaluateHand(["A", "6"]).label).toBe("Soft 17");
    expect(evaluateHand(["A", "6", "K"]).label).toBe("Hard 17");
    expect(evaluateHand(["K", "Q", "5"]).label).toBe("Bust");
  });
});

describe("Prompt 5 payout density and BETTING copy", () => {
  it("unresolved payout uses one horizontal result row with accessible names", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank("PAYOUT", [
          box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey", outcome: null }),
        ]),
        members,
        onCommand: noop,
      }),
    );
    expect(html).toContain("tt-ledger-results");
    expect(html).toContain("Set Box 1 result: Lost");
    expect(html).toContain("Set Box 1 result: Stand-off");
    expect(html).toContain("Set Box 1 result: Blackjack");
    expect(html).toContain("Set Box 1 result: Won");
    expect(html).not.toContain("Betting open");
  });

  it("Betting heading is only BETTING", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank("BETTING", []),
        members,
        onCommand: noop,
      }),
    );
    expect(html).toContain(">BETTING<");
    expect(html).not.toContain("Betting open");
  });
});
