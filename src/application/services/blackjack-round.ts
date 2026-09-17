import { prisma } from "@/application/db";
import { withIdempotency } from "@/application/idempotency";
import { publishTable } from "@/application/realtime/bus";
import { appendLedger, creditTableAvailable } from "@/application/services/ledger";
import { requireMember, creditStartingJetonsOnce } from "@/application/services/tables";
import {
  applyBankFundingMode,
  parseBankFunding,
  parseCardAssist,
  reserveInsuranceExposure,
  reserveSplitExposure,
  FUNDING_LOCKED,
  roundHasLockedStake,
  settleLimitedBankBox,
  settleLimitedBankInsurance,
  syncBoxExposure,
} from "@/application/services/bankroll";
import { mutateHand, ranksFromJson, suggestedBoxOutcome, suggestedInsuranceResolution } from "@/application/services/card-hands";
import { evaluateHand } from "@/domain/blackjack/cards";
import {
  insuranceMaxMillis,
  insuranceReturnMillis,
  ordinaryReturnMillis,
  outcomeLedgerType,
  type BoxOutcome,
  type InsuranceResolution,
} from "@/domain/blackjack/payouts";
import { assertTransition } from "@/domain/blackjack/transitions";
import { DEAL_COUNTDOWN_MS } from "@/domain/blackjack/deal";
import { ConflictError, DomainError, ForbiddenError, NotFoundError, PhaseConflictError } from "@/domain/errors";
import { formatJetons, parseJetonInput } from "@/domain/money";
import type { Prisma } from "@prisma/client";
import { clearDealTimer, clearNextRoundTimer, scheduleDealTimer, scheduleNextRoundTimer } from "@/application/services/deal-timer";
import { NEXT_ROUND_COUNTDOWN_MS } from "@/domain/blackjack/next-round";
import { logPhaseCommand, logRoundEvent } from "@/application/command-log";

type Tx = Prisma.TransactionClient;

async function loadTableForUpdate(tx: Tx, tableId: string) {
  await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${tableId} FOR UPDATE`;
  const table = await tx.table.findUnique({
    where: { id: tableId },
    include: {
      currentRound: { include: { boxes: true, insuranceBets: true } },
      members: { where: { leftAt: null } },
    },
  });
  if (!table) throw new NotFoundError("Table not found.");
  if (table.game !== "BLACKJACK") {
    throw new DomainError("GAME_CONFLICT", "This command is only available during Blackjack.");
  }
  if (table.status === "ARCHIVED") {
    throw new DomainError("TABLE_CLOSED", "This table is closed.");
  }
  if (table.currentRound && table.currentPhase !== table.currentRound.phase) {
    logPhaseCommand({
      command: "alignTablePhase",
      tableId: table.id,
      roundId: table.currentRound.id,
      actorId: "system",
      requested: table.currentRound.phase,
      phase: table.currentPhase,
      roundStatus: table.currentRound.phase,
      code: "PHASE_ALIGNED",
    });
    await tx.table.update({
      where: { id: table.id },
      data: { currentPhase: table.currentRound.phase },
    });
    table.currentPhase = table.currentRound.phase;
  }
  return table;
}

function requireBank(table: { bankDealerId: string | null }, actorId: string) {
  if (table.bankDealerId !== actorId) {
    throw new ForbiddenError("Only the Bank/Dealer can do that.");
  }
}

function requirePhase(actual: string, expected: string, action = "This action") {
  if (actual !== expected) {
    throw new PhaseConflictError(action, actual, expected);
  }
}

async function lockMember(tx: Tx, tableId: string, userId: string) {
  const member = await tx.tableMember.findUnique({
    where: { tableId_userId: { tableId, userId } },
  });
  if (!member || member.leftAt) {
    throw new ForbiddenError("You are not sitting at this table.");
  }
  return member;
}

function nextBoxNumber(boxes: { playerId: string; boxNumber: number; removedAt: Date | null }[], playerId: string) {
  const numbers = boxes
    .filter((box) => box.playerId === playerId && !box.removedAt)
    .map((box) => box.boxNumber);
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
}

function assertBetLimits(
  resulting: bigint,
  minBet: bigint | null,
  maxBet: bigint | null,
) {
  if (minBet !== null && resulting < minBet && resulting !== 0n) {
    throw new DomainError("BELOW_MINIMUM", `The minimum bet is ${formatJetons(minBet)} jetons.`);
  }
  if (maxBet !== null && resulting > maxBet) {
    throw new DomainError("ABOVE_MAXIMUM", `The maximum bet is ${formatJetons(maxBet)} jetons.`);
  }
}

function hasValidBet(boxes: { removedAt: Date | null; lockedBetMillis: bigint }[]): boolean {
  return boxes.some((box) => !box.removedAt && box.lockedBetMillis > 0n);
}

function liveBoxes(table: { currentRound?: { boxes: { removedAt: Date | null; lockedBetMillis: bigint }[] } | null }) {
  return table.currentRound?.boxes.filter((box) => !box.removedAt) ?? [];
}

function phaseEvidence(
  table: {
    id: string;
    currentPhase: string;
    currentRound?: {
      id: string;
      phase: string;
      boxes: { removedAt: Date | null; lockedBetMillis: bigint; settledKey: string | null }[];
      insuranceBets: { settledKey: string | null }[];
      insuranceWindow: string;
      bettingCloseDeadlineAt: Date | null;
      nextRoundDeadlineAt: Date | null;
    } | null;
  },
) {
  const boxes = liveBoxes(table);
  const blockers = table.currentRound
    ? roundBlockers(table.currentRound)
    : { unresolvedBoxes: 0, unresolvedInsurance: 0 };
  return {
    tableId: table.id,
    roundId: table.currentRound?.id ?? null,
    phase: table.currentPhase,
    roundStatus: table.currentRound?.phase ?? null,
    betCount: boxes.filter((box) => box.lockedBetMillis > 0n).length,
    unresolvedBoxes: blockers.unresolvedBoxes,
    unresolvedInsurance: blockers.unresolvedInsurance,
    bettingDeadline: table.currentRound?.bettingCloseDeadlineAt?.toISOString() ?? null,
    nextRoundDeadline: table.currentRound?.nextRoundDeadlineAt?.toISOString() ?? null,
  };
}

async function transitionBettingToPlaying(
  tx: Tx,
  table: Awaited<ReturnType<typeof loadTableForUpdate>>,
): Promise<boolean> {
  if (table.currentPhase !== "BETTING" || !table.currentRound) return false;
  if (!hasValidBet(table.currentRound.boxes)) {
    await tx.round.update({
      where: { id: table.currentRound.id },
      data: { bettingCloseDeadlineAt: null },
    });
    return false;
  }
  assertTransition("BETTING", "PLAYING");
  await tx.bettingBox.updateMany({
    where: { roundId: table.currentRound.id, lockedBetMillis: 0n, removedAt: null },
    data: { removedAt: new Date() },
  });
  await tx.round.update({
    where: { id: table.currentRound.id },
    data: { phase: "PLAYING", bettingClosedAt: new Date(), bettingCloseDeadlineAt: null },
  });
  await tx.table.update({
    where: { id: table.id },
    data: { currentPhase: "PLAYING" },
  });
  return true;
}

export async function ensureBettingClosedIfDue(tableId: string): Promise<boolean> {
  const peek = await prisma.table.findUnique({ where: { id: tableId }, select: { game: true } });
  if (peek?.game !== "BLACKJACK") return false;
  try {
    const closed = await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, tableId);
      if (table.currentPhase !== "BETTING" || !table.currentRound?.bettingCloseDeadlineAt) {
        return false;
      }
      if (table.currentRound.bettingCloseDeadlineAt.getTime() > Date.now()) {
        return false;
      }
      return transitionBettingToPlaying(tx, table);
    });
    if (closed) {
      clearDealTimer(tableId);
      publishTable(tableId);
    }
    return closed;
  } catch (error) {
    if (error instanceof DomainError && error.code === "GAME_CONFLICT") return false;
    throw error;
  }
}

export async function startBetting(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "startBetting", input, async () => {
    const opened = await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      const evidence = phaseEvidence(table);
      if (table.currentPhase === "BETTING" && table.currentRound?.phase === "BETTING") {
        logPhaseCommand({
          command: "startBetting",
          actorId: input.actorId,
          requested: "BETTING",
          ...evidence,
          code: "ALREADY_BETTING",
        });
        return { created: false, roundId: table.currentRound.id };
      }
      const orphanedBetting = table.currentPhase === "BETTING" && !table.currentRound;
      if (table.currentPhase !== "TABLE_SETUP" && table.currentPhase !== "ROUND_COMPLETE" && !orphanedBetting) {
        logPhaseCommand({
          command: "startBetting",
          actorId: input.actorId,
          requested: "BETTING",
          ...evidence,
          code: "PHASE_CONFLICT",
        });
        throw new PhaseConflictError("OPEN BETTING", table.currentPhase, "TABLE_SETUP or ROUND_COMPLETE");
      }
      if (!orphanedBetting) {
        assertTransition(table.currentPhase, "BETTING");
      }
      logPhaseCommand({
        command: "startBetting",
        actorId: input.actorId,
        requested: "BETTING",
        ...evidence,
        code: "OPENING_BETTING",
      });
      if (!table.bankDealerId) {
        throw new DomainError("NO_BANK", "Assign a Bank/Dealer before opening betting.");
      }
      const participating = table.members.filter((member) => member.userId !== table.bankDealerId);
      if (participating.length === 0) {
        throw new DomainError("NO_PLAYERS", "At least one player must join before betting opens.");
      }
      for (const member of participating) {
        await creditStartingJetonsOnce(tx, {
          tableId: table.id,
          memberId: member.id,
          userId: member.userId,
          actorId: input.actorId,
          startingJetonsPerPlayerMillis: table.startingJetonsPerPlayerMillis,
          isBankDealer: false,
        });
      }
      for (const member of table.members) {
        if (member.availableMillis < 0n) {
          throw new DomainError("NEGATIVE_BALANCE", "Every player must have a non-negative table balance.");
        }
      }
      const roundCount = await tx.round.count({ where: { tableId: table.id } });
      if (table.currentRoundId) {
        await tx.round.update({
          where: { id: table.currentRoundId },
          data: { nextRoundDeadlineAt: null },
        });
      }
      const round = await tx.round.create({
        data: {
          tableId: table.id,
          number: roundCount + 1,
          phase: "BETTING",
        },
      });
      for (const member of participating) {
        await tx.bettingBox.create({
          data: {
            roundId: round.id,
            playerId: member.userId,
            boxNumber: 1,
            displayLabel: "YOUR BOX 1",
          },
        });
      }
      await tx.table.update({
        where: { id: table.id },
        data: {
          currentPhase: "BETTING",
          currentRoundId: round.id,
          status: "ACTIVE",
          pausedAt: null,
        },
      });
      return { created: true, roundId: round.id };
    });
    clearNextRoundTimer(input.tableId);
    publishTable(input.tableId);
    logPhaseCommand({
      command: "startBetting",
      tableId: input.tableId,
      roundId: opened.roundId,
      actorId: input.actorId,
      requested: "BETTING",
      phase: "BETTING",
      roundStatus: "BETTING",
      code: opened.created ? "BETTING" : "ALREADY_BETTING",
    });
    return { ok: true, phase: "BETTING" as const, roundId: opened.roundId };
  });
}

export async function addBox(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "addBox", input, async () => {
    await requireMember(input.tableId, input.actorId);
    const boxId = await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requirePhase(table.currentPhase, "BETTING", "Adding a box");
      if (!table.currentRound) throw new ConflictError("Betting is not open.");
      if (table.bankDealerId === input.actorId && table.members.length > 1) {
        throw new ForbiddenError("The Bank/Dealer does not open betting boxes.");
      }
      const ownPrimary = table.currentRound.boxes.filter(
        (item) => item.playerId === input.actorId && !item.removedAt && !item.isSplitOffshoot,
      );
      if (ownPrimary.length >= table.maxBoxesPerPlayer) {
        throw new DomainError("MAX_BOXES", `This table allows at most ${table.maxBoxesPerPlayer} boxes per player.`);
      }
      const number = nextBoxNumber(table.currentRound.boxes, input.actorId);
      const box = await tx.bettingBox.create({
        data: {
          roundId: table.currentRound.id,
          playerId: input.actorId,
          boxNumber: number,
          displayLabel: `YOUR BOX ${number}`,
        },
      });
      return box.id;
    });
    publishTable(input.tableId);
    return { boxId };
  });
}

export async function removeBox(input: { actorId: string; tableId: string; boxId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "removeBox", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requirePhase(table.currentPhase, "BETTING", "Removing a box");
      const box = table.currentRound?.boxes.find((item) => item.id === input.boxId);
      if (!box || box.playerId !== input.actorId) {
        throw new ForbiddenError("You can only remove your own empty box.");
      }
      if (box.lockedBetMillis > 0n) {
        throw new DomainError("BOX_HAS_BET", "Retract the bet before removing this box.");
      }
      const remaining = table.currentRound!.boxes.filter(
        (item) => item.playerId === input.actorId && !item.removedAt && item.id !== box.id,
      );
      if (remaining.length === 0) {
        throw new DomainError("LAST_BOX", "Keep at least one box while betting is open.");
      }
      await tx.bettingBox.update({
        where: { id: box.id },
        data: { removedAt: new Date() },
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function placeOrRetractBet(input: {
  actorId: string;
  tableId: string;
  boxId: string;
  amount: string;
  mode: "SET" | "ADD" | "RETRACT";
  idempotencyKey: string;
}) {
  const amount = parseJetonInput(input.amount);
  return withIdempotency(input.actorId, input.idempotencyKey, "placeOrRetractBet", input, async () => {
    await ensureBettingClosedIfDue(input.tableId);
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      if (table.currentPhase !== "BETTING") {
        throw new PhaseConflictError("Betting", table.currentPhase, "BETTING");
      }
      const deadline = table.currentRound?.bettingCloseDeadlineAt;
      if (deadline && deadline.getTime() <= Date.now()) {
        throw new ConflictError("Betting is not open yet");
      }
      if (table.bankDealerId === input.actorId) {
        throw new ForbiddenError("You are not a Player at this table");
      }
      if (!input.boxId || input.boxId === "undefined") {
        throw new DomainError("CHOOSE_BOX", "Choose a betting box first");
      }
      const box = table.currentRound?.boxes.find((item) => item.id === input.boxId && !item.removedAt);
      if (!box) {
        throw new DomainError("CHOOSE_BOX", "Choose a betting box first");
      }
      if (box.playerId !== input.actorId) {
        throw new ForbiddenError("You are not a Player at this table");
      }
      const member = await lockMember(tx, table.id, input.actorId);
      let nextLocked = box.lockedBetMillis;
      if (input.mode === "SET") nextLocked = amount;
      if (input.mode === "ADD") nextLocked = box.lockedBetMillis + amount;
      if (input.mode === "RETRACT") {
        if (amount > box.lockedBetMillis) {
          throw new DomainError("RETRACT_TOO_LARGE", "You cannot retract more than this box holds.");
        }
        nextLocked = box.lockedBetMillis - amount;
      }
      const delta = nextLocked - box.lockedBetMillis;
      if (delta === 0n) return;
      assertBetLimits(nextLocked, table.minBetMillis, table.maxBetMillis);
      if (delta > 0n) {
        await syncBoxExposure(tx, {
          table,
          actorId: input.actorId,
          boxId: box.id,
          currentReserved: box.exposureReservedMillis,
          nextStake: nextLocked,
          idempotencyKey: input.idempotencyKey,
          label: `box ${box.boxNumber}`,
        });
      }
      const { before, after } = await creditTableAvailable(tx, member.id, -delta);
      await tx.bettingBox.update({
        where: { id: box.id },
        data: {
          lockedBetMillis: nextLocked,
          originalStakeMillis: nextLocked,
        },
      });
      await appendLedger(tx, {
        playerId: input.actorId,
        actorId: input.actorId,
        tableId: table.id,
        roundId: table.currentRound!.id,
        boxId: box.id,
        transactionType: delta > 0n ? "BET_LOCKED" : "BET_RETRACTED",
        amountMillis: delta > 0n ? delta : -delta,
        balanceBeforeMillis: before,
        balanceAfterMillis: after,
        idempotencyKey: `${input.idempotencyKey}:ledger`,
        description:
          delta > 0n
            ? `Locked ${formatJetons(delta)} jetons on box ${box.boxNumber}`
            : `Returned ${formatJetons(-delta)} jetons from box ${box.boxNumber}`,
      });
      if (delta < 0n) {
        await syncBoxExposure(tx, {
          table,
          actorId: input.actorId,
          boxId: box.id,
          currentReserved: box.exposureReservedMillis,
          nextStake: nextLocked,
          idempotencyKey: input.idempotencyKey,
          label: `box ${box.boxNumber}`,
        });
      }
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function scheduleDeal(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "scheduleDeal", input, async () => {
    const result = await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      requirePhase(table.currentPhase, "BETTING", "DEAL IN 7 SECONDS");
      const round = table.currentRound;
      if (!round) throw new ConflictError("No open round.");
      if (!hasValidBet(round.boxes)) {
        throw new DomainError("NO_BETS", "At least one player must place a bet first.");
      }
      if (round.bettingCloseDeadlineAt && round.bettingCloseDeadlineAt.getTime() > Date.now()) {
        return { deadline: round.bettingCloseDeadlineAt.toISOString() };
      }
      const deadline = new Date(Date.now() + DEAL_COUNTDOWN_MS);
      await tx.round.update({
        where: { id: round.id },
        data: { bettingCloseDeadlineAt: deadline },
      });
      return { deadline: deadline.toISOString() };
    });
    scheduleDealTimer(input.tableId, new Date(result.deadline), async (tableId) => {
      await ensureBettingClosedIfDue(tableId);
    });
    publishTable(input.tableId);
    logPhaseCommand({
      command: "scheduleDeal",
      tableId: input.tableId,
      actorId: input.actorId,
      requested: "BETTING_CLOSE",
      phase: "BETTING",
      roundStatus: "BETTING",
      bettingDeadline: result.deadline,
      code: "DEAL_SCHEDULED",
    });
    return result;
  });
}

export async function dealCards(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "dealCards", input, async () => {
    const result = await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      const evidence = phaseEvidence(table);
      if (table.currentPhase === "PLAYING" && table.currentRound?.phase === "PLAYING") {
        logPhaseCommand({
          command: "dealCards",
          actorId: input.actorId,
          requested: "PLAYING",
          ...evidence,
          code: "ALREADY_PLAYING",
        });
        return { already: true, roundId: table.currentRound.id };
      }
      if (table.currentPhase !== "BETTING" || table.currentRound?.phase !== "BETTING") {
        logPhaseCommand({
          command: "dealCards",
          actorId: input.actorId,
          requested: "PLAYING",
          ...evidence,
          code: "PHASE_CONFLICT",
        });
        throw new PhaseConflictError("DEAL CARDS NOW", table.currentPhase, "BETTING");
      }
      if (!table.currentRound) throw new DomainError("NO_ROUND", "No open betting round.");
      if (!hasValidBet(table.currentRound.boxes)) {
        logPhaseCommand({
          command: "dealCards",
          actorId: input.actorId,
          requested: "PLAYING",
          ...evidence,
          code: "NO_BETS",
        });
        throw new DomainError("NO_BETS", "At least one player must place a bet first.");
      }
      const moved = await transitionBettingToPlaying(tx, table);
      if (!moved) {
        logPhaseCommand({
          command: "dealCards",
          actorId: input.actorId,
          requested: "PLAYING",
          ...evidence,
          code: "NO_BETS",
        });
        throw new DomainError("NO_BETS", "At least one player must place a bet first.");
      }
      logPhaseCommand({
        command: "dealCards",
        actorId: input.actorId,
        requested: "PLAYING",
        ...evidence,
        phase: "PLAYING",
        roundStatus: "PLAYING",
        bettingDeadline: null,
        code: "PLAYING",
      });
      return { already: false, roundId: table.currentRound.id };
    });
    clearDealTimer(input.tableId);
    publishTable(input.tableId);
    return { ok: true, phase: "PLAYING" as const, roundId: result.roundId };
  });
}

export async function doubleBox(input: { actorId: string; tableId: string; boxId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "doubleBox", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requirePhase(table.currentPhase, "PLAYING");
      const box = table.currentRound?.boxes.find((item) => item.id === input.boxId && !item.removedAt);
      if (!box || box.playerId !== input.actorId) {
        throw new ForbiddenError("You can only double your own box.");
      }
      if (box.isDoubled) {
        throw new ConflictError("This box has already been doubled.");
      }
      if (box.lockedBetMillis <= 0n) {
        throw new DomainError("NO_STAKE", "There is no stake to double.");
      }
      const additional = box.lockedBetMillis;
      await syncBoxExposure(tx, {
        table,
        actorId: input.actorId,
        boxId: box.id,
        currentReserved: box.exposureReservedMillis,
        nextStake: box.lockedBetMillis + additional,
        idempotencyKey: input.idempotencyKey,
        label: `doubled box ${box.boxNumber}`,
      });
      const member = await lockMember(tx, table.id, input.actorId);
      const { before, after } = await creditTableAvailable(tx, member.id, -additional);
      await tx.bettingBox.update({
        where: { id: box.id },
        data: {
          lockedBetMillis: box.lockedBetMillis + additional,
          isDoubled: true,
        },
      });
      await appendLedger(tx, {
        playerId: input.actorId,
        actorId: input.actorId,
        tableId: table.id,
        roundId: table.currentRound!.id,
        boxId: box.id,
        transactionType: "DOUBLE_LOCKED",
        amountMillis: additional,
        balanceBeforeMillis: before,
        balanceAfterMillis: after,
        idempotencyKey: `${input.idempotencyKey}:ledger`,
        description: `Doubled box ${box.boxNumber}`,
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function splitBox(input: { actorId: string; tableId: string; boxId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "splitBox", input, async () => {
    const newBoxId = await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requirePhase(table.currentPhase, "PLAYING");
      const box = table.currentRound?.boxes.find((item) => item.id === input.boxId && !item.removedAt);
      if (!box || box.playerId !== input.actorId) {
        throw new ForbiddenError("You can only split your own box.");
      }
      if (box.lockedBetMillis <= 0n) {
        throw new DomainError("NO_STAKE", "There is no stake to split.");
      }
      const stake = box.lockedBetMillis;
      const number = nextBoxNumber(table.currentRound!.boxes, input.actorId);
      const created = await tx.bettingBox.create({
        data: {
          roundId: table.currentRound!.id,
          playerId: input.actorId,
          boxNumber: number,
          displayLabel: `SPLIT BOX ${box.boxNumber}A`,
          parentBoxId: box.id,
          originalStakeMillis: box.originalStakeMillis,
          lockedBetMillis: stake,
          isSplitOffshoot: true,
        },
      });
      await reserveSplitExposure(tx, {
        table,
        actorId: input.actorId,
        boxId: created.id,
        stake,
        idempotencyKey: input.idempotencyKey,
        label: `split box ${number}`,
      });
      const member = await lockMember(tx, table.id, input.actorId);
      const { before, after } = await creditTableAvailable(tx, member.id, -stake);
      await appendLedger(tx, {
        playerId: input.actorId,
        actorId: input.actorId,
        tableId: table.id,
        roundId: table.currentRound!.id,
        boxId: created.id,
        transactionType: "SPLIT_LOCKED",
        amountMillis: stake,
        balanceBeforeMillis: before,
        balanceAfterMillis: after,
        idempotencyKey: `${input.idempotencyKey}:ledger`,
        description: `Split box ${box.boxNumber} into box ${number}`,
      });
      return created.id;
    });
    publishTable(input.tableId);
    return { boxId: newBoxId };
  });
}

export async function openInsurance(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "openInsurance", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      requirePhase(table.currentPhase, "PLAYING");
      if (!table.insuranceEnabled) {
        throw new DomainError("INSURANCE_DISABLED", "Insurance is not enabled at this table.");
      }
      if (!table.currentRound) throw new ConflictError("No open round.");
      if (table.currentRound.insuranceWindow === "SETTLED") {
        throw new ConflictError("Insurance for this round is already settled.");
      }
      await tx.round.update({
        where: { id: table.currentRound.id },
        data: { insuranceWindow: "OPEN" },
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function closeInsurance(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "closeInsurance", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      requirePhase(table.currentPhase, "PLAYING");
      if (table.currentRound?.insuranceWindow !== "OPEN") {
        throw new ConflictError("The Insurance window is not open.");
      }
      await tx.round.update({
        where: { id: table.currentRound.id },
        data: { insuranceWindow: "CLOSED" },
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function buyInsurance(input: {
  actorId: string;
  tableId: string;
  boxId: string;
  amount: string;
  idempotencyKey: string;
}) {
  const amount = parseJetonInput(input.amount);
  if (amount <= 0n) {
    throw new DomainError("INVALID_AMOUNT", "Choose an Insurance amount greater than zero.");
  }
  return withIdempotency(input.actorId, input.idempotencyKey, "buyInsurance", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requirePhase(table.currentPhase, "PLAYING");
      if (!table.insuranceEnabled) {
        throw new DomainError("INSURANCE_DISABLED", "Insurance is not enabled at this table.");
      }
      if (table.currentRound?.insuranceWindow !== "OPEN") {
        throw new DomainError("INSURANCE_CLOSED", "Insurance is only available while the Bank has opened the event.");
      }
      const box = table.currentRound.boxes.find((item) => item.id === input.boxId && !item.removedAt);
      if (!box || box.playerId !== input.actorId) {
        throw new ForbiddenError("You can only buy Insurance for your own box.");
      }
      const existing = table.currentRound.insuranceBets.find((bet) => bet.boxId === box.id);
      if (existing) {
        throw new ConflictError("This box already has Insurance.");
      }
      const max = insuranceMaxMillis(box.originalStakeMillis || box.lockedBetMillis);
      if (amount > max) {
        throw new DomainError("INSURANCE_MAX", `Insurance cannot exceed ${formatJetons(max)} jetons.`);
      }
      const insurance = await tx.insuranceBet.create({
        data: {
          roundId: table.currentRound.id,
          playerId: input.actorId,
          boxId: box.id,
          amountMillis: amount,
        },
      });
      await reserveInsuranceExposure(tx, {
        table,
        actorId: input.actorId,
        insuranceBetId: insurance.id,
        insuranceStake: amount,
        idempotencyKey: input.idempotencyKey,
        label: `Insurance on box ${box.boxNumber}`,
      });
      const member = await lockMember(tx, table.id, input.actorId);
      const { before, after } = await creditTableAvailable(tx, member.id, -amount);
      await appendLedger(tx, {
        playerId: input.actorId,
        actorId: input.actorId,
        tableId: table.id,
        roundId: table.currentRound.id,
        boxId: box.id,
        insuranceBetId: insurance.id,
        transactionType: "INSURANCE_LOCKED",
        amountMillis: amount,
        balanceBeforeMillis: before,
        balanceAfterMillis: after,
        idempotencyKey: `${input.idempotencyKey}:ledger`,
        description: `Locked ${formatJetons(amount)} jetons as Insurance on box ${box.boxNumber}`,
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

async function settleBoxInTx(
  tx: Tx,
  input: {
    table: Awaited<ReturnType<typeof loadTableForUpdate>>;
    actorId: string;
    box: NonNullable<Awaited<ReturnType<typeof loadTableForUpdate>>["currentRound"]>["boxes"][number];
    outcome: BoxOutcome;
    idempotencyKey: string;
  },
) {
  const { table, box } = input;
  const updated = await tx.bettingBox.updateMany({
    where: { id: box.id, settledKey: null },
    data: {
      outcome: input.outcome,
      settledAt: new Date(),
      settledKey: box.id,
      returnedMillis: ordinaryReturnMillis(box.lockedBetMillis, input.outcome, table.blackjackPayout),
    },
  });
  if (updated.count !== 1) {
    throw new ConflictError("This box has already been settled.");
  }
  const returned = ordinaryReturnMillis(box.lockedBetMillis, input.outcome, table.blackjackPayout);
  const member = await lockMember(tx, table.id, box.playerId);
  const { before, after } = await creditTableAvailable(tx, member.id, returned);
  await tx.bettingBox.update({
    where: { id: box.id },
    data: { lockedBetMillis: 0n },
  });
  await appendLedger(tx, {
    playerId: box.playerId,
    actorId: input.actorId,
    tableId: table.id,
    roundId: table.currentRound!.id,
    boxId: box.id,
    transactionType: outcomeLedgerType(input.outcome),
    amountMillis: input.outcome === "LOST" ? box.lockedBetMillis : returned,
    balanceBeforeMillis: before,
    balanceAfterMillis: after,
    idempotencyKey: `${input.idempotencyKey}:ledger`,
    description: `Box ${box.boxNumber} ${input.outcome.toLowerCase()} · return ${formatJetons(returned)}`,
  });
  await settleLimitedBankBox(tx, {
    table,
    actorId: input.actorId,
    boxId: box.id,
    stake: box.lockedBetMillis,
    reserved: box.exposureReservedMillis,
    outcome: input.outcome,
    idempotencyKey: input.idempotencyKey,
    label: `box ${box.boxNumber}`,
  });
}

async function settleInsuranceInTx(
  tx: Tx,
  input: {
    table: Awaited<ReturnType<typeof loadTableForUpdate>>;
    actorId: string;
    resolution: InsuranceResolution;
    idempotencyKey: string;
  },
) {
  const round = input.table.currentRound;
  if (!round) throw new ConflictError("No open round.");
  if (round.insuranceWindow === "SETTLED") {
    throw new ConflictError("Insurance is already settled.");
  }
  if (round.insuranceBets.length === 0) {
    await tx.round.update({
      where: { id: round.id },
      data: {
        insuranceWindow: "SETTLED",
        insuranceResolution: input.resolution,
      },
    });
    return;
  }
  for (const bet of round.insuranceBets) {
    const returned = insuranceReturnMillis(bet.amountMillis, input.resolution);
    const updated = await tx.insuranceBet.updateMany({
      where: { id: bet.id, settledKey: null },
      data: {
        resolution: input.resolution,
        returnedMillis: returned,
        settledAt: new Date(),
        settledKey: bet.id,
      },
    });
    if (updated.count !== 1) continue;
    const member = await lockMember(tx, input.table.id, bet.playerId);
    const { before, after } = await creditTableAvailable(tx, member.id, returned);
    await appendLedger(tx, {
      playerId: bet.playerId,
      actorId: input.actorId,
      tableId: input.table.id,
      roundId: round.id,
      boxId: bet.boxId,
      insuranceBetId: bet.id,
      transactionType: input.resolution === "DEALER_BLACKJACK" ? "INSURANCE_WIN_RETURN" : "INSURANCE_LOSS",
      amountMillis: input.resolution === "DEALER_BLACKJACK" ? returned : bet.amountMillis,
      balanceBeforeMillis: before,
      balanceAfterMillis: after,
      idempotencyKey: `${input.idempotencyKey}:ledger:${bet.id}`,
      description:
        input.resolution === "DEALER_BLACKJACK"
          ? `Insurance won · return ${formatJetons(returned)}`
          : "Insurance lost",
    });
    await settleLimitedBankInsurance(tx, {
      table: input.table,
      actorId: input.actorId,
      insuranceBetId: bet.id,
      boxId: bet.boxId,
      stake: bet.amountMillis,
      reserved: bet.exposureReservedMillis,
      resolution: input.resolution,
      idempotencyKey: `${input.idempotencyKey}:${bet.id}`,
    });
  }
  await tx.round.update({
    where: { id: round.id },
    data: {
      insuranceWindow: "SETTLED",
      insuranceResolution: input.resolution,
    },
  });
}

function handIsComplete(ranks: unknown, completedAt: Date | null, isSplitOffshoot = false): boolean {
  if (completedAt) return true;
  const parsed = ranksFromJson(ranks);
  return parsed.length > 0 && evaluateHand(parsed, isSplitOffshoot).bust;
}

async function autoSettleCompleteHands(
  tx: Tx,
  table: Awaited<ReturnType<typeof loadTableForUpdate>>,
  actorId: string,
  idempotencyKey: string,
) {
  const round = table.currentRound;
  if (!round || table.cardAssist !== "AUTO") return;
  const dealerRanks = ranksFromJson(round.dealerRanks);
  const dealerDone = handIsComplete(round.dealerRanks, round.dealerCompletedAt);
  if (dealerDone) {
    for (const box of round.boxes.filter((item) => !item.removedAt && !item.settledKey)) {
      if (!handIsComplete(box.ranks, box.handCompletedAt, box.isSplitOffshoot)) continue;
      const outcome = suggestedBoxOutcome(ranksFromJson(box.ranks), dealerRanks, box.isSplitOffshoot);
      if (!outcome) continue;
      await settleBoxInTx(tx, {
        table,
        actorId,
        box,
        outcome,
        idempotencyKey: `${idempotencyKey}:auto:${box.id}`,
      });
    }
  }
  if (dealerRanks.length >= 2 && round.insuranceWindow !== "SETTLED") {
    const resolution = suggestedInsuranceResolution(dealerRanks);
    if (resolution) {
      try {
        await settleInsuranceInTx(tx, {
          table,
          actorId,
          resolution,
          idempotencyKey: `${idempotencyKey}:auto-insurance`,
        });
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
      }
    }
  }
}

export async function enterPayout(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "enterPayout", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      const evidence = phaseEvidence(table);
      if (table.currentPhase === "PAYOUT" && table.currentRound?.phase === "PAYOUT") {
        logPhaseCommand({
          command: "enterPayout",
          actorId: input.actorId,
          requested: "PAYOUT",
          ...evidence,
          code: "ALREADY_PAYOUT",
        });
        return;
      }
      requirePhase(table.currentPhase, "PLAYING", "PAYOUT PHASE");
      assertTransition("PLAYING", "PAYOUT");
      if (table.currentRound?.insuranceWindow === "OPEN") {
        await tx.round.update({
          where: { id: table.currentRound.id },
          data: { insuranceWindow: "CLOSED" },
        });
      }
      await tx.round.update({
        where: { id: table.currentRound!.id },
        data: { phase: "PAYOUT", payoutEnteredAt: new Date() },
      });
      await tx.table.update({
        where: { id: table.id },
        data: { currentPhase: "PAYOUT" },
      });
      table.currentPhase = "PAYOUT";
      if (table.currentRound) table.currentRound.phase = "PAYOUT";
      await autoSettleCompleteHands(tx, table, input.actorId, input.idempotencyKey);
      logPhaseCommand({
        command: "enterPayout",
        actorId: input.actorId,
        requested: "PAYOUT",
        ...evidence,
        phase: "PAYOUT",
        roundStatus: "PAYOUT",
        code: "PAYOUT",
      });
    });
    await maybeCompleteRound(input.tableId);
    publishTable(input.tableId);
    return { ok: true, phase: "PAYOUT" as const };
  });
}

export async function settleBox(input: {
  actorId: string;
  tableId: string;
  boxId: string;
  outcome: BoxOutcome;
  idempotencyKey: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "settleBox", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      requirePhase(table.currentPhase, "PAYOUT");
      const box = table.currentRound?.boxes.find((item) => item.id === input.boxId && !item.removedAt);
      if (!box) throw new NotFoundError("Box not found.");
      await settleBoxInTx(tx, {
        table,
        actorId: input.actorId,
        box,
        outcome: input.outcome,
        idempotencyKey: input.idempotencyKey,
      });
    });
    await maybeCompleteRound(input.tableId);
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function settleInsurance(input: {
  actorId: string;
  tableId: string;
  resolution: InsuranceResolution;
  idempotencyKey: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "settleInsurance", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      requirePhase(table.currentPhase, "PAYOUT");
      await settleInsuranceInTx(tx, {
        table,
        actorId: input.actorId,
        resolution: input.resolution,
        idempotencyKey: input.idempotencyKey,
      });
    });
    await maybeCompleteRound(input.tableId);
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function mutateCards(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  boxId?: string;
  dealer?: boolean;
  action: "ADD" | "REMOVE" | "COMPLETE" | "REOPEN" | "CLEAR";
  rank?: string;
  index?: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "mutateCards", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      await mutateHand(tx, {
        actorId: input.actorId,
        table,
        boxId: input.boxId,
        dealer: input.dealer,
        action: input.action,
        rank: input.rank,
        index: input.index === undefined ? undefined : Number.parseInt(input.index, 10),
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function applyCardOutcome(input: {
  actorId: string;
  tableId: string;
  boxId: string;
  idempotencyKey: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "applyCardOutcome", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      requirePhase(table.currentPhase, "PAYOUT");
      const round = table.currentRound;
      if (!round) throw new ConflictError("No open round.");
      const box = round.boxes.find((item) => item.id === input.boxId && !item.removedAt);
      if (!box) throw new NotFoundError("Box not found.");
      if (!handIsComplete(box.ranks, box.handCompletedAt, box.isSplitOffshoot) || !handIsComplete(round.dealerRanks, round.dealerCompletedAt)) {
        throw new DomainError("HAND_INCOMPLETE", "Complete both hands before applying the suggestion.");
      }
      const outcome = suggestedBoxOutcome(ranksFromJson(box.ranks), ranksFromJson(round.dealerRanks), box.isSplitOffshoot);
      if (!outcome) {
        throw new DomainError("NO_SUGGESTION", "There is not enough card information to apply.");
      }
      await settleBoxInTx(tx, {
        table,
        actorId: input.actorId,
        box,
        outcome,
        idempotencyKey: input.idempotencyKey,
      });
    });
    await maybeCompleteRound(input.tableId);
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function applyInsuranceSuggestion(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "applyInsuranceSuggestion", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      requirePhase(table.currentPhase, "PAYOUT");
      const resolution = suggestedInsuranceResolution(ranksFromJson(table.currentRound?.dealerRanks));
      if (!resolution) {
        throw new DomainError("NO_SUGGESTION", "Enter the Dealer’s first two cards before applying Insurance.");
      }
      await settleInsuranceInTx(tx, {
        table,
        actorId: input.actorId,
        resolution,
        idempotencyKey: input.idempotencyKey,
      });
    });
    await maybeCompleteRound(input.tableId);
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function setCardAssist(input: {
  actorId: string;
  tableId: string;
  cardAssist: string;
  idempotencyKey: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "setCardAssist", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      if (table.currentPhase !== "TABLE_SETUP" && table.currentPhase !== "BETTING") {
        throw new DomainError("CARDS_LOCKED", "Card Assist can only change during TABLE SETUP or unstaked BETTING.");
      }
      if (table.currentPhase === "BETTING" && roundHasLockedStake(table.currentRound)) {
        throw new DomainError("CARDS_LOCKED", "Card Assist is locked after a stake is placed.");
      }
      await tx.table.update({
        where: { id: table.id },
        data: { cardAssist: parseCardAssist(input.cardAssist, table.cardAssist) },
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function setBankFunding(input: {
  actorId: string;
  tableId: string;
  bankFundingMode: string;
  startingBank?: string;
  idempotencyKey: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "setBankFunding", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      if (table.currentPhase !== "TABLE_SETUP" && table.currentPhase !== "BETTING") {
        throw new DomainError("FUNDING_LOCKED", "Funding mode can only change during TABLE SETUP or unstaked BETTING.");
      }
      if (table.currentPhase === "BETTING" && roundHasLockedStake(table.currentRound)) {
        throw new DomainError("FUNDING_LOCKED", FUNDING_LOCKED);
      }
      await applyBankFundingMode(tx, {
        table,
        actorId: input.actorId,
        mode: parseBankFunding(input.bankFundingMode, table.bankFundingMode),
        startingBank: input.startingBank,
        idempotencyKey: input.idempotencyKey,
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function startNextRound(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "startNextRound", input, async () => {
    await maybeCompleteRound(input.tableId);
    const table = await prisma.$transaction(async (tx) => loadTableForUpdate(tx, input.tableId));
    requireBank(table, input.actorId);
    const evidence = phaseEvidence(table);
    const blockers = table.currentRound
      ? roundBlockers(table.currentRound)
      : { unresolvedBoxes: 0, unresolvedInsurance: 0 };
    logPhaseCommand({
      command: "startNextRound",
      actorId: input.actorId,
      requested: "BETTING",
      ...evidence,
      code: table.currentPhase === "BETTING" ? "ALREADY_BETTING" : table.currentPhase,
    });
    logRoundEvent({
      event: "startNextRound",
      tableId: input.tableId,
      roundId: table.currentRound?.id,
      actorId: input.actorId,
      phase: table.currentPhase,
      unresolvedBoxes: blockers.unresolvedBoxes,
      unresolvedInsurance: blockers.unresolvedInsurance,
      deadline: table.currentRound?.nextRoundDeadlineAt?.toISOString() ?? null,
      code: table.currentPhase === "BETTING" ? "ALREADY_BETTING" : table.currentPhase,
    });
    if (table.currentPhase === "BETTING" && table.currentRound?.phase === "BETTING") {
      return { ok: true, phase: "BETTING" as const, roundId: table.currentRound.id };
    }
    if (table.currentPhase !== "ROUND_COMPLETE") {
      const code = "NEXT_ROUND_BLOCKED";
      logPhaseCommand({
        command: "startNextRound",
        actorId: input.actorId,
        requested: "BETTING",
        ...evidence,
        code,
      });
      throw new DomainError(
        code,
        blockers.unresolvedInsurance > 0
          ? "Settle Insurance independently before starting the next round."
          : blockers.unresolvedBoxes > 0
            ? "Settle every remaining box before starting the next round."
            : `NEXT ROUND NOW is only available after the round is complete. The table is currently in ${table.currentPhase}.`,
      );
    }
    assertTransition("ROUND_COMPLETE", "BETTING");
    clearNextRoundTimer(input.tableId);
    const started = await startBetting({ ...input, idempotencyKey: `${input.idempotencyKey}:betting` });
    return { ok: true, phase: "BETTING" as const, roundId: started.roundId };
  });
}

export async function scheduleNextRound(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "scheduleNextRound", input, async () => {
    await maybeCompleteRound(input.tableId);
    const result = await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      if (table.currentPhase !== "ROUND_COMPLETE") {
        const blockers = table.currentRound
          ? roundBlockers(table.currentRound)
          : { unresolvedBoxes: 0, unresolvedInsurance: 0 };
        logRoundEvent({
          event: "scheduleNextRound.blocked",
          tableId: input.tableId,
          roundId: table.currentRound?.id,
          actorId: input.actorId,
          phase: table.currentPhase,
          unresolvedBoxes: blockers.unresolvedBoxes,
          unresolvedInsurance: blockers.unresolvedInsurance,
          code: "NEXT_ROUND_BLOCKED",
        });
        throw new DomainError(
          "NEXT_ROUND_BLOCKED",
          blockers.unresolvedInsurance > 0
            ? "Settle Insurance independently before starting the next round."
            : "Settle every remaining box before starting the next round.",
        );
      }
      if (!table.currentRound) throw new ConflictError("No round to continue.");
      if (table.currentRound.nextRoundDeadlineAt && table.currentRound.nextRoundDeadlineAt.getTime() > Date.now()) {
        return { deadline: table.currentRound.nextRoundDeadlineAt.toISOString() };
      }
      const deadline = new Date(Date.now() + NEXT_ROUND_COUNTDOWN_MS);
      await tx.round.update({
        where: { id: table.currentRound.id },
        data: { nextRoundDeadlineAt: deadline },
      });
      return { deadline: deadline.toISOString() };
    });
    scheduleNextRoundTimer(input.tableId, new Date(result.deadline), async (tableId) => {
      await ensureNextRoundIfDue(tableId);
    });
    publishTable(input.tableId);
    return result;
  });
}

export async function alignTablePhase(tableId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${tableId} FOR UPDATE`;
    const table = await tx.table.findUnique({
      where: { id: tableId },
      include: { currentRound: true },
    });
    if (!table || table.status === "ARCHIVED" || table.game !== "BLACKJACK" || !table.currentRound) return;
    if (table.currentPhase === table.currentRound.phase) return;
    logPhaseCommand({
      command: "alignTablePhase",
      tableId,
      roundId: table.currentRound.id,
      actorId: "system",
      requested: table.currentRound.phase,
      phase: table.currentPhase,
      roundStatus: table.currentRound.phase,
      code: "PHASE_ALIGNED",
    });
    await tx.table.update({
      where: { id: table.id },
      data: { currentPhase: table.currentRound.phase },
    });
  });
}

export async function ensureNextRoundIfDue(tableId: string): Promise<boolean> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: { currentRound: { include: { boxes: true, insuranceBets: true } } },
  });
  if (!table || table.status === "ARCHIVED" || table.game !== "BLACKJACK") return false;
  if (table.currentPhase !== "ROUND_COMPLETE" || !table.currentRound?.nextRoundDeadlineAt) {
    return false;
  }
  if (table.currentRound.nextRoundDeadlineAt.getTime() > Date.now()) {
    return false;
  }
  if (!table.bankDealerId) return false;
  const blockers = roundBlockers(table.currentRound);
  logRoundEvent({
    event: "ensureNextRoundIfDue",
    tableId,
    roundId: table.currentRound.id,
    actorId: table.bankDealerId,
    phase: table.currentPhase,
    unresolvedBoxes: blockers.unresolvedBoxes,
    unresolvedInsurance: blockers.unresolvedInsurance,
    deadline: table.currentRound.nextRoundDeadlineAt.toISOString(),
    code: "NEXT_ROUND_DUE",
  });
  try {
    await startBetting({
      actorId: table.bankDealerId,
      tableId,
      idempotencyKey: `next-round-due:${tableId}:${table.currentRound.id}`,
    });
  } catch (error) {
    if (error instanceof DomainError && error.code === "GAME_CONFLICT") return false;
    throw error;
  }
  clearNextRoundTimer(tableId);
  return true;
}

function roundBlockers(round: {
  boxes: { removedAt: Date | null; settledKey: string | null; lockedBetMillis: bigint }[];
  insuranceBets: { settledKey: string | null }[];
  insuranceWindow: string;
}) {
  const boxes = round.boxes.filter((box) => !box.removedAt);
  const unresolvedBoxes = boxes.filter((box) => !box.settledKey || box.lockedBetMillis > 0n).length;
  const unsettledInsuranceBets = round.insuranceBets.filter((bet) => !bet.settledKey).length;
  const unresolvedInsurance =
    round.insuranceBets.length > 0 && (round.insuranceWindow !== "SETTLED" || unsettledInsuranceBets > 0)
      ? Math.max(unsettledInsuranceBets, 1)
      : 0;
  return { unresolvedBoxes, unresolvedInsurance };
}

async function maybeCompleteRound(tableId: string) {
  await prisma.$transaction(async (tx) => {
    const table = await loadTableForUpdate(tx, tableId);
    if (table.currentPhase !== "PAYOUT" || !table.currentRound) return;
    const blockers = roundBlockers(table.currentRound);
    if (blockers.unresolvedBoxes > 0 || blockers.unresolvedInsurance > 0) {
      logRoundEvent({
        event: "maybeCompleteRound.blocked",
        tableId,
        roundId: table.currentRound.id,
        phase: table.currentPhase,
        unresolvedBoxes: blockers.unresolvedBoxes,
        unresolvedInsurance: blockers.unresolvedInsurance,
        code: "NEXT_ROUND_BLOCKED",
      });
      return;
    }
    assertTransition("PAYOUT", "ROUND_COMPLETE");
    await tx.round.update({
      where: { id: table.currentRound.id },
      data: { phase: "ROUND_COMPLETE", completedAt: new Date() },
    });
    await tx.table.update({
      where: { id: table.id },
      data: { currentPhase: "ROUND_COMPLETE" },
    });
    logRoundEvent({
      event: "maybeCompleteRound.completed",
      tableId,
      roundId: table.currentRound.id,
      phase: "ROUND_COMPLETE",
      unresolvedBoxes: 0,
      unresolvedInsurance: 0,
      code: "ROUND_COMPLETE",
    });
  });
}

export async function assertCanComplete(tableId: string) {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: { currentRound: { include: { boxes: true, insuranceBets: true } } },
  });
  if (!table?.currentRound) return false;
  const boxes = table.currentRound.boxes.filter((box) => !box.removedAt);
  if (boxes.some((box) => !box.settledKey || box.lockedBetMillis > 0n)) {
    throw new ConflictError("Every box must be settled before the round can complete.");
  }
  if (table.currentRound.insuranceBets.some((bet) => !bet.settledKey)) {
    throw new ConflictError("Insurance must be settled independently before the round can complete.");
  }
  return true;
}
