import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function ensurePokerSeat(tx: Tx, tableId: string, playerId: string): Promise<void> {
  const existing = await tx.pokerSeat.findUnique({
    where: { tableId_playerId: { tableId, playerId } },
  });
  if (existing) {
    if (existing.sittingOut) {
      await tx.pokerSeat.update({ where: { id: existing.id }, data: { sittingOut: false } });
    }
    return;
  }
  const max = await tx.pokerSeat.aggregate({
    where: { tableId },
    _max: { orderIndex: true },
  });
  await tx.pokerSeat.create({
    data: {
      tableId,
      playerId,
      orderIndex: (max._max.orderIndex ?? -1) + 1,
    },
  });
}

export async function dropPokerSeat(tx: Tx, tableId: string, playerId: string): Promise<void> {
  await tx.pokerSeat.deleteMany({ where: { tableId, playerId } });
  const remaining = await tx.pokerSeat.findMany({
    where: { tableId },
    orderBy: { orderIndex: "asc" },
  });
  for (const [index, seat] of remaining.entries()) {
    await tx.pokerSeat.update({
      where: { id: seat.id },
      data: { orderIndex: index + 1000 },
    });
  }
  for (const [index, seat] of remaining.entries()) {
    await tx.pokerSeat.update({
      where: { id: seat.id },
      data: { orderIndex: index },
    });
  }
}

export async function replacePokerSeats(tx: Tx, tableId: string, playerIds: string[]): Promise<void> {
  const unique = [...new Set(playerIds)];
  await tx.pokerSeat.deleteMany({ where: { tableId } });
  for (const [index, playerId] of unique.entries()) {
    await tx.pokerSeat.create({
      data: { tableId, playerId, orderIndex: index },
    });
  }
}
