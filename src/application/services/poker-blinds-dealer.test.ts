import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { loadSnapshot } from "@/application/queries/snapshot";
import { joinWithToken } from "@/application/services/invitations";
import { configurePoker, startTexasHoldem } from "@/application/services/poker-hand";
import { assignBankDealer, createTable, distributeJetons } from "@/application/services/tables";

let hasDb = Boolean(process.env.DATABASE_URL);
if (hasDb) {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    hasDb = false;
  }
}
const describeDb = hasDb ? describe : describe.skip;

function key() {
  return randomUUID();
}

async function user(email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, emailVerified: new Date() },
  });
}

describeDb("poker blinds: bank dealer vs owner", () => {
  test("non-owner bank dealer can change blinds between hands only; CHANGE GAME stays owner-only", async () => {
    const owner = await user(`owner-blinds-${key()}@jetonbro.test`, "Owner");
    const dealer = await user(`dealer-blinds-${key()}@jetonbro.test`, "Dealer");
    const player = await user(`player-blinds-${key()}@jetonbro.test`, "Player");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: key(),
      name: "Blinds dealer table",
      game: "POKER",
      smallBlind: "5",
      bigBlind: "10",
      startingJetonsPerPlayer: "100",
    });
    const tableId = created.tableId;
    const qr = await prisma.invitation.findFirstOrThrow({
      where: { tableId, kind: "QR", revokedAt: null },
    });
    await joinWithToken({ userId: dealer.id, token: qr.token, userEmail: dealer.email! });
    await joinWithToken({ userId: player.id, token: qr.token, userEmail: player.email! });
    await distributeJetons({
      actorId: owner.id,
      tableId,
      userId: dealer.id,
      amount: "100",
      idempotencyKey: key(),
    });
    await distributeJetons({
      actorId: owner.id,
      tableId,
      userId: player.id,
      amount: "100",
      idempotencyKey: key(),
    });
    await assignBankDealer({
      actorId: owner.id,
      tableId,
      userId: dealer.id,
      idempotencyKey: key(),
    });

    const setupDealer = await loadSnapshot(tableId, dealer.id);
    expect(setupDealer.isDealer).toBe(true);
    expect(setupDealer.isOwner).toBe(false);
    expect(setupDealer.poker?.canEditBlinds).toBe(true);
    expect(setupDealer.poker?.canSwitchGame).toBe(false);
    expect(setupDealer.poker?.role).toBe("POKER_DEALER");

    const setupOwner = await loadSnapshot(tableId, owner.id);
    expect(setupOwner.poker?.canSwitchGame).toBe(true);
    expect(setupOwner.poker?.canEditBlinds).toBe(true);

    await configurePoker({
      actorId: dealer.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "25",
      bigBlind: "50",
    });
    const after = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(after.pokerSmallBlindMillis).toBe(25_000n);
    expect(after.pokerBigBlindMillis).toBe(50_000n);

    await expect(
      configurePoker({
        actorId: dealer.id,
        tableId,
        idempotencyKey: key(),
        seatOrder: [dealer.id, owner.id, player.id],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "25",
      bigBlind: "50",
    });
    const live = await loadSnapshot(tableId, dealer.id);
    expect(live.poker?.canEditBlinds).toBe(false);
    expect(live.poker?.canSwitchGame).toBe(false);
    await expect(
      configurePoker({
        actorId: dealer.id,
        tableId,
        idempotencyKey: key(),
        smallBlind: "5",
        bigBlind: "10",
      }),
    ).rejects.toMatchObject({ code: "SEATS_LOCKED" });
  });
});
