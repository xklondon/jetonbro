import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BankTableView, BoxView, MemberView } from "@/application/queries/views";
import { BlackjackDealerTable, seatedPlayers } from "./components/BlackjackDealerTable";

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
    copy: "Waiting for Players",
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

describe("factual Dealer ledger rows", () => {
  it("zero memberships: empty state, zero rows, START BETTING disabled", () => {
    const view = bank();
    expect(seatedPlayers(view)).toHaveLength(0);
    const markup = html(view);
    expect(markup).toContain('data-seated-player-count="0"');
    expect(markup).toContain('data-ledger-row-count="0"');
    expect(markup).toContain('data-dealer-empty="true"');
    expect(markup).toContain("No players have joined yet.");
    expect(markup).not.toContain("Open seat");
    expect(markup.match(/data-blackjack-box-row="true"/g)).toBeNull();
    expect(markup).toMatch(/disabled[^>]*>START BETTING/);
    expect(markup).toContain("ADD PLAYER");
    expect(markup).toContain('data-table-cloth="true"');
  });

  it("pending invite is not rendered as a joined Player", () => {
    const markup = html(bank({ invitations: [{ id: "inv1", kind: "EMAIL", email: "pending@x.io", pending: true }] }));
    expect(markup).not.toContain("pending@x.io");
    expect(markup).toContain("No players have joined yet.");
  });

  it("Dealer-only identity is not a Player row", () => {
    const markup = html(bank());
    expect(markup).not.toContain('data-membership-id="d1"');
    expect(markup).toContain("No players have joined yet.");
  });

  it("one joined Player with no boxes yet: exactly one factual membership row", () => {
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
    expect(markup.match(/data-blackjack-box-row="true"/g)?.length).toBe(1);
    expect(markup).toContain("Casey");
    expect(markup).toContain("Joined");
    expect(markup).not.toContain("Open seat");
    expect(markup).not.toContain("No players have joined yet.");
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
    expect(markup).toContain("Wagered");
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
});
