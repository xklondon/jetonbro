import { describe, expect, test } from "vitest";
import { pokerActorActions, pokerActorLayout, pokerComposeBounds, pokerComposeSeed, pokerControlIds, pokerControls, pokerTrayEnabled, visiblePokerLegalActions } from "./poker-controls";
import type { PokerLegalActionView, PokerSeatView, PokerTableView } from "./views";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

const actorLegal: PokerLegalActionView[] = [
  { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
  { type: "CALL", amount: money("10"), label: "CALL 10" },
  { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE" },
  { type: "ALL_IN", amount: money("100"), label: "ALL IN 100" },
];

const checkLegal: PokerLegalActionView[] = [
  { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
  { type: "CHECK", amount: money("0", "0"), label: "CHECK" },
  { type: "BET", amount: money("100"), label: "BET" },
  { type: "ALL_IN", amount: money("100"), label: "ALL IN 100" },
];

const bbOptionLegal: PokerLegalActionView[] = [
  { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
  { type: "CHECK", amount: money("0", "0"), label: "CHECK" },
  { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE" },
  { type: "ALL_IN", amount: money("90"), label: "ALL IN 90" },
];

function seat(overrides: Partial<PokerSeatView>): PokerSeatView {
  return {
    userId: "p",
    name: "P",
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
    orderIndex: 0,
    hasHoleCards: false,
    holeCards: null,
    ...overrides,
  };
}

function view(overrides: Partial<PokerTableView> = {}): PokerTableView {
  return {
    role: "POKER_PLAYER",
    phase: "PRE_FLOP",
    phaseLabel: "PRE-FLOP",
    headline: "Texas Hold’em · PRE-FLOP",
    tableName: "Hold em",
    copy: "YOUR TURN",
    isOwner: false,
    pot: money("15"),
    potPaid: false,
    toCall: money("10"),
    contribution: money("0", "0"),
    available: money("100"),
    smallBlind: money("5"),
    bigBlind: money("10"),
    streetWager: money("10"),
    viewerStatus: "ACTIVE",
    seats: [
      seat({ userId: "owner", name: "Owner", isDealer: true, isActor: true }),
      seat({ userId: "sam", name: "Sam", isSmallBlind: true, orderIndex: 1 }),
    ],
    pots: [],
    legalActions: [],
    currentActorName: "Owner",
    currentActorId: "owner",
    waitingCopy: "Waiting for Owner",
    winners: [],
    canDealStreet: false,
    nextStreetLabel: null,
    canAward: false,
    canNextHand: false,
    canScheduleNextHand: false,
    nextHandDeadlineAt: null,
    canSwitchGame: false,
    switchBlockedReason: null,
    canAddPlayer: false,
    canGiveJetons: false,
    canReorderSeats: false,
    streetComplete: false,
    allInRunout: false,
    turnNumber: 1,
    handNumber: 1,
    viewerId: "sam",
    communityCards: [],
    canEditCommunity: false,
    canEditHole: false,
    streetRail: [],
    ...overrides,
  };
}

test("actor controls keep CALL available and open BET/RAISE separately", () => {
  expect(pokerActorActions(actorLegal).map((action) => action.type)).toEqual(["CALL", "FOLD", "RAISE", "ALL_IN"]);
  expect(pokerActorActions(checkLegal).map((action) => action.type)).toEqual(["CHECK", "BET", "ALL_IN", "FOLD"]);
  const owed = pokerActorLayout(actorLegal);
  expect(owed.primary?.type).toBe("CALL");
  expect(owed.secondary.map((action) => action.type)).toEqual(["FOLD", "RAISE", "ALL_IN"]);
  expect(pokerComposeSeed(view({ legalActions: actorLegal }), "RAISE")).toBe("20");
  expect(pokerComposeSeed(view({ legalActions: checkLegal }), "BET")).toBe("10");
  expect(pokerActorActions(bbOptionLegal).map((action) => action.type)).toEqual(["CHECK", "RAISE", "ALL_IN", "FOLD"]);
  expect(pokerComposeBounds(view({ legalActions: actorLegal }), "RAISE")).toMatchObject({
    convention: "Raise to",
    min: "20",
  });
});

test("folded and all-in players get no actor controls or tray", () => {
  const folded = view({ viewerStatus: "FOLDED", legalActions: [], waitingCopy: "Waiting for Owner" });
  const allIn = view({ viewerStatus: "ALL_IN", legalActions: [], currentActorId: "sam", viewerId: "sam" });
  expect(pokerControlIds(folded, "actor")).toEqual([]);
  expect(pokerControlIds(allIn, "actor")).toEqual([]);
  expect(pokerTrayEnabled(folded)).toBe(false);
  expect(pokerTrayEnabled(allIn)).toBe(false);
  expect(pokerControlIds(folded, "owner")).toEqual([]);
});

test("only the current actor receives betting controls", () => {
  const actor = view({
    viewerId: "owner",
    currentActorId: "owner",
    waitingCopy: "YOUR TURN",
    legalActions: actorLegal,
  });
  const other = view({ viewerId: "sam", currentActorId: "owner", legalActions: [] });
  expect(pokerControlIds(actor, "actor")).toEqual(["call", "fold", "raise", "all_in"]);
  expect(pokerControlIds(other, "actor")).toEqual([]);
  expect(pokerTrayEnabled(actor)).toBe(true);
  expect(pokerTrayEnabled(other)).toBe(false);
});

test("owner street control is visible disabled until the street is matched, then enabled", () => {
  const waiting = view({
    role: "POKER_DEALER",
    isOwner: true,
    viewerId: "owner",
    nextStreetLabel: "DEAL FLOP",
    canDealStreet: false,
    streetComplete: false,
  });
  const matched = view({
    role: "POKER_DEALER",
    isOwner: true,
    viewerId: "owner",
    nextStreetLabel: "DEAL FLOP",
    canDealStreet: true,
    streetComplete: true,
    currentActorId: null,
    waitingCopy: null,
  });
  const waitingStreet = pokerControls(waiting).find((control) => control.id === "dealStreet");
  const matchedStreet = pokerControls(matched).find((control) => control.id === "dealStreet");
  expect(waitingStreet).toMatchObject({ enabled: false, label: "DEAL FLOP", hint: "Waiting for bets to match" });
  expect(matchedStreet).toMatchObject({ enabled: true, label: "DEAL FLOP" });
  expect(pokerControlIds(view({ nextStreetLabel: "DEAL FLOP", isOwner: false }), "owner")).toEqual([]);
});

test("role × phase owner controls follow setup, streets, showdown, and next hand", () => {
  const setup = view({
    phase: "POKER_SETUP",
    isOwner: true,
    viewerId: "owner",
    canReorderSeats: true,
    canAddPlayer: true,
    canGiveJetons: true,
    canSwitchGame: true,
  });
  expect(pokerControls(setup).find((control) => control.id === "startHand")).toMatchObject({
    label: "DEAL CARDS",
    surface: "dock",
  });
  expect(pokerControlIds(setup, "owner")).toEqual(["startHand", "reorderSeats", "addPlayer", "giveJetons", "switchGame"]);
  expect(pokerControlIds(setup, "owner", "dock")).toEqual(["startHand"]);
  expect(pokerControlIds(setup, "owner", "menu")).toEqual(["reorderSeats", "addPlayer", "giveJetons", "switchGame"]);

  expect(pokerControlIds(view({
    phase: "FLOP",
    isOwner: true,
    viewerId: "owner",
    nextStreetLabel: "DEAL TURN",
    canDealStreet: true,
  }), "owner")).toEqual(["dealStreet"]);

  expect(pokerControlIds(view({
    phase: "SHOWDOWN",
    isOwner: true,
    viewerId: "owner",
    canAward: true,
    nextStreetLabel: null,
  }), "owner")).toEqual(["assignWinners"]);

  expect(pokerControlIds(view({
    phase: "HAND_COMPLETE",
    isOwner: true,
    viewerId: "owner",
    canNextHand: true,
    canScheduleNextHand: true,
    canSwitchGame: true,
    canAddPlayer: true,
    canGiveJetons: true,
  }), "owner")).toEqual(["nextHand", "scheduleNextHand", "addPlayer", "giveJetons", "switchGame"]);
  expect(pokerControlIds(view({
    phase: "HAND_COMPLETE",
    isOwner: true,
    viewerId: "owner",
    canNextHand: true,
    canScheduleNextHand: true,
    canSwitchGame: true,
    canAddPlayer: true,
    canGiveJetons: true,
  }), "owner", "dock")).toEqual(["nextHand", "scheduleNextHand"]);
  expect(pokerControlIds(view({
    phase: "HAND_COMPLETE",
    isOwner: true,
    viewerId: "owner",
    canNextHand: true,
    canScheduleNextHand: true,
    canSwitchGame: true,
    canAddPlayer: true,
    canGiveJetons: true,
  }), "owner", "menu")).toEqual(["addPlayer", "giveJetons", "switchGame"]);
});

test("the rotating dealer button does not grant owner street controls", () => {
  const button = view({
    viewerId: "sam",
    isOwner: false,
    seats: [
      seat({ userId: "owner", name: "Owner", isDealer: false }),
      seat({ userId: "sam", name: "Sam", isDealer: true, isActor: true }),
    ],
    nextStreetLabel: null,
    legalActions: actorLegal,
  });
  expect(pokerControlIds(button, "owner")).toEqual([]);
  expect(pokerControlIds(button, "actor")).toEqual(["call", "fold", "raise", "all_in"]);
});

test("role × phase matrix is identical for heads-up and 3-player", () => {
  const streets = [
    { phase: "PRE_FLOP", label: "DEAL FLOP" },
    { phase: "FLOP", label: "DEAL TURN" },
    { phase: "TURN", label: "DEAL RIVER" },
    { phase: "RIVER", label: "SHOWDOWN" },
  ] as const;

  for (const seatCount of [2, 3]) {
    const seats = Array.from({ length: seatCount }, (_, index) =>
      seat({
        userId: index === 0 ? "owner" : `p${index}`,
        name: index === 0 ? "Owner" : `P${index}`,
        orderIndex: index,
        isDealer: index === 0,
      }),
    );

    expect(pokerControlIds(view({
      phase: "POKER_SETUP",
      isOwner: true,
      viewerId: "owner",
      seats,
      canReorderSeats: true,
      canAddPlayer: true,
      canGiveJetons: true,
      canSwitchGame: true,
    }), "owner")).toEqual(["startHand", "reorderSeats", "addPlayer", "giveJetons", "switchGame"]);
    expect(pokerControlIds(view({
      phase: "POKER_SETUP",
      isOwner: false,
      viewerId: "p1",
      seats,
      legalActions: [],
    }), "actor")).toEqual([]);

    for (const street of streets) {
      const ownerWaiting = view({
        phase: street.phase,
        isOwner: true,
        viewerId: "owner",
        seats,
        nextStreetLabel: street.label,
        canDealStreet: false,
        legalActions: [],
      });
      const ownerActor = view({
        ...ownerWaiting,
        legalActions: actorLegal,
        currentActorId: "owner",
      });
      const playerActor = view({
        phase: street.phase,
        isOwner: false,
        viewerId: "p1",
        seats,
        nextStreetLabel: null,
        legalActions: checkLegal,
        currentActorId: "p1",
        toCall: money("0", "0"),
      });
      const playerWaiting = view({
        phase: street.phase,
        isOwner: false,
        viewerId: "p1",
        seats,
        nextStreetLabel: null,
        legalActions: [],
        currentActorId: "owner",
      });
      const folded = view({
        phase: street.phase,
        isOwner: false,
        viewerId: "p1",
        viewerStatus: "FOLDED",
        seats,
        legalActions: [],
      });
      const allIn = view({
        phase: street.phase,
        isOwner: false,
        viewerId: "p1",
        viewerStatus: "ALL_IN",
        seats,
        legalActions: [],
      });

      expect(pokerControlIds(ownerWaiting, "owner")).toEqual(["dealStreet"]);
      expect(pokerControls(ownerWaiting).find((control) => control.id === "dealStreet")?.enabled).toBe(false);
      expect(pokerControlIds(ownerWaiting, "actor")).toEqual([]);
      expect(pokerControlIds(ownerActor, "actor")).toEqual(["call", "fold", "raise", "all_in"]);
      expect(pokerControlIds(playerActor, "owner")).toEqual([]);
      expect(pokerControlIds(playerActor, "actor")).toEqual(["check", "bet", "all_in", "fold"]);
      expect(pokerTrayEnabled(playerActor)).toBe(true);
      expect(pokerControlIds(playerWaiting, "actor")).toEqual([]);
      expect(pokerTrayEnabled(playerWaiting)).toBe(false);
      expect(pokerControlIds(folded, "actor")).toEqual([]);
      expect(pokerControlIds(allIn, "actor")).toEqual([]);
      expect(pokerTrayEnabled(folded)).toBe(false);
      expect(pokerTrayEnabled(allIn)).toBe(false);
    }

    const matched = view({
      phase: "PRE_FLOP",
      isOwner: true,
      viewerId: "owner",
      seats,
      nextStreetLabel: "DEAL FLOP",
      canDealStreet: true,
      streetComplete: true,
      legalActions: [],
    });
    expect(pokerControls(matched).find((control) => control.id === "dealStreet")).toMatchObject({
      enabled: true,
      label: "DEAL FLOP",
    });

    expect(pokerControlIds(view({
      phase: "SHOWDOWN",
      isOwner: true,
      viewerId: "owner",
      seats,
      canAward: true,
    }), "owner")).toEqual(["assignWinners"]);
    expect(pokerControlIds(view({
      phase: "SHOWDOWN",
      isOwner: false,
      viewerId: "p1",
      seats,
      legalActions: [],
    }))).toEqual([]);
    expect(pokerControlIds(view({
      phase: "HAND_COMPLETE",
      isOwner: true,
      viewerId: "owner",
      seats,
      canNextHand: true,
      canScheduleNextHand: true,
      canSwitchGame: true,
      canAddPlayer: true,
      canGiveJetons: true,
    }), "owner")).toEqual(["nextHand", "scheduleNextHand", "addPlayer", "giveJetons", "switchGame"]);
  }
});

test("HAND_COMPLETE cannot expose leftover actor actions", () => {
  const leftover = view({
    phase: "HAND_COMPLETE",
    potPaid: true,
    toCall: money("5"),
    currentActorId: "owner",
    waitingCopy: "Waiting for Owner",
    viewerId: "owner",
    viewerStatus: "ACTIVE",
    legalActions: [
      { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
      { type: "CALL", amount: money("5"), label: "CALL 5" },
    ],
  });
  expect(visiblePokerLegalActions(leftover)).toEqual([]);
  expect(pokerControlIds(leftover, "actor")).toEqual([]);
});

test("displayed CALL equals the owed amount and CALL 0 is never shown", () => {
  const actor = view({
    viewerId: "owner",
    currentActorId: "owner",
    available: money("100"),
    toCall: money("10"),
    legalActions: actorLegal,
  });
  const call = visiblePokerLegalActions(actor).find((action) => action.type === "CALL");
  expect(call?.label).toBe("CALL 10");
  expect(call?.amount.label).toBe(actor.toCall.label);
  expect(pokerControlIds(actor, "actor")).toContain("call");
  expect(pokerControls(actor).some((control) => control.label === "CALL 0")).toBe(false);

  const zeroStack = view({
    viewerId: "owner",
    currentActorId: "owner",
    available: money("0", "0"),
    toCall: money("10"),
    viewerStatus: "ACTIVE",
    legalActions: [
      { type: "FOLD", amount: money("0", "0"), label: "FOLD" },
      { type: "CALL", amount: money("0", "0"), label: "CALL 0" },
      { type: "BET", amount: money("0", "0"), label: "BET" },
    ],
  });
  expect(visiblePokerLegalActions(zeroStack).map((action) => action.type)).toEqual(["FOLD"]);
  expect(pokerControlIds(zeroStack, "actor")).toEqual(["fold"]);
  expect(pokerTrayEnabled(zeroStack)).toBe(false);

  const allIn = view({
    viewerId: "owner",
    currentActorId: "owner",
    viewerStatus: "ALL_IN",
    available: money("0", "0"),
    legalActions: actorLegal,
  });
  expect(visiblePokerLegalActions(allIn)).toEqual([]);
  expect(pokerControlIds(allIn, "actor")).toEqual([]);
});

