import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BankTableView, BoxView, MemberView, PlayerTableView } from "@/application/queries/views";
import { evaluateHand } from "@/domain/blackjack/cards";
import { BankTable } from "./components/BankTable";
import { PlayerTable } from "./components/PlayerTable";

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
      enabled: true,
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
      nextHand: phase === "PAYOUT",
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
    dealerHand: { ranks: [], complete: false, label: "", suggestedOutcome: null, canEdit: phase === "PLAYING" },
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

describe("Blackjack box-instance ledger", () => {
  it("one Player / one box → one Dealer row", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank("BETTING", [box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey", bet: money("25") })]),
        members,
        onCommand: noop,
      }),
    );
    expect(html.match(/data-blackjack-box-row="true"/g)?.length).toBe(1);
    expect(html).toContain("Casey");
    expect(html).toContain("BOX 1");
    expect(html).toContain(">25<");
  });

  it("one Player / two boxes → two Dealer rows with separate stakes", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank("BETTING", [
          box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey", bet: money("25") }),
          box({ id: "b2", boxNumber: 2, playerId: "p1", playerName: "Casey", bet: money("10") }),
        ]),
        members,
        onCommand: noop,
      }),
    );
    expect(html.match(/data-blackjack-box-row="true"/g)?.length).toBe(2);
    expect(html).toContain('data-box-id="b1"');
    expect(html).toContain('data-box-id="b2"');
    expect(html).toContain(">25<");
    expect(html).toContain(">10<");
  });

  it("two Players / three boxes → three Dealer rows", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank("PLAYING", [
          box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey", bet: money("25") }),
          box({ id: "b2", boxNumber: 2, playerId: "p1", playerName: "Casey", bet: money("10") }),
          box({ id: "b3", boxNumber: 1, playerId: "p2", playerName: "Blair", bet: money("50") }),
        ]),
        members,
        onCommand: noop,
      }),
    );
    expect(html.match(/data-blackjack-box-row="true"/g)?.length).toBe(3);
    expect(html).toContain("Casey");
    expect(html).toContain("Blair");
    expect(html).toContain(">50<");
  });

  it("double stays on the correct box as 2× without inventing a second row", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank("PLAYING", [
          box({
            id: "b1",
            boxNumber: 1,
            playerId: "p1",
            playerName: "Casey",
            bet: money("50"),
            originalStake: money("25"),
            isDoubled: true,
          }),
          box({ id: "b2", boxNumber: 2, playerId: "p1", playerName: "Casey", bet: money("10") }),
        ]),
        members,
        onCommand: noop,
      }),
    );
    expect(html.match(/data-blackjack-box-row="true"/g)?.length).toBe(2);
    expect(html).toContain('data-doubled="true"');
    expect(html).toContain("2×");
  });

  it("payout controls settle only that box; insurance controls appear when insured", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank("PAYOUT", [
          box({
            id: "b1",
            boxNumber: 1,
            playerId: "p1",
            playerName: "Casey",
            bet: money("25"),
            insurance: money("12.5", "12500"),
            hand: { ranks: ["10", "9"], complete: true, label: "19", suggestedOutcome: null, canEdit: false },
          }),
          box({
            id: "b2",
            boxNumber: 2,
            playerId: "p1",
            playerName: "Casey",
            bet: money("10"),
            outcome: "WON",
            returned: money("20"),
            hand: { ranks: ["K", "Q"], complete: true, label: "20", suggestedOutcome: null, canEdit: false },
          }),
        ]),
        members,
        onCommand: noop,
      }),
    );
    expect(html).toContain('data-box-id="b1"');
    expect(html).toContain("data-payout-action");
    expect(html).toContain("INS WON");
    expect(html).toContain("INS LOST");
    expect(html).toContain("Won · 20");
    expect(html).not.toContain('class="tt-dealer-summary');
  });
});

describe("Blackjack card entry surface", () => {
  it("Player Playing shows cards, totals, + CARD and UNDO for selected box", () => {
    const html = renderToStaticMarkup(
      createElement(PlayerTable, {
        view: playerView("PLAYING", [
          box({
            id: "b1",
            boxNumber: 1,
            playerId: "p1",
            playerName: "Casey",
            hand: { ranks: ["A", "9"], complete: false, label: "Soft 20", suggestedOutcome: null, canEdit: true },
          }),
          box({
            id: "b2",
            boxNumber: 2,
            playerId: "p1",
            playerName: "Casey",
            bet: money("10"),
            hand: { ranks: ["K", "5"], complete: false, label: "Hard 15", suggestedOutcome: null, canEdit: true },
          }),
        ]),
        selectedBoxId: "b1",
        onSelectBox: noop,
        onCommand: noop,
      }),
    );
    expect(html).toContain('data-box-cards="true"');
    expect(html).toContain("SOFT 20");
    expect(html).toContain("HARD 15");
    expect(html).toContain("+ CARD");
    expect(html).toContain("UNDO");
    expect(html).not.toContain("ADD BOX");
  });

  it("Dealer Playing shows Dealer hand panel and recorded cards per box", () => {
    const html = renderToStaticMarkup(
      createElement(BankTable, {
        view: bank(
          "PLAYING",
          [
            box({
              id: "b1",
              boxNumber: 1,
              playerId: "p1",
              playerName: "Casey",
              hand: { ranks: ["10", "6"], complete: false, label: "Hard 16", suggestedOutcome: null, canEdit: true },
            }),
            box({
              id: "b2",
              boxNumber: 2,
              playerId: "p1",
              playerName: "Casey",
              bet: money("10"),
              hand: { ranks: ["9", "8"], complete: false, label: "Hard 17", suggestedOutcome: null, canEdit: true },
            }),
          ],
          {
            dealerHand: { ranks: ["A"], complete: false, label: "Soft 11", suggestedOutcome: null, canEdit: true },
          },
        ),
        members,
        onCommand: noop,
      }),
    );
    expect(html).toContain("DEALER HAND");
    expect(html).toContain("SOFT 11");
    expect(html).toContain("HARD 16");
    expect(html).toContain("HARD 17");
    expect(html).toContain('data-card-action="correct"');
    expect(html).toContain("UNDO LAST");
  });

  it("display totals treat Ace soft/hard, Blackjack and Bust correctly", () => {
    expect(evaluateHand(["A", "K"]).label).toBe("Blackjack");
    expect(evaluateHand(["A", "K"]).naturalBlackjack).toBe(true);
    expect(evaluateHand(["A", "6"]).label).toBe("Soft 17");
    expect(evaluateHand(["A", "6", "K"]).label).toBe("Hard 17");
    expect(evaluateHand(["K", "Q", "5"]).label).toBe("Bust");
    expect(evaluateHand(["A", "K"], true).naturalBlackjack).toBe(false);
  });
});
