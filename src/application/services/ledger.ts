import { DomainError } from "@/domain/errors";
import type { Prisma } from "@prisma/client";
import type { LedgerTransactionType } from "@/domain/ledger/types";

type Tx = Prisma.TransactionClient;

export async function appendLedger(
  tx: Tx,
  input: {
    playerId: string;
    actorId: string;
    tableId?: string | null;
    roundId?: string | null;
    boxId?: string | null;
    insuranceBetId?: string | null;
    transactionType: LedgerTransactionType;
    amountMillis: bigint;
    balanceBeforeMillis: bigint;
    balanceAfterMillis: bigint;
    idempotencyKey: string;
    description: string;
  },
): Promise<void> {
  await tx.ledgerEntry.create({
    data: {
      playerId: input.playerId,
      actorId: input.actorId,
      tableId: input.tableId ?? null,
      roundId: input.roundId ?? null,
      boxId: input.boxId ?? null,
      insuranceBetId: input.insuranceBetId ?? null,
      transactionType: input.transactionType,
      amountMillis: input.amountMillis,
      balanceBeforeMillis: input.balanceBeforeMillis,
      balanceAfterMillis: input.balanceAfterMillis,
      idempotencyKey: input.idempotencyKey,
      description: input.description,
    },
  });
}

export async function creditTableAvailable(
  tx: Tx,
  memberId: string,
  amount: bigint,
): Promise<{ before: bigint; after: bigint }> {
  const member = await tx.tableMember.findUniqueOrThrow({ where: { id: memberId } });
  if (amount === 0n) {
    return { before: member.availableMillis, after: member.availableMillis };
  }
  const after = member.availableMillis + amount;
  if (after < 0n) {
    throw new DomainError("INSUFFICIENT_FUNDS", "You do not have enough jetons");
  }
  await tx.tableMember.update({
    where: { id: memberId },
    data: { availableMillis: after },
  });
  return { before: member.availableMillis, after };
}

export async function creditPlayerPocket(
  tx: Tx,
  userId: string,
  amount: bigint,
): Promise<{ before: bigint; after: bigint }> {
  const account = await tx.playerAccount.upsert({
    where: { userId },
    update: {},
    create: { userId, globalAvailableMillis: 0n },
  });
  if (amount === 0n) {
    return { before: account.globalAvailableMillis, after: account.globalAvailableMillis };
  }
  const after = account.globalAvailableMillis + amount;
  if (after < 0n) {
    throw new DomainError("INSUFFICIENT_FUNDS", "You do not have enough jetons");
  }
  await tx.playerAccount.update({
    where: { userId },
    data: { globalAvailableMillis: after },
  });
  return { before: account.globalAvailableMillis, after };
}
