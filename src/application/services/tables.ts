import { prisma } from "@/application/db";
import { hoursFromNow, randomToken } from "@/application/ids";
import { withIdempotency } from "@/application/idempotency";
import { sendInvitationEmail } from "@/application/mail";
import { appendLedger, creditTableAvailable } from "@/application/services/ledger";
import { publishTable } from "@/application/realtime/bus";
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from "@/domain/errors";
import { isPlayableGame } from "@/domain/games";
import { parseJetonInput, parseWholeJetons, type JetonMillis } from "@/domain/money";
import type { BlackjackPayoutRule } from "@/domain/blackjack/payouts";
import { BLACKJACK_TABLE_DEFAULTS, parseMaxBoxesPerPlayer } from "@/domain/blackjack/settings";
import { collectInviteEmails } from "@/domain/invitations/email";
import { Prisma } from "@prisma/client";

function isOpenDraftConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function findOpenDraft(ownerId: string) {
  return prisma.table.findFirst({
    where: {
      ownerId,
      currentPhase: "TABLE_SETUP",
      status: "SETUP",
      setupCompletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
}

function parseOptionalJetons(value: string | undefined): JetonMillis | null {
  if (!value || value.trim() === "") return null;
  return parseJetonInput(value);
}

export async function creditStartingJetonsOnce(
  tx: Prisma.TransactionClient,
  input: {
    tableId: string;
    memberId: string;
    userId: string;
    actorId: string;
    startingJetonsPerPlayerMillis: bigint;
    isBankDealer: boolean;
  },
): Promise<void> {
  if (input.isBankDealer) {
    await tx.tableMember.update({
      where: { id: input.memberId },
      data: { startingJetonsCredited: true },
    });
    return;
  }
  const member = await tx.tableMember.findUniqueOrThrow({ where: { id: input.memberId } });
  if (member.startingJetonsCredited) return;
  const ledgerKey = `starting-jetons:${input.tableId}:${input.userId}`;
  const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: ledgerKey } });
  if (existing) {
    await tx.tableMember.update({
      where: { id: input.memberId },
      data: { startingJetonsCredited: true },
    });
    return;
  }
  const amount = input.startingJetonsPerPlayerMillis;
  if (amount <= 0n) {
    await tx.tableMember.update({
      where: { id: input.memberId },
      data: { startingJetonsCredited: true },
    });
    return;
  }
  const { before, after } = await creditTableAvailable(tx, input.memberId, amount);
  await appendLedger(tx, {
    playerId: input.userId,
    actorId: input.actorId,
    tableId: input.tableId,
    transactionType: "INITIAL_ALLOCATION",
    amountMillis: amount,
    balanceBeforeMillis: before,
    balanceAfterMillis: after,
    idempotencyKey: ledgerKey,
    description: "Starting jetons per player",
  });
  await tx.tableMember.update({
    where: { id: input.memberId },
    data: { startingJetonsCredited: true },
  });
}

export async function createTable(input: {
  actorId: string;
  idempotencyKey: string;
  name: string;
  game?: string;
  bankDealerId?: string;
  startingAllocation?: string;
  startingJetonsPerPlayer?: string;
  emails?: string[];
  origin?: string;
  minBet?: string;
  maxBet?: string;
  blackjackPayout?: BlackjackPayoutRule;
  maxBoxesPerPlayer?: number | string;
  insuranceEnabled?: boolean;
  bankMayDistributeJetons?: boolean;
}) {
  if (!input.name.trim()) {
    throw new DomainError("INVALID_TABLE_NAME", "A table name is required.");
  }
  if (input.game && !isPlayableGame(input.game)) {
    throw new DomainError("GAME_UNAVAILABLE", "That game is coming later.");
  }
  const emails = collectInviteEmails(input.emails ?? []);
  return withIdempotency(input.actorId, input.idempotencyKey, "createTable", input, async () => {
    const bankDealerId = input.bankDealerId ?? input.actorId;
    const perPlayerRaw = input.startingJetonsPerPlayer ?? input.startingAllocation ?? BLACKJACK_TABLE_DEFAULTS.startingAllocation;
    const startingJetonsPerPlayerMillis = parseWholeJetons(perPlayerRaw);
    const minBet = parseOptionalJetons(input.minBet);
    const maxBet = parseOptionalJetons(input.maxBet);
    if (minBet !== null && maxBet !== null && minBet > maxBet) {
      throw new DomainError("INVALID_LIMITS", "Minimum bet cannot exceed maximum bet.");
    }
    const maxBoxesPerPlayer = parseMaxBoxesPerPlayer(input.maxBoxesPerPlayer);
    const insuranceEnabled = input.insuranceEnabled ?? BLACKJACK_TABLE_DEFAULTS.insuranceEnabled;
    const blackjackPayout = input.blackjackPayout ?? BLACKJACK_TABLE_DEFAULTS.blackjackPayout;

    const table = await prisma.$transaction(async (tx) => {
      const created = await tx.table.create({
        data: {
          name: input.name.trim(),
          game: "BLACKJACK",
          ownerId: input.actorId,
          bankDealerId,
          minBetMillis: minBet,
          maxBetMillis: maxBet,
          blackjackPayout,
          maxBoxesPerPlayer,
          insuranceEnabled,
          startingJetonsPerPlayerMillis,
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
          availableMillis: 0n,
          startingJetonsCredited: true,
        },
      });

      if (bankDealerId !== input.actorId) {
        await tx.tableMember.create({
          data: {
            tableId: created.id,
            userId: bankDealerId,
            isOwner: false,
            isBankDealer: true,
            availableMillis: 0n,
            startingJetonsCredited: true,
          },
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

      for (const email of emails) {
        await tx.invitation.create({
          data: {
            tableId: created.id,
            kind: "EMAIL",
            email,
            token: randomToken(),
            expiresAt: hoursFromNow(48),
            createdById: input.actorId,
          },
        });
      }

      return created;
    });

    if (input.origin) {
      const invites = await prisma.invitation.findMany({
        where: { tableId: table.id, kind: "EMAIL", revokedAt: null },
      });
      for (const invite of invites) {
        if (!invite.email) continue;
        try {
          await sendInvitationEmail({
            to: invite.email,
            tableName: table.name,
            url: `${input.origin}/join/${invite.token}`,
          });
        } catch {
          console.error("[jetonbro-command] command=createTable table=" + table.id + " actor=" + input.actorId + " phase=TABLE_SETUP code=INVITE_EMAIL_FAILED");
        }
      }
    }

    publishTable(table.id);
    return { tableId: table.id };
  });
}

export async function ensureDraftTable(input: { actorId: string; name?: string }) {
  const existing = await findOpenDraft(input.actorId);
  if (existing) return { tableId: existing.id };
  try {
    return await createTable({
      actorId: input.actorId,
      idempotencyKey: `draft:${input.actorId}:${randomToken()}`,
      name: (input.name ?? "Table").trim() || "Table",
      game: "BLACKJACK",
      startingJetonsPerPlayer: BLACKJACK_TABLE_DEFAULTS.startingAllocation,
      emails: [],
    });
  } catch (error) {
    if (isOpenDraftConflict(error)) {
      const raced = await findOpenDraft(input.actorId);
      if (raced) return { tableId: raced.id };
    }
    throw error;
  }
}

export async function finalizeSetup(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  name: string;
  startingJetonsPerPlayer?: string;
  emails?: string[];
  origin?: string;
}) {
  if (!input.name.trim()) {
    throw new DomainError("INVALID_TABLE_NAME", "A table name is required.");
  }
  const emails = collectInviteEmails(input.emails ?? []);
  const startingJetonsPerPlayerMillis = parseWholeJetons(
    input.startingJetonsPerPlayer?.trim() || BLACKJACK_TABLE_DEFAULTS.startingAllocation,
  );
  return withIdempotency(input.actorId, input.idempotencyKey, "finalizeSetup", input, async () => {
    const table = await requireOwnerOrBank(input.tableId, input.actorId);
    if (table.currentPhase !== "TABLE_SETUP") {
      throw new ConflictError("Table setup can only be finished during TABLE_SETUP.");
    }
    const existingInvites = await prisma.invitation.findMany({
      where: { tableId: table.id, kind: "EMAIL" },
    });
    const alreadyInvited = new Set(
      existingInvites.map((invite) => (invite.email ?? "").toLowerCase()).filter(Boolean),
    );
    const newEmails = emails.filter((email) => !alreadyInvited.has(email));
    const createdInvites: { email: string; token: string }[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.table.update({
        where: { id: table.id },
        data: {
          name: input.name.trim(),
          startingJetonsPerPlayerMillis,
          setupCompletedAt: table.setupCompletedAt ?? new Date(),
        },
      });
      for (const email of newEmails) {
        const created = await tx.invitation.create({
          data: {
            tableId: table.id,
            kind: "EMAIL",
            email,
            token: randomToken(),
            expiresAt: hoursFromNow(48),
            createdById: input.actorId,
          },
        });
        createdInvites.push({ email, token: created.token });
      }
    });

    if (input.origin) {
      for (const invite of createdInvites) {
        try {
          await sendInvitationEmail({
            to: invite.email,
            tableName: input.name.trim(),
            url: `${input.origin}/join/${invite.token}`,
          });
        } catch {
          console.error(
            "[jetonbro-command] command=finalizeSetup table=" +
              table.id +
              " actor=" +
              input.actorId +
              " phase=TABLE_SETUP code=INVITE_EMAIL_FAILED",
          );
        }
      }
    }

    publishTable(table.id);
    return { ok: true, tableId: table.id };
  });
}

export async function abandonDraft(input: { actorId: string; tableId: string; idempotencyKey: string }) {
  return withIdempotency(input.actorId, input.idempotencyKey, "abandonDraft", input, async () => {
    const table = await prisma.table.findUnique({
      where: { id: input.tableId },
      include: { members: { where: { leftAt: null } } },
    });
    if (!table) return { abandoned: true };
    if (table.ownerId !== input.actorId) {
      throw new ForbiddenError("Only the table owner can cancel this draft.");
    }
    if (table.currentPhase !== "TABLE_SETUP") {
      throw new ConflictError("This table can no longer be abandoned.");
    }
    const joinedPlayers = table.members.filter((member) => !member.isBankDealer && member.userId !== table.bankDealerId);
    if (joinedPlayers.length > 0) {
      if (!table.setupCompletedAt) {
        await prisma.table.update({
          where: { id: table.id },
          data: { setupCompletedAt: new Date() },
        });
        publishTable(table.id);
      }
      return { abandoned: false };
    }
    await prisma.table.delete({ where: { id: table.id } });
    return { abandoned: true };
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
  maxBoxesPerPlayer?: number | string;
  insuranceEnabled?: boolean;
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
        maxBoxesPerPlayer: input.maxBoxesPerPlayer === undefined ? undefined : parseMaxBoxesPerPlayer(input.maxBoxesPerPlayer),
        insuranceEnabled: input.insuranceEnabled,
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
