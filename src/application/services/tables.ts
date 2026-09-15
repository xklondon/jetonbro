import { prisma } from "@/application/db";
import { hoursFromNow, randomToken } from "@/application/ids";
import { withIdempotency } from "@/application/idempotency";
import { appendLedger, creditTableAvailable } from "@/application/services/ledger";
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from "@/domain/errors";
import { isPlayableGame } from "@/domain/games";
import { parseJetonInput, type JetonMillis } from "@/domain/money";
import type { BlackjackPayoutRule } from "@/domain/blackjack/payouts";
import { publishTable } from "@/application/realtime/bus";

function parseOptionalJetons(value: string | undefined): JetonMillis | null {
  if (!value || value.trim() === "") return null;
  return parseJetonInput(value);
}

export async function createTable(input: {
  actorId: string;
  idempotencyKey: string;
  name: string;
  bankDealerId?: string;
  startingAllocation?: string;
  minBet?: string;
  maxBet?: string;
  blackjackPayout?: BlackjackPayoutRule;
  bankMayDistributeJetons?: boolean;
}) {
  if (!input.name.trim()) {
    throw new DomainError("INVALID_TABLE_NAME", "A table name is required.");
  }
  return withIdempotency(input.actorId, input.idempotencyKey, "createTable", input, async () => {
    const bankDealerId = input.bankDealerId ?? input.actorId;
    const starting = input.startingAllocation ? parseJetonInput(input.startingAllocation) : 0n;
    const minBet = parseOptionalJetons(input.minBet);
    const maxBet = parseOptionalJetons(input.maxBet);
    if (minBet !== null && maxBet !== null && minBet > maxBet) {
      throw new DomainError("INVALID_LIMITS", "Minimum bet cannot exceed maximum bet.");
    }

    const table = await prisma.$transaction(async (tx) => {
      const created = await tx.table.create({
        data: {
          name: input.name.trim(),
          game: "BLACKJACK",
          ownerId: input.actorId,
          bankDealerId,
          minBetMillis: minBet,
          maxBetMillis: maxBet,
          blackjackPayout: input.blackjackPayout ?? "THREE_TWO",
          bankMayDistributeJetons: input.bankMayDistributeJetons ?? true,
          currentPhase: "TABLE_SETUP",
          status: "SETUP",
        },
      });

      await tx.tableMember.create({
        data: {
          tableId: created.id,
          userId: input.actorId,
          isOwner: true,
          isBankDealer: bankDealerId === input.actorId,
          availableMillis: bankDealerId === input.actorId ? starting : 0n,
        },
      });

      if (bankDealerId !== input.actorId) {
        await tx.tableMember.create({
          data: {
            tableId: created.id,
            userId: bankDealerId,
            isOwner: false,
            isBankDealer: true,
            availableMillis: starting,
          },
        });
      }

      if (starting > 0n) {
        const recipientId = bankDealerId === input.actorId ? input.actorId : bankDealerId;
        const member = await tx.tableMember.findUniqueOrThrow({
          where: { tableId_userId: { tableId: created.id, userId: recipientId } },
        });
        await appendLedger(tx, {
          playerId: recipientId,
          actorId: input.actorId,
          tableId: created.id,
          transactionType: "INITIAL_ALLOCATION",
          amountMillis: starting,
          balanceBeforeMillis: 0n,
          balanceAfterMillis: starting,
          idempotencyKey: `${input.idempotencyKey}:ledger:${member.id}`,
          description: `Starting table allocation of ${starting.toString()} millijetons`,
        });
      }

      await tx.invitation.create({
        data: {
          tableId: created.id,
          kind: "QR",
          token: randomToken(),
          expiresAt: hoursFromNow(24 * 14),
          createdById: input.actorId,
        },
      });

      return created;
    });

    publishTable(table.id);
    return { tableId: table.id };
  });
}

export async function requireMember(tableId: string, userId: string) {
  const member = await prisma.tableMember.findUnique({
    where: { tableId_userId: { tableId, userId } },
  });
  if (!member || member.leftAt) {
    throw new ForbiddenError("You are not a member of this table.");
  }
  return member;
}

export async function requireOwnerOrBank(tableId: string, userId: string) {
  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table) throw new NotFoundError("Table not found.");
  if (table.ownerId !== userId && table.bankDealerId !== userId) {
    throw new ForbiddenError("Only the table owner or Bank/Dealer can do that.");
  }
  return table;
}

export async function updateTableSettings(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  minBet?: string;
  maxBet?: string;
  blackjackPayout?: BlackjackPayoutRule;
  bankMayDistributeJetons?: boolean;
  game?: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "updateTableSettings", input, async () => {
    const table = await requireOwnerOrBank(input.tableId, input.actorId);
    if (table.currentPhase !== "TABLE_SETUP") {
      throw new ConflictError("Table settings can only change during setup.");
    }
    if (input.game && input.game !== "BLACKJACK") {
      if (!isPlayableGame(input.game)) {
        throw new DomainError("GAME_UNAVAILABLE", "That game is coming later.");
      }
    }
    await prisma.table.update({
      where: { id: input.tableId },
      data: {
        minBetMillis: parseOptionalJetons(input.minBet),
        maxBetMillis: parseOptionalJetons(input.maxBet),
        blackjackPayout: input.blackjackPayout,
        bankMayDistributeJetons: input.bankMayDistributeJetons,
      },
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function assignBankDealer(input: {
  actorId: string;
  tableId: string;
  userId: string;
  idempotencyKey: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "assignBankDealer", input, async () => {
    const table = await requireOwnerOrBank(input.tableId, input.actorId);
    if (table.currentPhase !== "TABLE_SETUP" && table.currentPhase !== "BETTING") {
      throw new ConflictError("The Bank/Dealer can only be changed before cards are dealt.");
    }
    if (table.ownerId !== input.actorId && table.currentPhase !== "TABLE_SETUP") {
      throw new ForbiddenError("Only the owner can transfer the Bank/Dealer role during play setup.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.tableMember.updateMany({
        where: { tableId: input.tableId, isBankDealer: true },
        data: { isBankDealer: false },
      });
      const member = await tx.tableMember.findUnique({
        where: { tableId_userId: { tableId: input.tableId, userId: input.userId } },
      });
      if (!member || member.leftAt) {
        throw new DomainError("NOT_A_MEMBER", "That person is not at this table.");
      }
      await tx.tableMember.update({
        where: { id: member.id },
        data: { isBankDealer: true },
      });
      await tx.table.update({
        where: { id: input.tableId },
        data: { bankDealerId: input.userId },
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function distributeJetons(input: {
  actorId: string;
  tableId: string;
  userId: string;
  amount: string;
  idempotencyKey: string;
  mode?: "INITIAL_ALLOCATION" | "BANK_DISTRIBUTION" | "BANK_ADJUSTMENT";
}) {
  const amount = parseJetonInput(input.amount);
  if (amount === 0n) {
    throw new DomainError("INVALID_AMOUNT", "Enter a jeton amount greater than zero.");
  }
  return withIdempotency(input.actorId, input.idempotencyKey, "distributeJetons", input, async () => {
    const table = await requireOwnerOrBank(input.tableId, input.actorId);
    if (table.currentPhase !== "TABLE_SETUP" && table.currentPhase !== "BETTING") {
      throw new ConflictError("Jetons can only be distributed before cards are dealt.");
    }
    if (
      table.currentPhase === "BETTING" &&
      !table.bankMayDistributeJetons &&
      input.mode !== "INITIAL_ALLOCATION"
    ) {
      throw new ForbiddenError("This table does not allow extra jeton distribution during the session.");
    }
    await prisma.$transaction(async (tx) => {
      const member = await tx.tableMember.findUnique({
        where: { tableId_userId: { tableId: input.tableId, userId: input.userId } },
      });
      if (!member || member.leftAt) {
        throw new DomainError("NOT_A_MEMBER", "That person is not at this table.");
      }
      const type = input.mode ?? (table.currentPhase === "TABLE_SETUP" ? "INITIAL_ALLOCATION" : "BANK_DISTRIBUTION");
      const { before, after } = await creditTableAvailable(tx, member.id, amount);
      await appendLedger(tx, {
        playerId: input.userId,
        actorId: input.actorId,
        tableId: input.tableId,
        transactionType: type,
        amountMillis: amount,
        balanceBeforeMillis: before,
        balanceAfterMillis: after,
        idempotencyKey: `${input.idempotencyKey}:ledger`,
        description: `${type.replaceAll("_", " ").toLowerCase()} of table jetons`,
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function returnUnusedJetons(input: {
  actorId: string;
  tableId: string;
  userId: string;
  amount: string;
  idempotencyKey: string;
}) {
  const amount = parseJetonInput(input.amount);
  return withIdempotency(input.actorId, input.idempotencyKey, "returnUnusedJetons", input, async () => {
    await requireOwnerOrBank(input.tableId, input.actorId);
    await prisma.$transaction(async (tx) => {
      const member = await tx.tableMember.findUniqueOrThrow({
        where: { tableId_userId: { tableId: input.tableId, userId: input.userId } },
      });
      const { before, after } = await creditTableAvailable(tx, member.id, -amount);
      await tx.playerAccount.upsert({
        where: { userId: input.userId },
        update: { globalAvailableMillis: { increment: amount } },
        create: { userId: input.userId, globalAvailableMillis: amount },
      });
      await appendLedger(tx, {
        playerId: input.userId,
        actorId: input.actorId,
        tableId: input.tableId,
        transactionType: "TABLE_TRANSFER_OUT",
        amountMillis: amount,
        balanceBeforeMillis: before,
        balanceAfterMillis: after,
        idempotencyKey: `${input.idempotencyKey}:out`,
        description: "Unused table jetons returned to the player ledger",
      });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function removeMember(input: {
  actorId: string;
  tableId: string;
  userId: string;
  idempotencyKey: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "removeMember", input, async () => {
    const table = await requireOwnerOrBank(input.tableId, input.actorId);
    if (table.currentPhase !== "TABLE_SETUP") {
      throw new ConflictError("Players can only be removed before a round starts.");
    }
    if (input.userId === table.ownerId) {
      throw new DomainError("CANNOT_REMOVE_OWNER", "The table owner cannot be removed.");
    }
    await prisma.tableMember.updateMany({
      where: { tableId: input.tableId, userId: input.userId, leftAt: null },
      data: { leftAt: new Date() },
    });
    if (table.bankDealerId === input.userId) {
      await prisma.table.update({
        where: { id: input.tableId },
        data: { bankDealerId: table.ownerId },
      });
      await prisma.tableMember.updateMany({
        where: { tableId: input.tableId, userId: table.ownerId },
        data: { isBankDealer: true },
      });
    }
    publishTable(input.tableId);
    return { ok: true };
  });
}
