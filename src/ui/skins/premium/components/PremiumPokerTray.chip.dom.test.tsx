/**
 * @vitest-environment happy-dom
 *
 * Regression: clicking the tray chip labelled "5" must send raise-to 20, not denomination 5.
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MemberView, PokerTableView } from "@/application/queries/views";
import { PremiumPokerDealer } from "./PremiumPokerDealer";
import { PremiumPokerPlayer } from "./PremiumPokerPlayer";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

const members: MemberView[] = [
  {
    userId: "owner",
    name: "xklondon",
    email: "x@t.test",
    isOwner: true,
    isBankDealer: true,
    available: money("99"),
  },
  {
    userId: "sam",
    name: "Sam",
    email: "s@t.test",
    isOwner: false,
    isBankDealer: false,
    available: money("90"),
  },
];

function seat(
  userId: string,
  name: string,
  orderIndex: number,
  o: Partial<PokerTableView["seats"][number]> = {},
): PokerTableView["seats"][number] {
  return {
    userId,
    name,
    available: money("99"),
    contribution: money("1"),
    streetContribution: money("1"),
    toCall: money("0", "0"),
    status: "ACTIVE",
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    isActor: false,
    sittingOut: false,
    orderIndex,
    hasHoleCards: false,
    holeCards: null,
    ...o,
  };
}

function actingView(role: "POKER_DEALER" | "POKER_PLAYER", viewerId: string): PokerTableView {
  return {
    role,
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "",
    tableName: "SMOKE",
    copy: "",
    isOwner: viewerId === "owner",
    pot: money("15"),
    potPaid: false,
    toCall: money("10"),
    contribution: money("5"),
    available: money("95"),
    smallBlind: money("5"),
    bigBlind: money("10"),
    streetWager: money("10"),
    viewerStatus: "ACTIVE",
    seats: [
      seat("owner", "xklondon", 0, {
        isActor: viewerId === "owner",
        isDealer: true,
        isSmallBlind: true,
        streetContribution: money("5"),
        available: money("95"),
      }),
      seat("sam", "Sam", 1, {
        isActor: viewerId === "sam",
        isBigBlind: true,
        streetContribution: money("10"),
        available: money("90"),
      }),
    ],
    pots: [],
    legalActions: [
      { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
      { type: "CALL", amount: money("5"), label: "CALL 5" },
      { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE" },
      { type: "ALL_IN", amount: money("95"), label: "ALL IN 95" },
    ],
    currentActorName: viewerId === "owner" ? "xklondon" : "Sam",
    currentActorId: viewerId,
    waitingCopy: "YOUR TURN",
    winners: [],
    canDealStreet: false,
    nextStreetLabel: "DEAL FLOP",
    canAward: false,
    canNextHand: false,
    canScheduleNextHand: false,
    nextHandDeadlineAt: null,
    canSwitchGame: true,
    switchBlockedReason: null,
    canAddPlayer: true,
    canGiveJetons: true,
    canReorderSeats: false,
    streetComplete: false,
    allInRunout: false,
    turnNumber: 1,
    handNumber: 1,
    viewerId,
    communityCards: [],
    canEditCommunity: false,
    canEditHole: false,
    streetRail: [],
  };
}

function waitingView(role: "POKER_DEALER" | "POKER_PLAYER", viewerId: string, actorId: string): PokerTableView {
  return {
    ...actingView(role, viewerId),
    currentActorId: actorId,
    currentActorName: actorId === "owner" ? "xklondon" : "Sam",
    waitingCopy: `Waiting for ${actorId === "owner" ? "xklondon" : "Sam"}`,
    legalActions: [],
    seats: actingView(role, viewerId).seats.map((s) => ({
      ...s,
      isActor: s.userId === actorId,
    })),
  };
}

describe("Premium Poker tray chip click → pokerAct raise-to", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
  });

  afterEach(() => {
    root.unmount();
    host.remove();
  });

  async function flush() {
    await new Promise((r) => setTimeout(r, 0));
  }

  async function assertDealerTrayDom() {
    const shell = host.querySelector('[data-table-board="POKER_DEALER"]');
    const consoleEl = host.querySelector(".pm-console.has-visible-tray");
    const tray = host.querySelector('[data-jeton-tray="true"]');
    const chips = host.querySelectorAll('[data-casino-jeton="true"]');
    const avail = host.textContent?.match(/AVAILABLE/g) ?? [];

    expect(shell).toBeTruthy();
    expect(consoleEl).toBeTruthy();
    expect(tray).toBeTruthy();
    expect(chips.length).toBeGreaterThanOrEqual(5);
    expect(avail.length).toBe(1);
    expect(host.querySelector('[data-street-wager="true"]')).toBeNull();
    expect(host.querySelector('[data-pot-chips="true"]')).toBeTruthy();
  }

  it("dealer acting DOM includes tray chips + single AVAILABLE @390", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    root.render(
      createElement(PremiumPokerDealer, {
        view: actingView("POKER_DEALER", "owner"),
        members,
        onCommand: () => undefined,
      }),
    );
    await flush();
    await assertDealerTrayDom();
  });

  it("dealer acting DOM includes tray chips + single AVAILABLE @1280", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    root.render(
      createElement(PremiumPokerDealer, {
        view: actingView("POKER_DEALER", "owner"),
        members,
        onCommand: () => undefined,
      }),
    );
    await flush();
    await assertDealerTrayDom();
  });

  it("dealer: chip labelled 5 sends RAISE amount 20 (raise-to), not 5", async () => {
    const calls: { command: string; payload: Record<string, string> }[] = [];
    root.render(
      createElement(PremiumPokerDealer, {
        view: actingView("POKER_DEALER", "owner"),
        members,
        onCommand: (command, payload = {}) => {
          calls.push({ command, payload });
        },
      }),
    );
    await flush();

    const chip5 = host.querySelector('button[aria-label="Add 5 jetons"]') as HTMLButtonElement | null;
    expect(chip5).toBeTruthy();
    expect(chip5!.disabled).toBe(false);
    chip5!.click();
    await flush();

    expect(calls).toEqual([{ command: "pokerAct", payload: { type: "RAISE", amount: "20" } }]);
  });

  it("player: chip labelled 5 sends RAISE amount 20 (raise-to), not 5", async () => {
    const calls: { command: string; payload: Record<string, string> }[] = [];
    root.render(
      createElement(PremiumPokerPlayer, {
        view: actingView("POKER_PLAYER", "sam"),
        onCommand: (command, payload = {}) => {
          calls.push({ command, payload });
        },
      }),
    );
    await flush();

    const chip5 = host.querySelector('button[aria-label="Add 5 jetons"]') as HTMLButtonElement | null;
    expect(chip5).toBeTruthy();
    expect(chip5!.disabled).toBe(false);
    chip5!.click();
    await flush();

    expect(calls).toEqual([{ command: "pokerAct", payload: { type: "RAISE", amount: "20" } }]);
  });

  it("waiting dealer cannot submit a raise from the tray", async () => {
    const calls: { command: string; payload: Record<string, string> }[] = [];
    root.render(
      createElement(PremiumPokerDealer, {
        view: waitingView("POKER_DEALER", "owner", "sam"),
        members,
        onCommand: (command, payload = {}) => {
          calls.push({ command, payload });
        },
      }),
    );
    await flush();

    const chip5 = host.querySelector('button[aria-label="Add 5 jetons"]') as HTMLButtonElement | null;
    expect(chip5).toBeTruthy();
    expect(chip5!.disabled).toBe(true);
    chip5!.click();
    await flush();
    expect(calls).toEqual([]);
  });

  it("waiting player cannot submit a raise from the tray", async () => {
    const calls: { command: string; payload: Record<string, string> }[] = [];
    root.render(
      createElement(PremiumPokerPlayer, {
        view: waitingView("POKER_PLAYER", "sam", "owner"),
        onCommand: (command, payload = {}) => {
          calls.push({ command, payload });
        },
      }),
    );
    await flush();

    const chip5 = host.querySelector('button[aria-label="Add 5 jetons"]') as HTMLButtonElement | null;
    expect(chip5).toBeTruthy();
    expect(chip5!.disabled).toBe(true);
    chip5!.click();
    await flush();
    expect(calls).toEqual([]);
  });
});
