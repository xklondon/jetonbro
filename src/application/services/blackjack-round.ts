import { prisma } from "@/application/db";
import { withIdempotency } from "@/application/idempotency";
import { publishTable } from "@/application/realtime/bus";
import { appendLedger, creditTableAvailable } from "@/application/services/ledger";
import { requireMember } from "@/application/services/tables";
import {
  insuranceMaxMillis,
  insuranceReturnMillis,
  ordinaryReturnMillis,
  outcomeLedgerType,
  type BoxOutcome,
  type InsuranceResolution,
} from "@/domain/blackjack/payouts";
import { assertTransition } from "@/domain/blackjack/transitions";
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from "@/domain/errors";
import { formatJetons, parseJetonInput } from "@/domain/money";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

async function loadTableForUpdate(tx: Tx, tableId: string) {
  const table = await tx.table.findUnique({
    where: { id: tableId },
    include: {
      currentRound: { include: { boxes: true, insuranceBets: true } },
      members: { where: { leftAt: null } },
    },
  });
  if (!table) throw new NotFoundError("Table not found.");
  return table;
}

function requireBank(table: { bankDealerId: string | null }, actorId: string) {
  if (table.bankDealerId !== actorId) {
    throw new ForbiddenError("Only the Bank/Dealer can do that.");
  }
}

function requirePhase(actual: string, expected: string) {
  if (actual !== expected) {
    throw new ConflictError(`This action is only available during ${expected}.`);
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

export async function startBetting(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "startBetting", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      if (table.currentPhase === "BETTING") {
        return;
      }
      assertTransition(table.currentPhase, "BETTING");
      if (!table.bankDealerId) {
        throw new DomainError("NO_BANK", "Assign a Bank/Dealer before opening betting.");
      }
      const participating = table.members.filter((member) => member.userId !== table.bankDealerId);
      if (participating.length === 0) {
        throw new DomainError("NO_PLAYERS", "At least one player must join before betting opens.");
      }
      for (const member of table.members) {
        if (member.availableMillis < 0n) {
          throw new DomainError("NEGATIVE_BALANCE", "Every player must have a non-negative table balance.");
        }
      }
      const roundCount = await tx.round.count({ where: { tableId: table.id } });
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
        },
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function addBox(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "addBox", input, async () => {
    await requireMember(input.tableId, input.actorId);
    const boxId = await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requirePhase(table.currentPhase, "BETTING");
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
      requirePhase(table.currentPhase, "BETTING");
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
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requirePhase(table.currentPhase, "BETTING");
      const box = table.currentRound?.boxes.find((item) => item.id === input.boxId && !item.removedAt);
      if (!box || box.playerId !== input.actorId) {
        throw new ForbiddenError("You can only change bets on your own boxes.");
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
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function dealCards(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "dealCards", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      requirePhase(table.currentPhase, "BETTING");
      assertTransition("BETTING", "PLAYING");
      const round = table.currentRound;
      if (!round) throw new ConflictError("No open round.");
      await tx.bettingBox.updateMany({
        where: { roundId: round.id, lockedBetMillis: 0n, removedAt: null },
        data: { removedAt: new Date() },
      });
      await tx.round.update({
        where: { id: round.id },
        data: { phase: "PLAYING", bettingClosedAt: new Date() },
      });
      await tx.table.update({
        where: { id: table.id },
        data: { currentPhase: "PLAYING" },
      });
    });
    publishTable(input.tableId);
    return { ok: true };
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
      const member = await lockMember(tx, table.id, input.actorId);
      const { before, after } = await creditTableAvailable(tx, member.id, -stake);
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
      const member = await lockMember(tx, table.id, input.actorId);
      const { before, after } = await creditTableAvailable(tx, member.id, -amount);
      const insurance = await tx.insuranceBet.create({
        data: {
          roundId: table.currentRound.id,
          playerId: input.actorId,
          boxId: box.id,
          amountMillis: amount,
        },
      });
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

export async function enterPayout(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "enterPayout", input, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await loadTableForUpdate(tx, input.tableId);
      requireBank(table, input.actorId);
      requirePhase(table.currentPhase, "PLAYING");
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
    });
    publishTable(input.tableId);
    return { ok: true };
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
      const round = table.currentRound;
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
        const member = await lockMember(tx, table.id, bet.playerId);
        const { before, after } = await creditTableAvailable(tx, member.id, returned);
        await appendLedger(tx, {
          playerId: bet.playerId,
          actorId: input.actorId,
          tableId: table.id,
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
      }
      await tx.round.update({
        where: { id: round.id },
        data: {
          insuranceWindow: "SETTLED",
          insuranceResolution: input.resolution,
        },
      });
    });
    await maybeCompleteRound(input.tableId);
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function startNextRound(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "startNextRound", input, async () => {
    const table = await prisma.table.findUnique({ where: { id: input.tableId } });
    if (!table) throw new NotFoundError("Table not found.");
    requireBank(table, input.actorId);
    requirePhase(table.currentPhase, "ROUND_COMPLETE");
    assertTransition("ROUND_COMPLETE", "BETTING");
    await startBetting({ ...input, idempotencyKey: `${input.idempotencyKey}:betting` });
    return { ok: true };
  });
}

async function maybeCompleteRound(tableId: string) {
  await prisma.$transaction(async (tx) => {
    const table = await loadTableForUpdate(tx, tableId);
    if (table.currentPhase !== "PAYOUT" || !table.currentRound) return;
    const boxes = table.currentRound.boxes.filter((box) => !box.removedAt);
    const unresolvedBoxes = boxes.filter((box) => !box.settledKey || box.lockedBetMillis > 0n);
    const unresolvedInsurance = table.currentRound.insuranceBets.filter((bet) => !bet.settledKey);
    const insuranceNeedsResolution =
      table.currentRound.insuranceBets.length > 0
        ? table.currentRound.insuranceWindow !== "SETTLED" || unresolvedInsurance.length > 0
        : false;
    if (unresolvedBoxes.length > 0 || insuranceNeedsResolution) return;
    assertTransition("PAYOUT", "ROUND_COMPLETE");
    await tx.round.update({
      where: { id: table.currentRound.id },
      data: { phase: "ROUND_COMPLETE", completedAt: new Date() },
    });
    await tx.table.update({
      where: { id: table.id },
      data: { currentPhase: "ROUND_COMPLETE" },
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
