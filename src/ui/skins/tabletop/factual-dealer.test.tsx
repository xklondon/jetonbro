import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BankTableView, BoxView, MemberView } from "@/application/queries/views";
import { BlackjackDealerTable, seatedPlayers } from "./components/BlackjackDealerTable";
import { PlayerTable } from "./components/PlayerTable";
import { WaitingTable } from "./components/WaitingTable";

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
  return renderToStaticMarkup(
    createElement(BlackjackDealerTable, { view, members, onCommand: noop }),
  );
}

function hasMainBet(markup: string, label: string) {
  return new RegExp(`data-field="main-bet"[\\s\\S]*?<small>MAIN</small>\\s*${label}`).test(markup);
}

describe("factual Dealer ledger rows + BlackjackTableSurface", () => {
  it("TABLE_SETUP with no Player: zero rows, Invite copy, START BETTING disabled", () => {
    const view = bank();
    expect(seatedPlayers(view)).toHaveLength(0);
    const markup = html(view);
    expect(markup).toContain('data-blackjack-table-surface="true"');
    expect(markup).toContain('data-felt-name="true"');
    expect(markup).toContain('data-seated-player-count="0"');
    expect(markup).toContain('data-ledger-row-count="0"');
    expect(markup).toContain('data-dealer-empty="true"');
    expect(markup).toContain("Invite a Player to begin.");
    expect(markup).not.toContain("Waiting for Players");
    expect(markup.match(/data-blackjack-box-row="true"/g)).toBeNull();
    expect(markup).toMatch(/disabled[^>]*>START BETTING/);
    expect(markup).not.toContain('data-table-cloth="true"');
    expect(markup).not.toContain("tt-ledger-wrap");
  });

  it("pending invite is not rendered as a joined Player", () => {
    const markup = html(bank({ invitations: [{ id: "inv1", kind: "EMAIL", email: "pending@x.io", pending: true }] }));
    expect(markup).not.toContain("pending@x.io");
    expect(markup).toContain("Invite a Player to begin.");
  });

  it("Dealer-only identity is not a Player row", () => {
    const markup = html(bank());
    expect(markup).not.toContain('data-membership-id="d1"');
  });

  it("TABLE_SETUP with one joined Player: AVAILABLE 100, READY, no MAIN BET / Waiting", () => {
    const view = bank({
      players: [{ userId: "p1", name: "Casey", available: money("100"), locked: money("0"), status: "Waiting", boxes: [] }],
      playerCount: 1,
      primaryAction: { id: "nextHand", label: "START BETTING", enabled: true },
      canStartBetting: true,
      actions: { ...bank().actions, nextHand: true },
    });
    expect(seatedPlayers(view)).toHaveLength(1);
    const markup = html(view);
    expect(markup).toContain('data-seated-player-count="1"');
    expect(markup).toContain('data-ledger-row-count="1"');
    expect(markup).toContain('data-membership-id="p1"');
    expect(markup).toContain('data-status="READY"');
    expect(markup).toContain("READY");
    expect(markup).toContain("Ready to open betting.");
    expect(markup.match(/data-blackjack-box-row="true"/g)?.length).toBe(1);
    expect(markup).toContain("Casey");
    expect(markup).toContain('data-field="available"');
    expect(markup).toMatch(/data-field="available"[^>]*>[\s\S]*?>100</);
    expect(markup).not.toContain("MAIN BET");
    expect(markup).not.toContain('data-field="main-bet"');
    expect(markup).not.toContain(">Waiting<");
    expect(markup).not.toContain("Waiting for Players");
    expect(markup).not.toMatch(/disabled[^>]*>START BETTING/);
  });

  it("BETTING before wager: MAIN 0 / NO BET with available distinct", () => {
    const b1 = box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey", bet: money("0", "0") });
    const markup = html(
      bank({
        phase: "BETTING",
        boxes: [b1],
        players: [{ userId: "p1", name: "Casey", available: money("100"), locked: money("0"), status: "", boxes: [b1] }],
        playerCount: 1,
        boxCount: 1,
        primaryAction: { id: "dealCards", label: "DEAL CARDS", enabled: false },
        actions: { ...bank().actions, dealCards: false, addPlayer: true, nextHand: false },
      }),
    );
    expect(markup.match(/data-blackjack-box-row="true"/g)?.length).toBe(1);
    expect(hasMainBet(markup, "0")).toBe(true);
    expect(hasMainBet(markup, "100")).toBe(false);
    expect(markup).toContain("NO BET");
    expect(markup).toContain('data-available="100"');
    expect(markup).toMatch(/data-field="available"[^>]*>100</);
    expect(markup).toContain('data-blackjack-table-surface="true"');
  });

  it("BETTING after wager 25: MAIN 25, available 75, never swapped", () => {
    const b1 = box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey", bet: money("25") });
    const markup = html(
      bank({
        phase: "BETTING",
        boxes: [b1],
        players: [{ userId: "p1", name: "Casey", available: money("75"), locked: money("25"), status: "", boxes: [b1] }],
        playerCount: 1,
        boxCount: 1,
        primaryAction: { id: "dealCards", label: "DEAL CARDS", enabled: true },
        actions: { ...bank().actions, dealCards: true, addPlayer: true, nextHand: false },
      }),
    );
    expect(hasMainBet(markup, "25")).toBe(true);
    expect(hasMainBet(markup, "75")).toBe(false);
    expect(markup).toContain("WAGERED");
    expect(markup).toContain('data-available="75"');
    expect(markup).toMatch(/data-field="available"[^>]*>75</);
    expect(markup).not.toMatch(/data-field="status"[^>]*>[\s\S]*75/);
  });

  it("one Player with two boxes: exactly two box-instance rows", () => {
    const b1 = box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey", bet: money("25") });
    const b2 = box({ id: "b2", boxNumber: 2, playerId: "p1", playerName: "Casey", bet: money("10") });
    const view = bank({
      phase: "BETTING",
      boxes: [b1, b2],
      players: [{ userId: "p1", name: "Casey", available: money("65"), locked: money("35"), status: "", boxes: [b1, b2] }],
      playerCount: 1,
      boxCount: 2,
      primaryAction: { id: "dealCards", label: "DEAL CARDS", enabled: true },
      actions: { ...bank().actions, dealCards: true, addPlayer: true, nextHand: false },
    });
    const markup = html(view);
    expect(markup.match(/data-blackjack-box-row="true"/g)?.length).toBe(2);
    expect(markup).toContain('data-box-id="b1"');
    expect(markup).toContain('data-box-id="b2"');
    expect(markup).toContain("MAIN");
    expect(markup).toContain("WAGERED");
  });

  it("payout controls are one DOM row and map to existing outcomes", () => {
    const b1 = box({ id: "b1", boxNumber: 1, playerId: "p1", playerName: "Casey" });
    const view = bank({
      phase: "PAYOUT",
      boxes: [b1],
      players: [{ userId: "p1", name: "Casey", available: money("75"), locked: money("25"), status: "", boxes: [b1] }],
      playerCount: 1,
      boxCount: 1,
      primaryAction: { id: "nextHand", label: "START BETTING", enabled: false },
      actions: { ...bank().actions, settleBoxes: true, nextHand: false },
    });
    const markup = html(view);
    expect(markup).toContain('data-payout-rail="row"');
    expect(markup).toContain('data-outcome="LOST"');
    expect(markup).toContain('data-outcome="PUSH"');
    expect(markup).toContain('data-outcome="BLACKJACK"');
    expect(markup).toContain('data-outcome="WON"');
    expect(markup).toContain(">LOST<");
    expect(markup).toContain(">TIE<");
    expect(markup).toContain(">BJ<");
    expect(markup).toContain(">WIN<");
    expect(markup).toContain("Set Box 1 result: Stand-off");
    expect(markup).toContain('data-blackjack-table-surface="true"');
  });

  it("resolved payout replaces controls with a result badge", () => {
    const b1 = box({
      id: "b1",
      boxNumber: 1,
      playerId: "p1",
      playerName: "Casey",
      outcome: "WON",
      returned: money("50"),
    });
    const markup = html(
      bank({
        phase: "PAYOUT",
        boxes: [b1],
        players: [{ userId: "p1", name: "Casey", available: money("125"), locked: money("0"), status: "", boxes: [b1] }],
        playerCount: 1,
        boxCount: 1,
        primaryAction: { id: "nextHand", label: "START BETTING", enabled: true },
        actions: { ...bank().actions, nextHand: true },
      }),
    );
    expect(markup).toContain('data-box-result="WON"');
    expect(markup).not.toContain("data-payout-action");
  });

  it("Player Waiting and PlayerTable mount the same BlackjackTableSurface", () => {
    const waiting = renderToStaticMarkup(
      createElement(WaitingTable, {
        view: {
          role: "WAITING",
          phase: "TABLE_SETUP",
          tableName: "Salon",
          game: "Blackjack",
          available: money("100"),
          copy: "",
        },
      }),
    );
    expect(waiting).toContain('data-blackjack-table-surface="true"');
    expect(waiting).toContain('data-felt-name="true"');
    expect(waiting).toContain("Waiting for the Dealer to open betting.");
    expect(waiting).not.toContain('data-table-cloth="true"');

    const player = renderToStaticMarkup(
      createElement(PlayerTable, {
        view: {
          role: "PLAYER",
          phase: "BETTING",
          tableName: "Salon",
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
        },
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
        onCommand: noop,
      }),
    );
    expect(player).toContain('data-blackjack-table-surface="true"');
    expect(player).toContain('data-bj-anatomy="player"');
    expect(player).toContain('data-dealer-slot="true"');
  });
});
