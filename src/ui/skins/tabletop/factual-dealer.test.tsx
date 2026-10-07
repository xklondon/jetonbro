import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BankTableView, BoxView, MemberView, PlayerTableView } from "@/application/queries/views";
import { BlackjackDealerTable, seatedPlayers } from "./components/BlackjackDealerTable";
import { PlayerTable } from "./components/PlayerTable";
import { WaitingTable } from "./components/WaitingTable";
import { orderBoxesNewestLeft } from "./components/primitives/BlackjackBoxStage";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });
const noop = async () => undefined;

const members: MemberView[] = [
  { userId: "d1", name: "Dee", email: "d@x.io", isOwner: true, isBankDealer: true, available: money("0") },
  { userId: "p1", name: "Casey", email: "c@x.io", isOwner: false, isBankDealer: false, available: money("100") },
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
    payoutActions: [],
    hand: { ranks: [], complete: false, label: "", suggestedOutcome: null, canEdit: false },
    ...overrides,
  };
}

function bank(extra: Partial<BankTableView> = {}): BankTableView {
  return {
    role: "BANK",
    phase: "TABLE_SETUP",
    tableName: "Salon",
    title: "Table setup",
    copy: "Invite a Player to begin.",
    phaseLabel: "TABLE SETUP",
    primaryAction: { id: "nextHand", label: "START BETTING", enabled: false },
    boxes: [],
    players: [],
    playerCount: 0,
    boxCount: 0,
    lockedOrdinary: money("0"),
    insurance: { window: "CLOSED", total: money("0"), count: 0, resolution: null },
    actions: {
      dealCards: false,
      scheduleDeal: false,
      payoutPhase: false,
      nextHand: false,
      scheduleNextRound: false,
      openInsurance: false,
      closeInsurance: false,
      settleBoxes: false,
      settleDealerWon: false,
      settleInsurance: false,
      addPlayer: true,
      giveJetons: false,
      changeBank: true,
      saveTable: true,
      closeTable: true,
      switchGame: true,
    },
    insuranceSettleActions: [],
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    hasValidBet: false,
    isOwner: true,
    tableStatus: "SETUP",
    paused: false,
    closePreview: null,
    cardAssist: "OFF",
    dealerName: "Dee",
    canSwitchGame: true,
    guestJoinUrl: "/join/guest/x",
    verifiedJoinUrl: "/join/verified/x",
    invitations: [{ id: "inv1", kind: "EMAIL", email: "pending@x.io", pending: true }],
    emailConfigured: true,
    startingJetons: money("100"),
    canStartBetting: false,
    ...extra,
  };
}

function html(view: BankTableView) {
  return renderToStaticMarkup(createElement(BlackjackDealerTable, { view, members, onCommand: noop }));
}

describe("Blackjack table composition — Setup / BoxStage / Payout", () => {
  it("PhaseDisplay stacks title then instruction", () => {
    const markup = html(bank());
    expect(markup).toContain('data-phase-stack="true"');
    expect(markup).toMatch(/data-phase-heading[^>]*>TABLE SETUP<\/strong>\s*<em[^>]*>Invite a Player to begin\./);
    expect(markup).not.toMatch(/TABLE SETUP<\/strong>\s*<em[^>]*>Ready/);
  });

  it("TABLE_SETUP empty: zero rows, Invite copy, START BETTING disabled", () => {
    const markup = html(bank());
    expect(seatedPlayers(bank())).toHaveLength(0);
    expect(markup).toContain('data-blackjack-table-surface="true"');
    expect(markup).toContain('data-felt-markings="true"');
    expect(markup).toContain('data-felt-name="true"');
    expect(markup).toContain('data-dealer-empty="true"');
    expect(markup).toContain("Invite a Player to begin.");
    expect(markup.match(/data-blackjack-box-row="true"/g)).toBeNull();
    expect(markup).toMatch(/disabled[^>]*>START BETTING/);
    expect(markup).not.toContain("READY");
    expect(markup).not.toContain("tt-bj-overlay-row");
  });

  it("TABLE_SETUP joined: PLAYER JOINED, available jetons, no READY / MAIN BET", () => {
    const view = bank({
      players: [{ userId: "p1", name: "Casey", available: money("100"), locked: money("0"), status: "Waiting", boxes: [] }],
      playerCount: 1,
      primaryAction: { id: "nextHand", label: "START BETTING", enabled: true },
      canStartBetting: true,
      actions: { ...bank().actions, nextHand: true },
    });
    const markup = html(view);
    expect(markup).toContain('data-status="PLAYER_JOINED"');
    expect(markup).toContain("PLAYER JOINED");
    expect(markup).toContain("100 jetons");
    expect(markup).toContain("Casey");
    expect(markup).toContain("Ready to open betting.");
    expect(markup).not.toContain("READY");
    expect(markup).not.toContain("MAIN BET");
    expect(markup).not.toContain('data-field="main-bet"');
    expect(markup).not.toContain("tt-bj-overlay-row");
    expect(markup).not.toContain('data-box-stage="true"');
  });

  it("BETTING / PLAYING use BlackjackBoxStage, not DealerLedgerRow", () => {
    const b1 = box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey", bet: money("25") });
    for (const phase of ["BETTING", "PLAYING"] as const) {
      const markup = html(
        bank({
          phase,
          boxes: [b1],
          players: [{ userId: "p1", name: "Casey", available: money("75"), locked: money("25"), status: "", boxes: [b1] }],
          playerCount: 1,
          boxCount: 1,
          primaryAction:
            phase === "BETTING"
              ? { id: "dealCards", label: "DEAL CARDS", enabled: true }
              : { id: "payoutPhase", label: "ENTER PAYOUT", enabled: true },
          actions: {
            ...bank().actions,
            dealCards: phase === "BETTING",
            payoutPhase: phase === "PLAYING",
            nextHand: false,
          },
        }),
      );
      expect(markup).toContain('data-box-stage="true"');
      expect(markup).toContain('data-order="newest-left"');
      expect(markup).toContain("tt-pbox");
      expect(markup).not.toContain("tt-bj-overlay-row");
      expect(markup).not.toContain("data-payout-rail");
      if (phase === "BETTING") expect(markup).toContain("Players place their bets.");
      if (phase === "PLAYING") expect(markup).toContain("Play the hands.");
    }
  });

  it("PAYOUT uses settlement bars with one horizontal LOST|TIE|BJ|WIN row", () => {
    const b1 = box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey" });
    const markup = html(
      bank({
        phase: "PAYOUT",
        boxes: [b1],
        players: [{ userId: "p1", name: "Casey", available: money("75"), locked: money("25"), status: "", boxes: [b1] }],
        playerCount: 1,
        boxCount: 1,
        primaryAction: { id: "nextHand", label: "START BETTING", enabled: false },
        actions: { ...bank().actions, settleBoxes: true, nextHand: false },
      }),
    );
    expect(markup).toContain('data-bj-layout="payout"');
    expect(markup).toContain("tt-bj-overlay-row");
    expect(markup).toContain('data-payout-rail="row"');
    expect(markup).toContain(">LOST<");
    expect(markup).toContain(">TIE<");
    expect(markup).toContain(">BJ<");
    expect(markup).toContain(">WIN<");
    expect(markup).toContain("Settle each box.");
    expect(markup).not.toContain('data-box-stage="true"');
  });

  it("orders boxes newest-left with Box 1 as rightmost anchor", () => {
    const ordered = orderBoxesNewestLeft([
      box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey" }),
      box({ id: "b2", boxNumber: 2, playerId: "p1", playerName: "Casey" }),
      box({ id: "b3", boxNumber: 3, playerId: "p1", playerName: "Casey" }),
    ]);
    expect(ordered.map((b) => b.boxNumber)).toEqual([3, 2, 1]);

    const markup = html(
      bank({
        phase: "BETTING",
        boxes: ordered,
        players: [
          {
            userId: "p1",
            name: "Casey",
            available: money("40"),
            locked: money("60"),
            status: "",
            boxes: ordered,
          },
        ],
        playerCount: 1,
        boxCount: 3,
        primaryAction: { id: "dealCards", label: "DEAL CARDS", enabled: true },
        actions: { ...bank().actions, dealCards: true, nextHand: false },
      }),
    );
    const slots = [...markup.matchAll(/data-box-slot="(\d+)"/g)].map((m) => m[1]);
    expect(slots).toEqual(["3", "2", "1"]);
  });

  it("table name is present without ellipsis CSS contract and Player shares surface", () => {
    const longName = "XKLONDON'S TABLE";
    const markup = html(bank({ tableName: longName }));
    expect(markup).toContain('data-table-name="');
    expect(markup).toContain("XKLONDON");
    expect(markup).toContain("TABLE");
    expect(markup).not.toContain("…");
    expect(markup).not.toMatch(/XKLONDON[^<]{0,20}\.\.\./);

    const player = renderToStaticMarkup(
      createElement(PlayerTable, {
        view: {
          role: "PLAYER",
          phase: "BETTING",
          tableName: longName,
          title: "",
          copy: "",
          available: money("75"),
          boxes: [box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey" })],
          insuranceWindowOpen: false,
          bettingCloseDeadlineAt: null,
          nextRoundDeadlineAt: null,
          actions: { bet: true, retract: true, addBox: true, removeEmptyBox: false, double: false, split: false, insurance: false },
          isOwner: false,
          bankLimitReached: false,
          canSwitchGame: false,
          closePreview: null,
          gameSession: null,
        } satisfies PlayerTableView,
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
        onCommand: noop,
      }),
    );
    expect(player).toContain('data-blackjack-table-surface="true"');
    expect(player).toContain('data-box-stage="true"');
    expect(player).toContain("Place your bets.");
    expect(player).toContain("XKLONDON");
    expect(player).toContain('data-table-name="');

    const waiting = renderToStaticMarkup(
      createElement(WaitingTable, {
        view: {
          role: "WAITING",
          phase: "TABLE_SETUP",
          tableName: longName,
          game: "Blackjack",
          available: money("100"),
          copy: "",
        },
      }),
    );
    expect(waiting).toContain('data-felt-markings="true"');
  });
});
