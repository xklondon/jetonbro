import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { DomainError, ForbiddenError } from "@/domain/errors";
import { createTable, finalizeSetup, endAndDelete } from "@/application/services/tables";
import { startBetting, placeOrRetractBet } from "@/application/services/blackjack-round";
import { joinAsGuest } from "@/application/services/invitations";
import { saveGameSessionResults, listPersonalLedger } from "@/application/services/game-session";
import { wipeAllTables, totalTableCount } from "@/application/services/wipe-tables";

let hasDb = Boolean(process.env.DATABASE_URL);
if (hasDb) {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    hasDb = false;
  }
}
const describeDb = hasDb ? describe : describe.skip;

async function user(email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, isGuest: false },
    create: { email, name, emailVerified: new Date(), isGuest: false },
  });
}

describeDb("global WIPE ALL TABLES", () => {
  const prevAdmin = process.env.JETONBRO_ADMIN_EMAIL;

  beforeEach(() => {
    delete process.env.JETONBRO_ADMIN_EMAIL;
  });

  afterEach(() => {
    if (prevAdmin === undefined) delete process.env.JETONBRO_ADMIN_EMAIL;
    else process.env.JETONBRO_ADMIN_EMAIL = prevAdmin;
  });

  test("admin phrase removes every table across owners; ledger and users survive; retry is idempotent", async () => {
    // Global wipe touches every table in the shared DB; allow a long window.

    const admin = await user(`wipe-admin-${randomUUID()}@jetonbro.test`, "Admin");
    const other = await user(`wipe-other-${randomUUID()}@jetonbro.test`, "Other");
    process.env.JETONBRO_ADMIN_EMAIL = admin.email;

    const adminDraft = await createTable({
      actorId: admin.id,
      idempotencyKey: randomUUID(),
      name: "Admin draft",
      game: "BLACKJACK",
      emails: [],
      startingJetonsPerPlayer: "100",
    });

    const adminBj = await createTable({
      actorId: admin.id,
      idempotencyKey: randomUUID(),
      name: "Admin BJ",
      game: "BLACKJACK",
      emails: [],
      startingJetonsPerPlayer: "100",
    });
    await finalizeSetup({
      actorId: admin.id,
      tableId: adminBj.tableId,
      idempotencyKey: randomUUID(),
      name: "Admin BJ",
    });
    const guestInvite = await prisma.invitation.findFirst({
      where: { tableId: adminBj.tableId, kind: "GUEST" },
    });
    const casey = await joinAsGuest({ token: guestInvite!.token, playName: "Casey" });
    await startBetting({ actorId: admin.id, tableId: adminBj.tableId, idempotencyKey: randomUUID() });
    const box = await prisma.bettingBox.findFirst({
      where: { round: { tableId: adminBj.tableId }, playerId: casey.userId },
    });
    await placeOrRetractBet({
      actorId: casey.userId,
      tableId: adminBj.tableId,
      boxId: box!.id,
      amount: "25",
      mode: "ADD",
      idempotencyKey: randomUUID(),
    });

    await createTable({
      actorId: admin.id,
      idempotencyKey: randomUUID(),
      name: "Admin Poker",
      game: "POKER",
      emails: [],
      startingJetonsPerPlayer: "100",
    });

    const otherActive = await createTable({
      actorId: other.id,
      idempotencyKey: randomUUID(),
      name: "Other active",
      game: "BLACKJACK",
      emails: [],
      startingJetonsPerPlayer: "50",
    });
    await finalizeSetup({
      actorId: other.id,
      tableId: otherActive.tableId,
      idempotencyKey: randomUUID(),
      name: "Other active",
    });
    await saveGameSessionResults({
      actorId: other.id,
      tableId: otherActive.tableId,
      idempotencyKey: randomUUID(),
    });

    const otherSaved = await createTable({
      actorId: other.id,
      idempotencyKey: randomUUID(),
      name: "Other saved",
      game: "BLACKJACK",
      emails: [],
    });
    await finalizeSetup({
      actorId: other.id,
      tableId: otherSaved.tableId,
      idempotencyKey: randomUUID(),
      name: "Other saved",
    });

    const archived = await createTable({
      actorId: other.id,
      idempotencyKey: randomUUID(),
      name: "Archived",
      game: "BLACKJACK",
      emails: [],
    });
    await finalizeSetup({
      actorId: other.id,
      tableId: archived.tableId,
      idempotencyKey: randomUUID(),
      name: "Archived",
    });
    await endAndDelete({
      actorId: other.id,
      tableId: archived.tableId,
      idempotencyKey: randomUUID(),
    });

    const beforeCount = await totalTableCount();
    expect(beforeCount).toBeGreaterThanOrEqual(6);
    expect(adminDraft.tableId).toBeTruthy();

    await expect(
      wipeAllTables({
        actorId: other.id,
        actorEmail: other.email,
        confirmation: "WIPE ALL TABLES",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      wipeAllTables({
        actorId: admin.id,
        actorEmail: admin.email,
        confirmation: "wrong",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const first = await wipeAllTables({
      actorId: admin.id,
      actorEmail: admin.email,
      confirmation: "WIPE ALL TABLES",
      idempotencyKey: randomUUID(),
    });
    expect(first.deleted).toBe(beforeCount);
    expect(await totalTableCount()).toBe(0);
    expect(await prisma.table.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: admin.id } })).toBeTruthy();
    expect(await prisma.user.findUnique({ where: { id: other.id } })).toBeTruthy();
    const ledger = await listPersonalLedger(other.id);
    expect(ledger.length).toBeGreaterThan(0);

    const again = await wipeAllTables({
      actorId: admin.id,
      actorEmail: admin.email,
      confirmation: "WIPE ALL TABLES",
      idempotencyKey: randomUUID(),
    });
    expect(again.deleted).toBe(0);
  });
});
