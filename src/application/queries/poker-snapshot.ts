import { formatJetons } from "@/domain/money";
import { amountToCall, legalActions } from "@/domain/poker/actions";
import { STREET_ADVANCE, isBettingStreet, type BettingStreet } from "@/domain/poker/phases";
import { allLiveAllIn, streetIsComplete } from "@/domain/poker/street";
import { formatPokerPhaseLabel, pokerHandIsOpen, projectActiveGame } from "@/domain/tables/active-game";
import type { MoneyView, PokerTableView } from "./views";

function money(millis: bigint | null | undefined): MoneyView {
  const value = millis ?? 0n;
  return { millis: value.toString(), label: formatJetons(value) };
}

function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email.split("@")[0] || "Player";
}

type Hand = {
  id: string;
  number: number;
  phase: string;
  dealerPlayerId: string;
  smallBlindPlayerId: string;
  bigBlindPlayerId: string;
  currentActorPlayerId: string | null;
  streetWagerMillis: bigint;
  lastRaiseSizeMillis: bigint;
  actionCount: number;
  nextHandDeadlineAt: Date | null;
  settledKey: string | null;
  awardSummary: unknown;
  participants: {
    playerId: string;
    status: "ACTIVE" | "FOLDED" | "ALL_IN";
    streetContributionMillis: bigint;
    totalContributionMillis: bigint;
    lockedMillis: bigint;
    hasActedThisStreet: boolean;
    isDealer: boolean;
    isSmallBlind: boolean;
    isBigBlind: boolean;
    seatOrder: number;
    player?: { name: string | null; email: string };
  }[];
  pots: {
    index: number;
    amountMillis: bigint;
    capMillis: bigint;
    eligiblePlayerIds: unknown;
    winnerPlayerIds: unknown;
  }[];
};

export function buildPokerView(input: {
  tableName: string;
  isOwner: boolean;
  viewerId: string;
  smallBlind: bigint;
  bigBlind: bigint;
  members: { userId: string; availableMillis: bigint; user: { name: string | null; email: string } }[];
  seats: { playerId: string; orderIndex: number; sittingOut: boolean }[];
  hand: Hand | null;
  tableClosed: boolean;
  handsStarted?: number;
}): PokerTableView {
  const { hand, viewerId, isOwner } = input;
  const memberById = new Map(input.members.map((member) => [member.userId, member]));
  const nameOf = (id: string) => displayName(memberById.get(id)?.user ?? { name: null, email: id });
  const phase = hand?.phase ?? "POKER_SETUP";
  const players = (hand?.participants ?? []).map((item) => ({
    playerId: item.playerId,
    status: item.status,
    streetContributionMillis: item.streetContributionMillis,
    hasActedThisStreet: item.hasActedThisStreet,
  }));
  const streetComplete = hand && isBettingStreet(hand.phase)
    ? streetIsComplete(players, hand.streetWagerMillis) || allLiveAllIn(players)
    : phase === "SHOWDOWN" || phase === "HAND_COMPLETE";
  const allInRunout = Boolean(hand && allLiveAllIn(players));
  const potTotal = hand?.participants.reduce((sum, item) => sum + item.totalContributionMillis, 0n) ?? 0n;
  const viewerPart = hand?.participants.find((item) => item.playerId === viewerId);
  const viewerMember = memberById.get(viewerId);
  const toCall = viewerPart
    ? amountToCall(hand!.streetWagerMillis, viewerPart.streetContributionMillis)
    : 0n;
  const legal = viewerPart && hand && hand.currentActorPlayerId === viewerId && isBettingStreet(hand.phase)
    ? legalActions({
        isActor: true,
        status: viewerPart.status,
        streetContributionMillis: viewerPart.streetContributionMillis,
        streetWagerMillis: hand.streetWagerMillis,
        availableMillis: viewerMember?.availableMillis ?? 0n,
        lastRaiseSizeMillis: hand.lastRaiseSizeMillis,
      }).map((action) => ({
        type: action.type,
        amount: money(action.amountMillis),
        raiseTo: action.raiseToMillis ? money(action.raiseToMillis) : undefined,
        label:
          action.type === "CALL"
            ? `CALL ${formatJetons(action.amountMillis)}`
            : action.type === "ALL_IN"
              ? "ALL IN"
              : action.type === "RAISE"
                ? "RAISE"
                : action.type,
      }))
    : [];
  const nextStreet = hand && isBettingStreet(hand.phase) ? STREET_ADVANCE[hand.phase as BettingStreet] : null;
  const actorName = hand?.currentActorPlayerId ? nameOf(hand.currentActorPlayerId) : null;
  const awards = Array.isArray(hand?.awardSummary)
    ? (hand!.awardSummary as { playerId: string; amount: string }[]).map((item) => ({
        userId: item.playerId,
        name: nameOf(item.playerId),
        amount: { millis: "0", label: item.amount },
      }))
    : [];
  const seats: PokerTableView["seats"] = (hand
    ? hand.participants
    : input.seats.map((seat) => ({
        playerId: seat.playerId,
        status: "ACTIVE" as const,
        streetContributionMillis: 0n,
        totalContributionMillis: 0n,
        lockedMillis: 0n,
        hasActedThisStreet: false,
        isDealer: false,
        isSmallBlind: false,
        isBigBlind: false,
        seatOrder: seat.orderIndex,
      }))
  )
    .slice()
    .sort((left, right) => left.seatOrder - right.seatOrder)
    .map((item) => {
      const member = memberById.get(item.playerId);
      return {
        userId: item.playerId,
        name: nameOf(item.playerId),
        available: money(member?.availableMillis ?? 0n),
        contribution: money("totalContributionMillis" in item ? item.totalContributionMillis : 0n),
        streetContribution: money("streetContributionMillis" in item ? item.streetContributionMillis : 0n),
        toCall: money(
          hand && "streetContributionMillis" in item
            ? amountToCall(hand.streetWagerMillis, item.streetContributionMillis)
            : 0n,
        ),
        status: hand ? item.status : "WAITING",
        isDealer: item.isDealer,
        isSmallBlind: item.isSmallBlind,
        isBigBlind: item.isBigBlind,
        isActor: hand?.currentActorPlayerId === item.playerId,
        sittingOut: false,
        orderIndex: item.seatOrder,
      };
    });
  const copy =
    phase === "POKER_SETUP"
      ? "Set blinds and dealer order, then DEAL CARDS"
      : phase === "HAND_COMPLETE"
        ? "Hand complete"
        : phase === "SHOWDOWN"
          ? "Assign winners for every pot"
          : actorName
            ? hand?.currentActorPlayerId === viewerId
              ? "YOUR TURN"
              : `Waiting for ${actorName}`
            : "Betting street";
  const active = projectActiveGame({
    game: "POKER",
    blackjackPhase: "TABLE_SETUP",
    pokerPhase: phase,
  });
  return {
    role: isOwner ? "POKER_DEALER" : "POKER_PLAYER",
    phase,
    phaseLabel: formatPokerPhaseLabel(phase),
    headline: active.headline,
    tableName: input.tableName,
    copy,
    isOwner,
    pot: money(potTotal),
    toCall: money(toCall),
    contribution: money(viewerPart?.totalContributionMillis ?? 0n),
    available: money(viewerMember?.availableMillis ?? 0n),
    smallBlind: money(input.smallBlind),
    bigBlind: money(input.bigBlind),
    streetWager: money(hand?.streetWagerMillis ?? 0n),
    viewerStatus: viewerPart?.status ?? "WAITING",
    seats,
    pots: (hand?.pots ?? []).map((pot) => ({
      index: pot.index,
      amount: money(pot.amountMillis),
      cap: money(pot.capMillis),
      eligiblePlayerIds: (pot.eligiblePlayerIds as string[]) ?? [],
      winnerPlayerIds: (pot.winnerPlayerIds as string[] | null) ?? [],
    })),
    legalActions: legal,
    currentActorName: actorName,
    currentActorId: hand?.currentActorPlayerId ?? null,
    waitingCopy: hand?.currentActorPlayerId
      ? hand.currentActorPlayerId === viewerId
        ? "YOUR TURN"
        : `Waiting for ${actorName}`
      : null,
    winners: awards,
    canDealStreet: Boolean(isOwner && nextStreet && streetComplete && !input.tableClosed && phase !== "SHOWDOWN" && phase !== "HAND_COMPLETE"),
    nextStreetLabel: isOwner && nextStreet ? nextStreet.command : null,
    canAward: Boolean(isOwner && phase === "SHOWDOWN" && !hand?.settledKey && !input.tableClosed),
    canNextHand: Boolean(isOwner && phase === "HAND_COMPLETE" && !input.tableClosed),
    canScheduleNextHand: Boolean(isOwner && phase === "HAND_COMPLETE" && !input.tableClosed),
    nextHandDeadlineAt: hand?.nextHandDeadlineAt?.toISOString() ?? null,
    canSwitchGame: Boolean(isOwner && (phase === "POKER_SETUP" || phase === "HAND_COMPLETE") && !input.tableClosed),
    switchBlockedReason: isOwner && pokerHandIsOpen(phase) ? "Finish or clear the current hand before switching games" : null,
    canAddPlayer: Boolean(isOwner && (phase === "POKER_SETUP" || phase === "HAND_COMPLETE") && !input.tableClosed),
    canGiveJetons: Boolean(isOwner && (phase === "POKER_SETUP" || phase === "HAND_COMPLETE") && !input.tableClosed),
    canReorderSeats: Boolean(
      isOwner &&
        phase === "POKER_SETUP" &&
        !input.tableClosed &&
        (input.handsStarted ?? (hand ? 1 : 0)) === 0,
    ),
    streetComplete: Boolean(streetComplete),
    allInRunout,
    turnNumber: hand?.actionCount ?? 0,
    handNumber: hand?.number ?? 0,
    viewerId,
  };
}
