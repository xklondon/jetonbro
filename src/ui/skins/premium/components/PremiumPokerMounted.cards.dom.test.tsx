/**
 * @vitest-environment happy-dom
 *
 * Canonical mount: /tables/[tableId] → TableSession → PremiumPokerDealer|Player.
 * Tray stays through setup + active hand; hole entry for player and seated dealer.
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
    name: "Bank",
    email: "b@t.test",
    isOwner: true,
    isBankDealer: true,
    available: money("100"),
  },
  {
    userId: "p1",
    name: "Vi",
    email: "v@t.test",
    isOwner: false,
    isBankDealer: false,
    available: money("100"),
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
    available: money("100"),
    contribution: money("0", "0"),
    streetContribution: money("0", "0"),
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

function baseView(role: "POKER_DEALER" | "POKER_PLAYER", viewerId: string, extra: Partial<PokerTableView> = {}): PokerTableView {
  return {
    role,
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "",
    tableName: "WALNUT ROOM",
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
      seat("owner", "Bank", 0, {
        isDealer: true,
        isSmallBlind: true,
        streetContribution: money("5"),
        available: money("95"),
        isActor: viewerId === "owner",
      }),
      seat("p1", "Vi", 1, {
        isBigBlind: true,
        streetContribution: money("10"),
        available: money("90"),
        isActor: viewerId === "p1",
      }),
    ],
    pots: [],
    legalActions: [
      { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
      { type: "CALL", amount: money("5"), label: "CALL 5" },
      { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE" },
    ],
    currentActorName: viewerId === "owner" ? "Bank" : "Vi",
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
    canEditHole: true,
    streetRail: [],
    ...extra,
  };
}

describe("Premium Poker mounted tray + card entry", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    root.unmount();
    host.remove();
  });

  async function flush() {
    await new Promise((r) => setTimeout(r, 0));
  }

  it("setup dealer keeps integrated tray with AVAILABLE beside chips", async () => {
    root.render(
      createElement(PremiumPokerDealer, {
        view: baseView("POKER_DEALER", "owner", {
          phase: "POKER_SETUP",
          pot: money("0", "0"),
          legalActions: [],
          currentActorId: null,
          canEditHole: false,
          seats: [
            seat("owner", "Bank", 0, { status: "WAITING" }),
            seat("p1", "Vi", 1, { status: "WAITING" }),
          ],
        }),
        members,
        onCommand: () => undefined,
      }),
    );
    await flush();
    expect(host.querySelector('[data-table-board="POKER_DEALER"]')).toBeTruthy();
    expect(host.querySelector('[data-jeton-tray="true"]')).toBeTruthy();
    expect(host.querySelector('[data-tray-available="true"]')).toBeTruthy();
    expect(host.querySelectorAll('[data-casino-jeton="true"]').length).toBeGreaterThanOrEqual(5);
    expect(host.textContent).toContain("AVAILABLE");
    expect(host.querySelector('[data-pot-chips="true"]')).toBeNull();
  });

  it("active hand shows pot cluster + POT and stable tray for dealer and player", async () => {
    root.render(
      createElement(PremiumPokerDealer, {
        view: baseView("POKER_DEALER", "owner"),
        members,
        onCommand: () => undefined,
      }),
    );
    await flush();
    expect(host.querySelector('[data-pot-chips="true"]')).toBeTruthy();
    expect(host.querySelector('[data-pot-amount="15"]')).toBeTruthy();
    expect(host.querySelector('[data-jeton-tray="true"]')).toBeTruthy();
    expect(host.querySelector('[data-tray-available="true"]')).toBeTruthy();

    root.render(
      createElement(PremiumPokerPlayer, {
        view: baseView("POKER_PLAYER", "p1"),
        onCommand: () => undefined,
      }),
    );
    await flush();
    expect(host.querySelector('[data-table-board="POKER_PLAYER"]')).toBeTruthy();
    expect(host.querySelector('[data-pot-amount="15"]')).toBeTruthy();
    expect(host.querySelector('[data-jeton-tray="true"]')).toBeTruthy();
    expect(host.querySelector('[data-tray-available="true"]')).toBeTruthy();
  });

  it("seated dealer opens hole-card sheet and saves via setPokerHoleCards", async () => {
    const commands: { command: string; payload: Record<string, string> }[] = [];
    root.render(
      createElement(PremiumPokerDealer, {
        view: baseView("POKER_DEALER", "owner", { canEditHole: true, canEditCommunity: false }),
        members,
        onCommand: (command, payload = {}) => {
          commands.push({ command, payload });
          return undefined;
        },
      }),
    );
    await flush();
    const menu = host.querySelector('button[aria-label="Menu"]') as HTMLButtonElement | null;
    expect(menu).toBeTruthy();
    expect(menu?.disabled).toBe(false);
    menu!.click();
    await flush();
    expect(host.querySelector('[data-poker-card-tools="true"]')).toBeTruthy();
    (host.querySelector('[data-edit-hole="true"]') as HTMLButtonElement).click();
    await flush();
    expect(host.querySelector('[data-poker-card-sheet="Hole cards"]')).toBeTruthy();
    (host.querySelector('[data-card-save="true"]') as HTMLButtonElement).click();
    await flush();
    expect(commands.some((c) => c.command === "setPokerHoleCards")).toBe(true);
  });

  it("player opens hole-card sheet; own hole visible, opponent faces hidden", async () => {
    const commands: { command: string; payload: Record<string, string> }[] = [];
    root.render(
      createElement(PremiumPokerPlayer, {
        view: baseView("POKER_PLAYER", "p1", {
          canEditHole: true,
          seats: [
            seat("owner", "Bank", 0, {
              isDealer: true,
              isSmallBlind: true,
              hasHoleCards: true,
              holeCards: null,
            }),
            seat("p1", "Vi", 1, {
              isActor: true,
              isBigBlind: true,
              hasHoleCards: true,
              holeCards: [
                { rank: "A", suit: "S", label: "A♠" },
                { rank: "K", suit: "H", label: "K♥" },
              ],
            }),
          ],
        }),
        onCommand: (command, payload = {}) => {
          commands.push({ command, payload });
          return undefined;
        },
      }),
    );
    await flush();
    expect(host.querySelector('[data-hole-cards="true"]')).toBeTruthy();
    expect(host.querySelector('[data-poker-card="AS"]')).toBeTruthy();
    expect(host.querySelector('[data-hole-cards="hidden"]')).toBeTruthy();
    (host.querySelector('button[aria-label="Menu"]') as HTMLButtonElement).click();
    await flush();
    (host.querySelector('[data-edit-hole="true"]') as HTMLButtonElement).click();
    await flush();
    expect(host.querySelector('[data-poker-card-sheet="Hole cards"]')).toBeTruthy();
    (host.querySelector('[data-card-save="true"]') as HTMLButtonElement).click();
    await flush();
    expect(commands.some((c) => c.command === "setPokerHoleCards")).toBe(true);
  });

  it("owner can open board-card sheet on FLOP", async () => {
    const commands: { command: string; payload: Record<string, string> }[] = [];
    root.render(
      createElement(PremiumPokerDealer, {
        view: baseView("POKER_DEALER", "owner", {
          phase: "FLOP",
          canEditHole: true,
          canEditCommunity: true,
          legalActions: [],
          currentActorId: null,
        }),
        members,
        onCommand: (command, payload = {}) => {
          commands.push({ command, payload });
          return undefined;
        },
      }),
    );
    await flush();
    (host.querySelector('button[aria-label="Menu"]') as HTMLButtonElement).click();
    await flush();
    (host.querySelector('[data-edit-board="true"]') as HTMLButtonElement).click();
    await flush();
    expect(host.querySelector('[data-poker-card-sheet="Board cards"]')).toBeTruthy();
    (host.querySelector('[data-card-save="true"]') as HTMLButtonElement).click();
    await flush();
    expect(commands.some((c) => c.command === "setPokerCommunityCards")).toBe(true);
  });
});
