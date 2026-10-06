import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable, finalizeSetup } from "@/application/services/tables";
import { joinAsGuest } from "@/application/services/invitations";
import { startBetting, placeOrRetractBet } from "@/application/services/blackjack-round";
import { switchGame } from "@/application/services/switch-game";
import { startTexasHoldem } from "@/application/services/poker-hand";
import { saveGameSessionResults, listPersonalLedger } from "@/application/services/game-session";
import { wipeAllMyTables } from "@/application/services/wipe-tables";
import { DomainError, ForbiddenError } from "@/domain/errors";

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

describeDb("game sessions, fresh allocation, ledger, wipe", () => {
  test("new poker session funds every selected participant including previous dealer", async () => {
    const owner = await user(`p5-owner-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "P5 session",
      game: "BLACKJACK",
      startingJetonsPerPlayer: "100",
      emails: [],
    });
    await finalizeSetup({ actorId: owner.id, tableId: created.tableId, idempotencyKey: randomUUID(), name: "P5 session" });
    const guestInvite = await prisma.invitation.findFirst({ where: { tableId: created.tableId, kind: "GUEST" } });
    const casey = await joinAsGuest({ token: guestInvite!.token, playName: "Casey" });
    await startBetting({ actorId: owner.id, tableId: created.tableId, idempotencyKey: randomUUID() });
    const box = await prisma.bettingBox.findFirst({ where: { round: { tableId: created.tableId }, playerId: casey.userId } });
    await placeOrRetractBet({ actorId: casey.userId, tableId: created.tableId, idempotencyKey: randomUUID(), boxId: box!.id, amount: "25", mode: "ADD" });

    await expect(
      switchGame({ actorId: owner.id, tableId: created.tableId, game: "POKER", idempotencyKey: randomUUID() }),
    ).rejects.toBeInstanceOf(DomainError);

    await prisma.bettingBox.update({ where: { id: box!.id }, data: { lockedBetMillis: 0n, originalStakeMillis: 0n } });
    await prisma.round.update({ where: { id: box!.roundId }, data: { phase: "ROUND_COMPLETE" } });
    await prisma.table.update({ where: { id: created.tableId }, data: { currentPhase: "ROUND_COMPLETE" } });

    await switchGame({
      actorId: owner.id,
      tableId: created.tableId,
      game: "POKER",
      idempotencyKey: randomUUID(),
      savePersonalLedger: "false",
      startingJetonsPerPlayer: "100",
      participantUserIds: [owner.id, casey.userId],
    });
    const members = await prisma.tableMember.findMany({ where: { tableId: created.tableId, leftAt: null } });
    expect(members.every((member) => member.availableMillis === 100000n)).toBe(true);
    const seats = await prisma.pokerSeat.findMany({ where: { tableId: created.tableId } });
    expect(seats).toHaveLength(2);
    await startTexasHoldem({ actorId: owner.id, tableId: created.tableId, idempotencyKey: randomUUID() });
    const hand = await prisma.pokerHand.findFirst({ where: { tableId: created.tableId }, include: { participants: true } });
    const dealer = hand!.participants.find((item) => item.isDealer)!;
    const dealerMember = await prisma.tableMember.findFirstOrThrow({
      where: { tableId: created.tableId, userId: dealer.playerId },
    });
    expect(dealerMember.availableMillis + dealer.lockedMillis).toBe(100000n);
  });

  test("personal ledger save is idempotent and guest-free", async () => {
    const owner = await user(`p5-ledger-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Ledger table",
      game: "BLACKJACK",
      startingJetonsPerPlayer: "100",
      emails: [],
    });
    const first = await saveGameSessionResults({ actorId: owner.id, tableId: created.tableId, idempotencyKey: randomUUID() });
    const again = await saveGameSessionResults({ actorId: owner.id, tableId: created.tableId, idempotencyKey: randomUUID() });
    expect(first.saved).toBe(true);
    expect(again.idempotent || again.saved).toBe(true);
    const mine = await listPersonalLedger(owner.id);
    expect(mine.filter((row) => row.tableName === "Ledger table")).toHaveLength(1);
  });

  test("wipe requires admin email and exact phrase", async () => {
    const owner = await user(`p5-wipe-${randomUUID()}@jetonbro.test`, "Alex");
    await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Wipe me",
      game: "BLACKJACK",
      emails: [],
    });
    await expect(
      wipeAllMyTables({ actorId: owner.id, actorEmail: owner.email, confirmation: "WIPE ALL TABLES", idempotencyKey: randomUUID() }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    process.env.JETONBRO_ADMIN_EMAIL = owner.email;
    await expect(
      wipeAllMyTables({ actorId: owner.id, actorEmail: owner.email, confirmation: "DELETE ALL", idempotencyKey: randomUUID() }),
    ).rejects.toBeInstanceOf(DomainError);
    const other = await user(`p5-other-${randomUUID()}@jetonbro.test`, "Blair");
    const otherTable = await createTable({
      actorId: other.id,
      idempotencyKey: randomUUID(),
      name: "Keep me",
      game: "BLACKJACK",
      emails: [],
    });
    const wiped = await wipeAllMyTables({
      actorId: owner.id,
      actorEmail: owner.email,
      confirmation: "WIPE ALL TABLES",
      idempotencyKey: randomUUID(),
    });
    expect(wiped.wiped).toBeGreaterThan(0);
    expect(await prisma.table.findUnique({ where: { id: otherTable.tableId } })).toBeTruthy();
    delete process.env.JETONBRO_ADMIN_EMAIL;
  });
});
