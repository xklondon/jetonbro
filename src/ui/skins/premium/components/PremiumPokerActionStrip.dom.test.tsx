/**
 * @vitest-environment happy-dom
 * Compact action strip: TO CALL + turn status one row; Fold/Call/Raise present.
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
    available: money("195"),
  },
  {
    userId: "p1",
    name: "Vi",
    email: "v@t.test",
    isOwner: false,
    isBankDealer: false,
    available: money("190"),
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

function view(role: "POKER_DEALER" | "POKER_PLAYER", viewerId: string, actorId: string): PokerTableView {
  return {
    role,
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "",
    tableName: "STRIP",
    copy: "",
    isOwner: viewerId === "owner",
    pot: money("15"),
    potPaid: false,
    toCall: money("5"),
    contribution: money("5"),
    available: money("195"),
    smallBlind: money("5"),
    bigBlind: money("10"),
    streetWager: money("10"),
    viewerStatus: "ACTIVE",
    seats: [
      seat("owner", "Bank", 0, {
        isDealer: true,
        isSmallBlind: true,
        isActor: actorId === "owner",
        streetContribution: money("5"),
        available: money("195"),
      }),
      seat("p1", "Vi", 1, {
        isBigBlind: true,
        isActor: actorId === "p1",
        streetContribution: money("10"),
        available: money("190"),
      }),
    ],
    pots: [],
    legalActions:
      actorId === viewerId
        ? [
            { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
            { type: "CALL", amount: money("5"), label: "CALL 5" },
            { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE" },
          ]
        : [],
    currentActorName: actorId === "owner" ? "Bank" : "Vi",
    currentActorId: actorId,
    waitingCopy: actorId === viewerId ? "YOUR TURN" : `Waiting for ${actorId === "owner" ? "Bank" : "Vi"}`,
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
  };
}

describe("Premium Poker action strip", () => {
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

  it("acting dealer: strip head aligns TO CALL + YOUR TURN above Fold/Call/Raise", async () => {
    root.render(
      createElement(PremiumPokerDealer, {
        view: view("POKER_DEALER", "owner", "owner"),
        members,
        onCommand: () => undefined,
      }),
    );
    await flush();
    expect(host.querySelector("[data-poker-action-bar]")).toBeTruthy();
    expect(host.querySelector("[data-poker-wallet-stack]")).toBeTruthy();
    expect(host.querySelector("[data-action-strip-head]")).toBeTruthy();
    expect(host.querySelector("[data-to-call]")?.textContent).toMatch(/TO CALL/);
    expect(host.querySelector("[data-to-call]")?.textContent).toMatch(/5/);
    expect(host.querySelector("[data-poker-turn-hint]")?.textContent).toMatch(/YOUR TURN/i);
    expect(host.querySelector("[data-console-actions]")?.textContent).toMatch(/FOLD/);
    expect(host.querySelector("[data-console-actions]")?.textContent).toMatch(/CALL 5/);
    expect(host.querySelector("[data-console-actions]")?.textContent).toMatch(/RAISE/);
    expect(host.querySelector("[data-jeton-tray]")).toBeTruthy();
    expect(host.querySelector(".pm-console-notice [data-poker-turn-hint]")).toBeNull();
  });

  it("waiting player: action bar shows turn status above jetons, no YOUR TURN", async () => {
    root.render(
      createElement(PremiumPokerPlayer, {
        view: view("POKER_PLAYER", "p1", "owner"),
        onCommand: () => undefined,
      }),
    );
    await flush();
    expect(host.querySelector("[data-poker-action-bar].is-status-only")).toBeTruthy();
    expect(host.querySelector("[data-poker-turn-hint]")?.textContent).toMatch(/TURN/i);
    expect(host.querySelector("[data-poker-turn-hint]")?.textContent).not.toMatch(/YOUR TURN/i);
    expect(host.querySelector("[data-jeton-tray]")).toBeTruthy();
  });

  it("both roles open hole card entry from menu", async () => {
    root.render(
      createElement(PremiumPokerPlayer, {
        view: view("POKER_PLAYER", "p1", "p1"),
        onCommand: () => undefined,
      }),
    );
    await flush();
    (host.querySelector('button[aria-label="Menu"]') as HTMLButtonElement).click();
    await flush();
    expect(host.querySelector("[data-poker-card-tools]")).toBeTruthy();
    (host.querySelector("[data-edit-hole]") as HTMLButtonElement).click();
    await flush();
    expect(host.querySelector('[data-poker-card-sheet="Hole cards"]')).toBeTruthy();
  });
});
