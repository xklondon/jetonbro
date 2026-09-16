import { prisma } from "@/application/db";
import { withIdempotency } from "@/application/idempotency";
import { publishTable } from "@/application/realtime/bus";
import { appendLedger, creditTableAvailable } from "@/application/services/ledger";
import { clearNextHandTimer, scheduleNextHandTimer } from "@/application/services/deal-timer";
import { replacePokerSeats } from "@/application/services/poker-seats";
import { amountToCall, isFullRaise, legalActions, minRaiseTo, type PokerActionType } from "@/domain/poker/actions";
import { STREET_ADVANCE, isBettingStreet, type BettingStreet } from "@/domain/poker/phases";
import { buildSidePots, splitPotEqually, uncalledReturn } from "@/domain/poker/pots";
import { assignBlinds, nextActorFrom, nextDealer, orderedSeats, type PokerSeat as DomainSeat } from "@/domain/poker/seats";
import { allLiveAllIn, livePlayers, onlyOneLive, stillNeedsToAct, streetIsComplete } from "@/domain/poker/street";
import { ConflictError, DomainError, ForbiddenError, NotFoundError, PhaseConflictError } from "@/domain/errors";
import { formatJetons, parseWholeJetons } from "@/domain/money";
import { pokerHandIsOpen } from "@/domain/tables/active-game";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;
export const NEXT_HAND_COUNTDOWN_MS = 7_000;
const TURN_CONFLICT = "It is not your turn.";

async function loadPokerTable(tx: Tx, tableId: string) {
  await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${tableId} FOR UPDATE`;
  const table = await tx.table.findUnique({
    where: { id: tableId },
    include: {
      members: { where: { leftAt: null }, include: { user: true } },
      pokerSeats: { orderBy: { orderIndex: "asc" } },
      currentPokerHand: {
        include: { participants: true, pots: { orderBy: { index: "asc" } }, actions: true },
      },
      currentRound: { include: { boxes: true, insuranceBets: true } },
    },
  });
  if (!table) throw new NotFoundError("Table not found.");
  if (table.status === "ARCHIVED") throw new DomainError("TABLE_CLOSED", "This table is closed.");
  if (table.game !== "POKER") throw new DomainError("GAME_CONFLICT", "This command is only available during Texas Hold’em.");
  return table;
}

function requireOwner(table: { ownerId: string }, actorId: string) {
  if (table.ownerId !== actorId) throw new ForbiddenError("Only the table owner can do that.");
}

function domainSeats(seats: { playerId: string; orderIndex: number; sittingOut: boolean }[]): DomainSeat[] {
  return orderedSeats(seats.filter((seat) => !seat.sittingOut).map((seat) => ({ playerId: seat.playerId, orderIndex: seat.orderIndex })));
}

async function lockWager(
  tx: Tx,
  input: {
    memberId: string;
    playerId: string;
    tableId: string;
    handId: string;
    amount: bigint;
    type: "POKER_BLIND_LOCKED" | "POKER_WAGER_LOCKED";
    key: string;
    description: string;
  },
) {
  if (input.amount <= 0n) return;
  const { before, after } = await creditTableAvailable(tx, input.memberId, -input.amount);
  await appendLedger(tx, {
    playerId: input.playerId,
    actorId: input.playerId,
    tableId: input.tableId,
    pokerHandId: input.handId,
    transactionType: input.type,
    amountMillis: input.amount,
    balanceBeforeMillis: before,
    balanceAfterMillis: after,
    idempotencyKey: input.key,
    description: input.description,
  });
}

async function creditBack(
  tx: Tx,
  input: {
    memberId: string;
    playerId: string;
    tableId: string;
    handId: string;
    amount: bigint;
    type: "POKER_UNCALLED_RETURN" | "POKER_POT_AWARD";
    key: string;
    description: string;
    actorId: string;
  },
) {
  if (input.amount <= 0n) return;
  const { before, after } = await creditTableAvailable(tx, input.memberId, input.amount);
  await appendLedger(tx, {
    playerId: input.playerId,
    actorId: input.actorId,
    tableId: input.tableId,
    pokerHandId: input.handId,
    transactionType: input.type,
    amountMillis: input.amount,
    balanceBeforeMillis: before,
    balanceAfterMillis: after,
    idempotencyKey: input.key,
    description: input.description,
  });
}

function canAct(participant: { status: string }): boolean {
  return participant.status === "ACTIVE";
}

async function postBlind(
  tx: Tx,
  table: { id: string; members: { id: string; userId: string; availableMillis: bigint }[] },
  handId: string,
  playerId: string,
  wanted: bigint,
  key: string,
  label: string,
) {
  const member = table.members.find((item) => item.userId === playerId);
  if (!member) throw new NotFoundError("Player is not seated.");
  const amount = member.availableMillis < wanted ? member.availableMillis : wanted;
  const allIn = amount < wanted || member.availableMillis === amount;
  await lockWager(tx, {
    memberId: member.id,
    playerId,
    tableId: table.id,
    handId,
    amount,
    type: "POKER_BLIND_LOCKED",
    key,
    description: `AVAILABLE → LOCKED_POKER · ${label} ${formatJetons(amount)}`,
  });
  await tx.pokerParticipant.update({
    where: { handId_playerId: { handId, playerId } },
    data: {
      streetContributionMillis: amount,
      totalContributionMillis: amount,
      lockedMillis: amount,
      status: allIn && amount > 0n ? "ALL_IN" : "ACTIVE",
      hasActedThisStreet: allIn,
    },
  });
  member.availableMillis -= amount;
  return amount;
}

async function rebuildPots(tx: Tx, handId: string) {
  const participants = await tx.pokerParticipant.findMany({ where: { handId } });
  await tx.pokerPot.deleteMany({ where: { handId } });
  const pots = buildSidePots(
    participants.map((item) => ({
      playerId: item.playerId,
      total: item.totalContributionMillis,
      folded: item.status === "FOLDED",
    })),
  );
  for (const pot of pots) {
    await tx.pokerPot.create({
      data: {
        handId,
        index: pot.index,
        capMillis: pot.capMillis,
        amountMillis: pot.amountMillis,
        eligiblePlayerIds: pot.eligiblePlayerIds,
      },
    });
  }
  return pots;
}

async function finishByFold(tx: Tx, tableId: string, hand: NonNullable<Awaited<ReturnType<typeof loadPokerTable>>["currentPokerHand"]>, actorId: string) {
  const extra = uncalledReturn(
    hand.participants.map((item) => ({
      playerId: item.playerId,
      total: item.totalContributionMillis,
      folded: item.status === "FOLDED",
    })),
  );
  if (extra) {
    const member = await tx.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: extra.playerId } },
    });
    await creditBack(tx, {
      memberId: member.id,
      playerId: extra.playerId,
      tableId,
      handId: hand.id,
      amount: extra.amount,
      type: "POKER_UNCALLED_RETURN",
      key: `${hand.id}:uncalled`,
      description: `LOCKED_POKER → AVAILABLE · uncalled ${formatJetons(extra.amount)}`,
      actorId,
    });
    await tx.pokerParticipant.update({
      where: { handId_playerId: { handId: hand.id, playerId: extra.playerId } },
      data: {
        totalContributionMillis: { decrement: extra.amount },
        lockedMillis: { decrement: extra.amount },
      },
    });
    const winner = hand.participants.find((item) => item.playerId === extra.playerId);
    if (winner) {
      winner.totalContributionMillis -= extra.amount;
      winner.lockedMillis -= extra.amount;
    }
  }
  const pots = await rebuildPots(tx, hand.id);
  const live = livePlayers(hand.participants.map((item) => ({
    playerId: item.playerId,
    status: item.status,
    streetContributionMillis: item.streetContributionMillis,
    hasActedThisStreet: item.hasActedThisStreet,
  })));
  const winnerId = live[0]?.playerId;
  const awards: { playerId: string; amount: string }[] = [];
  if (winnerId) {
    let total = 0n;
    for (const pot of pots) {
      if (!pot.eligiblePlayerIds.includes(winnerId)) continue;
      total += pot.amountMillis;
      await tx.pokerPot.updateMany({
        where: { handId: hand.id, index: pot.index },
        data: { winnerPlayerIds: [winnerId], awarded: true },
      });
    }
    if (total > 0n) {
      const member = await tx.tableMember.findUniqueOrThrow({
        where: { tableId_userId: { tableId, userId: winnerId } },
      });
      await creditBack(tx, {
        memberId: member.id,
        playerId: winnerId,
        tableId,
        handId: hand.id,
        amount: total,
        type: "POKER_POT_AWARD",
        key: `${hand.id}:award:${winnerId}`,
        description: `LOCKED_POKER → AVAILABLE · pot ${formatJetons(total)}`,
        actorId,
      });
      awards.push({ playerId: winnerId, amount: formatJetons(total) });
    }
  }
  await tx.pokerParticipant.updateMany({ where: { handId: hand.id }, data: { lockedMillis: 0n } });
  await tx.pokerHand.update({
    where: { id: hand.id },
    data: {
      phase: "HAND_COMPLETE",
      currentActorPlayerId: null,
      completedAt: new Date(),
      settledKey: hand.id,
      awardSummary: awards,
      actionCount: { increment: 1 },
    },
  });
}

async function createHand(
  tx: Tx,
  table: Awaited<ReturnType<typeof loadPokerTable>>,
  actorId: string,
  previousDealerId: string | null,
) {
  const seats = domainSeats(table.pokerSeats);
  if (seats.length < 2) throw new DomainError("POKER_SEATS", "Texas Hold’em needs at least two Players.");
  const dealer = nextDealer(seats, previousDealerId);
  const blinds = assignBlinds(seats, dealer.playerId);
  const number = (await tx.pokerHand.count({ where: { tableId: table.id } })) + 1;
  const hand = await tx.pokerHand.create({
    data: {
      tableId: table.id,
      number,
      phase: "PRE_FLOP",
      dealerPlayerId: blinds.dealerPlayerId,
      smallBlindPlayerId: blinds.smallBlindPlayerId,
      bigBlindPlayerId: blinds.bigBlindPlayerId,
      streetWagerMillis: table.pokerBigBlindMillis,
      lastRaiseSizeMillis: table.pokerBigBlindMillis,
    },
  });
  for (const seat of seats) {
    await tx.pokerParticipant.create({
      data: {
        handId: hand.id,
        playerId: seat.playerId,
        seatOrder: seat.orderIndex,
        isDealer: seat.playerId === blinds.dealerPlayerId,
        isSmallBlind: seat.playerId === blinds.smallBlindPlayerId,
        isBigBlind: seat.playerId === blinds.bigBlindPlayerId,
      },
    });
  }
  const sbPosted = await postBlind(
    tx,
    table,
    hand.id,
    blinds.smallBlindPlayerId,
    table.pokerSmallBlindMillis,
    `${hand.id}:sb`,
    "small blind",
  );
  const bbPosted = await postBlind(
    tx,
    table,
    hand.id,
    blinds.bigBlindPlayerId,
    table.pokerBigBlindMillis,
    `${hand.id}:bb`,
    "big blind",
  );
  const wager = sbPosted > bbPosted ? sbPosted : bbPosted;
  const first = blinds.preflopFirstPlayerId;
  const participants = await tx.pokerParticipant.findMany({ where: { handId: hand.id } });
  const firstCanAct = participants.find((item) => item.playerId === first && canAct(item));
  const actor =
    firstCanAct?.playerId ??
    nextActorFrom(seats, first, (playerId) => canAct(participants.find((item) => item.playerId === playerId)!));
  await tx.pokerHand.update({
    where: { id: hand.id },
    data: {
      streetWagerMillis: wager,
      lastRaiseSizeMillis: table.pokerBigBlindMillis,
      currentActorPlayerId: actor,
    },
  });
  await tx.table.update({
    where: { id: table.id },
    data: { currentPokerHandId: hand.id, updatedAt: new Date() },
  });
  await rebuildPots(tx, hand.id);
  return hand.id;
}

export async function configurePoker(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  smallBlind?: string;
  bigBlind?: string;
  seatOrder?: string[];
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "configurePoker", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadPokerTable(tx, input.tableId);
      requireOwner(table, input.actorId);
      if (pokerHandIsOpen(table.currentPokerHand?.phase)) {
        throw new DomainError("SEATS_LOCKED", "Seat order cannot change during a hand.");
      }
      const small = input.smallBlind ? parseWholeJetons(input.smallBlind, "Small blind") : table.pokerSmallBlindMillis;
      const big = input.bigBlind ? parseWholeJetons(input.bigBlind, "Big blind") : table.pokerBigBlindMillis;
      if (small <= 0n || big <= 0n || small > big) {
        throw new DomainError("INVALID_AMOUNT", "Big blind must be greater than small blind.");
      }
      if (input.seatOrder?.length) {
        const current = table.pokerSeats.map((seat) => seat.playerId);
        const ordered = input.seatOrder.filter((id) => current.includes(id));
        const remainder = current.filter((id) => !ordered.includes(id));
        await replacePokerSeats(tx, table.id, [...ordered, ...remainder]);
      }
      await tx.table.update({
        where: { id: table.id },
        data: { pokerSmallBlindMillis: small, pokerBigBlindMillis: big, updatedAt: new Date() },
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function startTexasHoldem(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  smallBlind?: string;
  bigBlind?: string;
  seatOrder?: string[];
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "startTexasHoldem", input, async () => {
    const current = await prisma.table.findUnique({ where: { id: input.tableId } });
    if (current && current.game !== "POKER") {
      const { switchGame } = await import("@/application/services/switch-game");
      await switchGame({
        actorId: input.actorId,
        tableId: input.tableId,
        idempotencyKey: `${input.idempotencyKey}:switch`,
        game: "POKER",
        smallBlind: input.smallBlind,
        bigBlind: input.bigBlind,
        seatOrder: input.seatOrder,
      });
    }
    await configurePoker({ ...input, idempotencyKey: `${input.idempotencyKey}:config` });
    await prisma.$transaction(async (tx) => {
      const table = await loadPokerTable(tx, input.tableId);
      requireOwner(table, input.actorId);
      if (table.currentPokerHand && !["POKER_SETUP", "HAND_COMPLETE"].includes(table.currentPokerHand.phase)) {
        throw new ConflictError("A hand is already in progress.");
      }
      const previous = table.currentPokerHand?.phase === "HAND_COMPLETE" ? table.currentPokerHand.dealerPlayerId : null;
      await createHand(tx, table, input.actorId, previous);
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

function streetPlayers(hand: NonNullable<Awaited<ReturnType<typeof loadPokerTable>>["currentPokerHand"]>) {
  return hand.participants.map((item) => ({
    playerId: item.playerId,
    status: item.status,
    streetContributionMillis: item.streetContributionMillis,
    hasActedThisStreet: item.hasActedThisStreet,
  }));
}

async function afterAction(
  tx: Tx,
  table: Awaited<ReturnType<typeof loadPokerTable>>,
  actorId: string,
) {
  const hand = await tx.pokerHand.findUniqueOrThrow({
    where: { id: table.currentPokerHandId! },
    include: { participants: true, pots: true },
  });
  const seats = domainSeats(table.pokerSeats);
  const players = streetPlayers({ ...hand, actions: [], pots: [] });
  if (onlyOneLive(players)) {
    await finishByFold(tx, table.id, { ...hand, actions: [] }, actorId);
    return;
  }
  if (streetIsComplete(players, hand.streetWagerMillis) || allLiveAllIn(players)) {
    await tx.pokerHand.update({
      where: { id: hand.id },
      data: { currentActorPlayerId: null, actionCount: { increment: 1 } },
    });
    await rebuildPots(tx, hand.id);
    return;
  }
  const from = hand.currentActorPlayerId ?? hand.dealerPlayerId;
  const next = nextActorFrom(seats, from, (playerId) => {
    const participant = hand.participants.find((item) => item.playerId === playerId);
    return Boolean(
      participant &&
        stillNeedsToAct(
          {
            playerId: participant.playerId,
            status: participant.status,
            streetContributionMillis: participant.streetContributionMillis,
            hasActedThisStreet: participant.hasActedThisStreet,
          },
          hand.streetWagerMillis,
        ),
    );
  });
  if (!next) {
    await tx.pokerHand.update({
      where: { id: hand.id },
      data: { currentActorPlayerId: null, actionCount: { increment: 1 } },
    });
    await rebuildPots(tx, hand.id);
    return;
  }
  await tx.pokerHand.update({
    where: { id: hand.id },
    data: { currentActorPlayerId: next, actionCount: { increment: 1 } },
  });
  await rebuildPots(tx, hand.id);
}

export async function pokerAct(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  type: PokerActionType;
  amount?: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "pokerAct", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadPokerTable(tx, input.tableId);
      const hand = table.currentPokerHand;
      if (!hand || !isBettingStreet(hand.phase)) {
        throw new PhaseConflictError("This action", hand?.phase ?? "none", "a betting street");
      }
      if (hand.currentActorPlayerId !== input.actorId) {
        throw new DomainError("TURN_CONFLICT", TURN_CONFLICT, 409);
      }
      const participant = hand.participants.find((item) => item.playerId === input.actorId);
      const member = table.members.find((item) => item.userId === input.actorId);
      if (!participant || !member) throw new ForbiddenError("You are not in this hand.");
      const legal = legalActions({
        isActor: true,
        status: participant.status,
        streetContributionMillis: participant.streetContributionMillis,
        streetWagerMillis: hand.streetWagerMillis,
        availableMillis: member.availableMillis,
        lastRaiseSizeMillis: hand.lastRaiseSizeMillis,
      });
      const chosen = legal.find((action) => action.type === input.type);
      if (!chosen) throw new DomainError("ILLEGAL_ACTION", "That action is not available now.", 409);
      let pay = chosen.amountMillis;
      let raiseTo = chosen.raiseToMillis;
      if (input.type === "BET" || input.type === "RAISE") {
        const requested = input.amount ? parseWholeJetons(input.amount, "Bet") : chosen.raiseToMillis ?? chosen.amountMillis;
        if (input.type === "BET") {
          if (hand.streetWagerMillis !== participant.streetContributionMillis && hand.streetWagerMillis !== 0n) {
            throw new DomainError("ILLEGAL_ACTION", "Bet is only available when nothing is wagered this street.", 409);
          }
          pay = requested;
          if (pay > member.availableMillis) pay = member.availableMillis;
          raiseTo = participant.streetContributionMillis + pay;
        } else {
          raiseTo = requested;
          const minTo = minRaiseTo(hand.streetWagerMillis, hand.lastRaiseSizeMillis);
          if (raiseTo < minTo && raiseTo < participant.streetContributionMillis + member.availableMillis) {
            throw new DomainError("ILLEGAL_ACTION", "Raise must meet the minimum legal raise unless All In.", 409);
          }
          pay = raiseTo - participant.streetContributionMillis;
          if (pay > member.availableMillis) pay = member.availableMillis;
          raiseTo = participant.streetContributionMillis + pay;
        }
      }
      if (input.type === "ALL_IN") pay = member.availableMillis;
      if (input.type === "FOLD") {
        await tx.pokerParticipant.update({
          where: { id: participant.id },
          data: { status: "FOLDED", hasActedThisStreet: true },
        });
        participant.status = "FOLDED";
        participant.hasActedThisStreet = true;
      } else if (input.type === "CHECK") {
        await tx.pokerParticipant.update({
          where: { id: participant.id },
          data: { hasActedThisStreet: true },
        });
        participant.hasActedThisStreet = true;
      } else {
        const allIn = pay >= member.availableMillis;
        await lockWager(tx, {
          memberId: member.id,
          playerId: input.actorId,
          tableId: table.id,
          handId: hand.id,
          amount: pay,
          type: "POKER_WAGER_LOCKED",
          key: `${input.idempotencyKey}:ledger`,
          description: `AVAILABLE → LOCKED_POKER · ${input.type.toLowerCase()} ${formatJetons(pay)}`,
        });
        const nextStreet = participant.streetContributionMillis + pay;
        const nextTotal = participant.totalContributionMillis + pay;
        const nextWager = nextStreet > hand.streetWagerMillis ? nextStreet : hand.streetWagerMillis;
        const fullRaise =
          (input.type === "BET" || input.type === "RAISE" || input.type === "ALL_IN") &&
          isFullRaise(nextStreet, hand.streetWagerMillis, hand.lastRaiseSizeMillis);
        if (fullRaise) {
          await tx.pokerParticipant.updateMany({
            where: { handId: hand.id, status: "ACTIVE", id: { not: participant.id } },
            data: { hasActedThisStreet: false },
          });
          for (const item of hand.participants) {
            if (item.id !== participant.id && item.status === "ACTIVE") item.hasActedThisStreet = false;
          }
        }
        await tx.pokerParticipant.update({
          where: { id: participant.id },
          data: {
            streetContributionMillis: nextStreet,
            totalContributionMillis: nextTotal,
            lockedMillis: participant.lockedMillis + pay,
            hasActedThisStreet: true,
            status: allIn ? "ALL_IN" : "ACTIVE",
          },
        });
        participant.streetContributionMillis = nextStreet;
        participant.totalContributionMillis = nextTotal;
        participant.lockedMillis += pay;
        participant.hasActedThisStreet = true;
        participant.status = allIn ? "ALL_IN" : "ACTIVE";
        await tx.pokerHand.update({
          where: { id: hand.id },
          data: {
            streetWagerMillis: nextWager,
            lastRaiseSizeMillis: fullRaise ? nextStreet - hand.streetWagerMillis : hand.lastRaiseSizeMillis,
            lastAggressorPlayerId: fullRaise ? input.actorId : hand.lastAggressorPlayerId,
          },
        });
        hand.streetWagerMillis = nextWager;
      }
      await tx.pokerAction.create({
        data: {
          handId: hand.id,
          playerId: input.actorId,
          street: hand.phase,
          type: input.type === "ALL_IN" ? "ALL_IN" : input.type,
          amountMillis: input.type === "FOLD" || input.type === "CHECK" ? 0n : pay,
          sequence: hand.actionCount + 1,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await afterAction(tx, table, input.actorId);
      await tx.table.update({ where: { id: table.id }, data: { updatedAt: new Date() } });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function advancePokerStreet(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "advancePokerStreet", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadPokerTable(tx, input.tableId);
      requireOwner(table, input.actorId);
      const hand = table.currentPokerHand;
      if (!hand || !isBettingStreet(hand.phase)) {
        throw new PhaseConflictError("Deal the next street", hand?.phase ?? "none", "a completed betting street");
      }
      const players = streetPlayers(hand);
      if (!streetIsComplete(players, hand.streetWagerMillis) && !allLiveAllIn(players)) {
        throw new DomainError("STREET_OPEN", "The current betting round is not complete.", 409);
      }
      if (onlyOneLive(players)) {
        await finishByFold(tx, table.id, hand, input.actorId);
        await tx.table.update({ where: { id: table.id }, data: { updatedAt: new Date() } });
        return;
      }
      const next = STREET_ADVANCE[hand.phase as BettingStreet].next;
      const seats = domainSeats(table.pokerSeats);
      let actor: string | null = null;
      if (next !== "SHOWDOWN" && !allLiveAllIn(players)) {
        const blinds = assignBlinds(seats, hand.dealerPlayerId);
        actor = nextActorFrom(seats, blinds.dealerPlayerId, (playerId) => {
          const participant = hand.participants.find((item) => item.playerId === playerId);
          return Boolean(participant && canAct(participant));
        });
      }
      await tx.pokerParticipant.updateMany({
        where: { handId: hand.id },
        data: { streetContributionMillis: 0n, hasActedThisStreet: false },
      });
      await tx.pokerHand.update({
        where: { id: hand.id },
        data: {
          phase: next,
          streetWagerMillis: 0n,
          lastRaiseSizeMillis: table.pokerBigBlindMillis,
          lastAggressorPlayerId: null,
          currentActorPlayerId: next === "SHOWDOWN" ? null : actor,
        },
      });
      await tx.table.update({ where: { id: table.id }, data: { updatedAt: new Date() } });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function setPokerWinners(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  pots: { index: number; winnerIds: string[] }[];
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "setPokerWinners", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadPokerTable(tx, input.tableId);
      requireOwner(table, input.actorId);
      const hand = table.currentPokerHand;
      if (!hand || hand.phase !== "SHOWDOWN") {
        throw new PhaseConflictError("Assign winners", hand?.phase ?? "none", "SHOWDOWN");
      }
      const pots = hand.pots.length ? hand.pots : await rebuildPots(tx, hand.id).then(async () =>
        tx.pokerPot.findMany({ where: { handId: hand.id }, orderBy: { index: "asc" } }),
      );
      for (const assignment of input.pots) {
        const pot = pots.find((item) => item.index === assignment.index);
        if (!pot) throw new DomainError("INVALID_POT", "That pot is not part of this hand.");
        const eligible = pot.eligiblePlayerIds as string[];
        if (assignment.winnerIds.some((id) => !eligible.includes(id))) {
          throw new DomainError("INELIGIBLE_WINNER", "Only eligible Players may win each pot.");
        }
        if (assignment.winnerIds.length === 0) {
          throw new DomainError("INELIGIBLE_WINNER", "Select at least one winner for each pot.");
        }
        await tx.pokerPot.update({
          where: { id: pot.id },
          data: { winnerPlayerIds: assignment.winnerIds },
        });
      }
      await tx.table.update({ where: { id: table.id }, data: { updatedAt: new Date() } });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function awardPokerPots(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  pots?: { index: number; winnerIds: string[] }[];
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "awardPokerPots", input, async () => {
    const existing = await prisma.table.findUnique({
      where: { id: input.tableId },
      include: { currentPokerHand: true },
    });
    if (existing?.currentPokerHand?.settledKey || existing?.currentPokerHand?.phase === "HAND_COMPLETE") {
      return { ok: true };
    }
    if (input.pots?.length) {
      await setPokerWinners({
        actorId: input.actorId,
        tableId: input.tableId,
        idempotencyKey: `${input.idempotencyKey}:winners`,
        pots: input.pots,
      });
    }
    await prisma.$transaction(async (tx) => {
      const table = await loadPokerTable(tx, input.tableId);
      requireOwner(table, input.actorId);
      const hand = table.currentPokerHand;
      if (!hand || (hand.phase !== "SHOWDOWN" && hand.phase !== "HAND_COMPLETE")) {
        throw new PhaseConflictError("Award pots", hand?.phase ?? "none", "SHOWDOWN");
      }
      if (hand.settledKey) return;
      const claimed = await tx.pokerHand.updateMany({
        where: { id: hand.id, settledKey: null },
        data: { settledKey: hand.id },
      });
      if (claimed.count !== 1) return;
      const pots = await tx.pokerPot.findMany({ where: { handId: hand.id }, orderBy: { index: "asc" } });
      const seats = domainSeats(table.pokerSeats);
      const totals = new Map<string, bigint>();
      for (const pot of pots) {
        const winners = (pot.winnerPlayerIds as string[] | null) ?? [];
        if (winners.length === 0) throw new DomainError("INELIGIBLE_WINNER", "Assign a winner for every pot.");
        const eligible = pot.eligiblePlayerIds as string[];
        if (winners.some((id) => !eligible.includes(id))) {
          throw new DomainError("INELIGIBLE_WINNER", "Only eligible Players may win each pot.");
        }
        const shares = splitPotEqually(pot.amountMillis, winners, hand.dealerPlayerId, seats);
        for (const [playerId, amount] of shares) {
          totals.set(playerId, (totals.get(playerId) ?? 0n) + amount);
        }
        await tx.pokerPot.update({ where: { id: pot.id }, data: { awarded: true } });
      }
      const awards: { playerId: string; amount: string }[] = [];
      for (const [playerId, amount] of totals) {
        const member = table.members.find((item) => item.userId === playerId);
        if (!member) continue;
        await creditBack(tx, {
          memberId: member.id,
          playerId,
          tableId: table.id,
          handId: hand.id,
          amount,
          type: "POKER_POT_AWARD",
          key: `${hand.id}:award:${playerId}`,
          description: `LOCKED_POKER → AVAILABLE · pot ${formatJetons(amount)}`,
          actorId: input.actorId,
        });
        awards.push({ playerId, amount: formatJetons(amount) });
      }
      await tx.pokerParticipant.updateMany({ where: { handId: hand.id }, data: { lockedMillis: 0n } });
      await tx.pokerHand.update({
        where: { id: hand.id },
        data: { phase: "HAND_COMPLETE", completedAt: new Date(), currentActorPlayerId: null, awardSummary: awards },
      });
      await tx.table.update({ where: { id: table.id }, data: { updatedAt: new Date() } });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function startNextPokerHand(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "startNextPokerHand", input, async () => {
    clearNextHandTimer(input.tableId);
    await prisma.$transaction(async (tx) => {
      const table = await loadPokerTable(tx, input.tableId);
      requireOwner(table, input.actorId);
      const hand = table.currentPokerHand;
      if (!hand || hand.phase !== "HAND_COMPLETE") {
        throw new PhaseConflictError("Start the next hand", hand?.phase ?? "none", "HAND_COMPLETE");
      }
      await tx.pokerHand.update({
        where: { id: hand.id },
        data: { nextHandDeadlineAt: null },
      });
      await createHand(tx, table, input.actorId, hand.dealerPlayerId);
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function scheduleNextPokerHand(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "scheduleNextPokerHand", input, async () => {
    let deadline = new Date(Date.now() + NEXT_HAND_COUNTDOWN_MS);
    await prisma.$transaction(async (tx) => {
      const table = await loadPokerTable(tx, input.tableId);
      requireOwner(table, input.actorId);
      if (table.currentPokerHand?.phase !== "HAND_COMPLETE") {
        throw new PhaseConflictError("Start the next hand", table.currentPokerHand?.phase ?? "none", "HAND_COMPLETE");
      }
      const existing = table.currentPokerHand.nextHandDeadlineAt;
      if (existing && existing.getTime() > Date.now()) {
        deadline = existing;
        return;
      }
      await tx.pokerHand.update({
        where: { id: table.currentPokerHand.id },
        data: { nextHandDeadlineAt: deadline },
      });
      await tx.table.update({ where: { id: table.id }, data: { updatedAt: new Date() } });
    });
    scheduleNextHandTimer(input.tableId, deadline, async (tableId) => {
      try {
        await startNextPokerHand({
          actorId: input.actorId,
          tableId,
          idempotencyKey: `auto-hand:${tableId}:${deadline.toISOString()}`,
        });
      } catch {
        // The hand may already have started from NEXT HAND NOW or a duplicate timer.
      }
    });
    publishTable(input.tableId);
    return { ok: true, deadline: deadline.toISOString() };
  });
}

export async function ensureNextPokerHandIfDue(tableId: string): Promise<void> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: { currentPokerHand: true },
  });
  if (!table?.currentPokerHand?.nextHandDeadlineAt || table.currentPokerHand.phase !== "HAND_COMPLETE") return;
  const deadline = table.currentPokerHand.nextHandDeadlineAt;
  const startDue = async () => {
    try {
      await startNextPokerHand({
        actorId: table.ownerId,
        tableId,
        idempotencyKey: `due-hand:${table.currentPokerHand!.id}`,
      });
    } catch {
      // Already started, or the table left HAND_COMPLETE.
    }
  };
  if (deadline.getTime() > Date.now()) {
    scheduleNextHandTimer(tableId, deadline, async () => {
      await startDue();
    });
    return;
  }
  await startDue();
}

export { amountToCall };
