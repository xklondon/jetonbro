import { prisma } from "@/application/db";
import { withIdempotency } from "@/application/idempotency";
import { DomainError, ForbiddenError } from "@/domain/errors";

/**
 * Global admin wipe of every Table (all owners, all statuses).
 *
 * Cascade order:
 * 1. Null Table.currentRoundId / currentPokerHandId / currentGameSessionId
 * 2. Detach LedgerEntry FKs so immutable audit rows survive
 * 3. Detach GameSession.tableId so personal results survive
 * 4. Revoke invitations
 * 5. Delete every Table — Prisma cascades members, rounds, boxes, poker rows, etc.
 *
 * User, Account, Session, PlayerAccount, and GameSessionParticipant rows are not deleted.
 * Does not run CLOSE TABLE or END & DELETE per table and does not fabricate settlements.
 */
export async function wipeAllTables(input: {
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
  return withIdempotency(input.actorId, input.idempotencyKey, "wipeAllTables", input, async () => {
    const user = await prisma.user.findUnique({ where: { id: input.actorId } });
    if (!user || user.isGuest) {
      throw new ForbiddenError("That maintenance control is not available.");
    }
    const tables = await prisma.table.findMany({ select: { id: true } });
    const ids = tables.map((table) => table.id);
    if (ids.length === 0) {
      return { ok: true, wiped: 0, deleted: 0 };
    }
    const CHUNK = 80;
    await prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          await tx.table.updateMany({
            where: { id: { in: chunk } },
            data: { currentRoundId: null, currentPokerHandId: null, currentGameSessionId: null },
          });
          await tx.ledgerEntry.updateMany({
            where: { tableId: { in: chunk } },
            data: {
              tableId: null,
              roundId: null,
              boxId: null,
              insuranceBetId: null,
              pokerHandId: null,
            },
          });
          await tx.gameSession.updateMany({
            where: { tableId: { in: chunk } },
            data: { tableId: null },
          });
          await tx.invitation.updateMany({
            where: { tableId: { in: chunk }, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          await tx.table.deleteMany({ where: { id: { in: chunk } } });
        }
      },
      { timeout: 180_000, maxWait: 30_000 },
    );
    return { ok: true, wiped: ids.length, deleted: ids.length };
  });
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = process.env.JETONBRO_ADMIN_EMAIL?.trim().toLowerCase();
  if (!admin || !email) return false;
  return email.trim().toLowerCase() === admin;
}

/** Total tables in the database (admin wipe confirmation copy). Never expose ownership filters here. */
export async function totalTableCount(): Promise<number> {
  return prisma.table.count();
}
