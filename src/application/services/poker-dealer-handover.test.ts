import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { loadSnapshot } from "@/application/queries/snapshot";
import { joinWithToken } from "@/application/services/invitations";
import {
  configurePoker,
  pokerAct,
  startNextPokerHand,
  startTexasHoldem,
} from "@/application/services/poker-hand";
import { createTable, distributeJetons } from "@/application/services/tables";

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

async function threePlayerTable() {
  const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
  const sam = await user(`sam-${randomUUID()}@jetonbro.test`, "Sam");
  const jo = await user(`jo-${randomUUID()}@jetonbro.test`, "Jo");
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: key(),
    name: "Handover table",
    game: "POKER",
    startingJetonsPerPlayer: "0",
    smallBlind: "5",
    bigBlind: "10",
  });
  const tableId = created.tableId;
  const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
  await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
  await joinWithToken({ userId: jo.id, token: qr.token, userEmail: jo.email });
  await distributeJetons({ actorId: owner.id, tableId, userId: owner.id, amount: "100", idempotencyKey: key() });
  await distributeJetons({ actorId: owner.id, tableId, userId: sam.id, amount: "100", idempotencyKey: key() });
  await distributeJetons({ actorId: owner.id, tableId, userId: jo.id, amount: "100", idempotencyKey: key() });
  return { owner, sam, jo, tableId };
}

async function foldOut(tableId: string, viewerId: string) {
  for (let i = 0; i < 8; i += 1) {
    const snap = await loadSnapshot(tableId, viewerId);
    if (snap.poker?.phase === "HAND_COMPLETE") return;
    const actor = snap.poker?.currentActorId;
    if (!actor) return;
    await pokerAct({ actorId: actor, tableId, type: "FOLD", idempotencyKey: key() });
  }
}

describeDb("Poker dealer handover and seat reorder", () => {
  test("three consecutive hands hand START HAND to the next dealer only", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });

    const dealers: string[] = [];
    for (let hand = 1; hand <= 3; hand += 1) {
      const live = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
      dealers.push(live.dealerPlayerId);
      await foldOut(tableId, owner.id);
      const complete = await loadSnapshot(tableId, owner.id);
      expect(complete.poker?.phase).toBe("HAND_COMPLETE");
      const nextId = complete.poker?.nextDealerPlayerId;
      expect(nextId).toBeTruthy();
      expect((await loadSnapshot(tableId, nextId!)).poker?.canNextHand).toBe(true);
      for (const player of [owner, sam, jo]) {
        if (player.id === nextId) continue;
        expect((await loadSnapshot(tableId, player.id)).poker?.canNextHand).toBe(false);
      }
      const interloper = nextId === owner.id ? sam.id : owner.id;
      await expect(
        startNextPokerHand({ actorId: interloper, tableId, idempotencyKey: key() }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await startNextPokerHand({ actorId: nextId!, tableId, idempotencyKey: key() });
    }

    expect(dealers).toEqual([owner.id, sam.id, jo.id]);
    const fourth = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(fourth.number).toBe(4);
    expect(fourth.dealerPlayerId).toBe(owner.id);
  });

  test("owner seat reorder between hands changes the next dealer path", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    await foldOut(tableId, owner.id);
    await configurePoker({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      seatOrder: [owner.id, jo.id, sam.id],
    });
    const seats = await prisma.pokerSeat.findMany({ where: { tableId }, orderBy: { orderIndex: "asc" } });
    expect(seats.map((seat) => seat.playerId)).toEqual([owner.id, jo.id, sam.id]);
    // Prior dealer was owner; with new order next dealer is jo (not sam).
    const preview = await loadSnapshot(tableId, jo.id);
    expect(preview.poker?.nextDealerPlayerId).toBe(jo.id);
    expect(preview.poker?.canNextHand).toBe(true);
    expect(preview.poker?.canReorderSeats).toBe(false);
    expect((await loadSnapshot(tableId, owner.id)).poker?.canReorderSeats).toBe(true);
    await startNextPokerHand({ actorId: jo.id, tableId, idempotencyKey: key() });
    const next = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(next.dealerPlayerId).toBe(jo.id);
    expect(next.smallBlindPlayerId).toBe(sam.id);
    expect(next.bigBlindPlayerId).toBe(owner.id);
  });
});
