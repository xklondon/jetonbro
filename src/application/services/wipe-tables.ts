import { prisma } from "@/application/db";
import { withIdempotency } from "@/application/idempotency";
import { DomainError, ForbiddenError } from "@/domain/errors";

/**
 * Physical wipe cascade (owned tables only):
 * 1. Null Table.currentRoundId / currentPokerHandId / currentGameSessionId
 * 2. Detach LedgerEntry FKs (table/round/box/insurance/pokerHand) so audit rows survive
 * 3. Detach GameSession.tableId (personal results survive)
 * 4. Delete Table — Prisma cascades TableMember, Invitation, Round, BettingBox,
 *    InsuranceBet, PokerSeat, PokerHand, PokerParticipant, PokerPot, PokerAction
 * User, Account, Session, PlayerAccount, and GameSessionParticipant rows are not deleted.
 */
export async function wipeAllMyTables(input: {
  actorId: string;
  idempotencyKey: string;
  confirmation: string;
  actorEmail: string;
}) {
  const admin = process.env.JETONBRO_ADMIN_EMAIL?.trim().toLowerCase();
  if (!admin || input.actorEmail.trim().toLowerCase() !== admin) {
    throw new ForbiddenError("That maintenance control is not available.");
  }
  if (input.confirmation !== "WIPE ALL TABLES") {
    throw new DomainError("INVALID_CONFIRMATION", "Type WIPE ALL TABLES to confirm.");
  }
  return withIdempotency(input.actorId, input.idempotencyKey, "wipeAllMyTables", input, async () => {
    const user = await prisma.user.findUnique({ where: { id: input.actorId } });
    if (!user || user.isGuest) {
      throw new ForbiddenError("That maintenance control is not available.");
    }
    const tables = await prisma.table.findMany({
      where: { ownerId: input.actorId },
      select: { id: true },
    });
    const ids = tables.map((table) => table.id);
    if (ids.length === 0) {
      return { ok: true, wiped: 0 };
    }
    await prisma.$transaction(async (tx) => {
      await tx.table.updateMany({
        where: { id: { in: ids } },
        data: { currentRoundId: null, currentPokerHandId: null, currentGameSessionId: null },
      });
      await tx.ledgerEntry.updateMany({
        where: { tableId: { in: ids } },
        data: {
          tableId: null,
          roundId: null,
          boxId: null,
          insuranceBetId: null,
          pokerHandId: null,
        },
      });
      await tx.gameSession.updateMany({
        where: { tableId: { in: ids } },
        data: { tableId: null },
      });
      await tx.invitation.updateMany({
        where: { tableId: { in: ids }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.table.deleteMany({ where: { id: { in: ids } } });
    });
    return { ok: true, wiped: ids.length };
  });
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = process.env.JETONBRO_ADMIN_EMAIL?.trim().toLowerCase();
  if (!admin || !email) return false;
  return email.trim().toLowerCase() === admin;
}

export async function ownedTableCount(userId: string): Promise<number> {
  return prisma.table.count({ where: { ownerId: userId } });
}
