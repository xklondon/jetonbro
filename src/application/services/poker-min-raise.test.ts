import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { loadSnapshot } from "@/application/queries/snapshot";
import { joinWithToken } from "@/application/services/invitations";
import { advancePokerStreet, pokerAct, startTexasHoldem } from "@/application/services/poker-hand";
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
    name: "Min raise table",
    game: "POKER",
    startingJetonsPerPlayer: "0",
    smallBlind: "5",
    bigBlind: "10",
  });
  const tableId = created.tableId;
  const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
  await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
  await joinWithToken({ userId: jo.id, token: qr.token, userEmail: jo.email });
  await distributeJetons({ actorId: owner.id, tableId, userId: owner.id, amount: "500", idempotencyKey: key() });
  await distributeJetons({ actorId: owner.id, tableId, userId: sam.id, amount: "500", idempotencyKey: key() });
  await distributeJetons({ actorId: owner.id, tableId, userId: jo.id, amount: "500", idempotencyKey: key() });
  return { owner, sam, jo, tableId };
}

describeDb("Poker minimum raise tracking", () => {
  test("pre-flop raise 10→30 sets increment 20 so next min raise-to is 50 not 60", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    // Owner is UTG facing BB 10.
    const pre = await loadSnapshot(tableId, owner.id);
    expect(pre.poker?.streetWager.label).toBe("10");
    expect(pre.poker?.lastRaiseSize?.label).toBe("10");
    expect(pre.poker?.minRaiseTo?.label).toBe("20");
    expect(pre.poker?.legalActions.find((a) => a.type === "RAISE")?.raiseTo?.label).toBe("20");

    await pokerAct({ actorId: owner.id, tableId, type: "RAISE", amount: "30", idempotencyKey: key() });
    const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(hand.streetWagerMillis).toBe(30000n);
    expect(hand.lastRaiseSizeMillis).toBe(20000n);

    const samSnap = await loadSnapshot(tableId, sam.id);
    expect(samSnap.poker?.streetWager.label).toBe("30");
    expect(samSnap.poker?.lastRaiseSize?.label).toBe("20");
    expect(samSnap.poker?.minRaiseTo?.label).toBe("50");
    expect(samSnap.poker?.legalActions.find((a) => a.type === "RAISE")?.raiseTo?.label).toBe("50");
    await expect(
      pokerAct({ actorId: sam.id, tableId, type: "RAISE", amount: "40", idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: "ILLEGAL_ACTION" });
    await pokerAct({ actorId: sam.id, tableId, type: "RAISE", amount: "50", idempotencyKey: key() });
    const after = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(after.streetWagerMillis).toBe(50000n);
    expect(after.lastRaiseSizeMillis).toBe(20000n);
  });

  test("post-flop opening bet of 25 establishes increment 25 → min raise-to 50", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    // True heads-up: drop the third seat so blinds/action are HU.
    await prisma.pokerSeat.deleteMany({ where: { tableId, playerId: jo.id } });
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id],
    });
    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    // Heads-up postflop: BB (sam) acts first.
    const flopActor = (await loadSnapshot(tableId, owner.id)).poker?.currentActorId;
    expect(flopActor).toBe(sam.id);
    await pokerAct({ actorId: sam.id, tableId, type: "BET", amount: "25", idempotencyKey: key() });
    const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(hand.streetWagerMillis).toBe(25000n);
    expect(hand.lastRaiseSizeMillis).toBe(25000n);
    const ownerSnap = await loadSnapshot(tableId, owner.id);
    expect(ownerSnap.poker?.minRaiseTo?.label).toBe("50");
    expect(ownerSnap.poker?.legalActions.find((a) => a.type === "RAISE")?.raiseTo?.label).toBe("50");
  });

  test("short all-in raise does not reset the raise increment", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    // Sam can only shove to 25 after blinds/action — short of a full re-raise.
    await prisma.tableMember.update({
      where: { tableId_userId: { tableId, userId: sam.id } },
      data: { availableMillis: 25000n },
    });
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    // Owner min-raises to 20 (increment 10). Sam all-in to 25 (short raise of 5).
    await pokerAct({ actorId: owner.id, tableId, type: "RAISE", amount: "20", idempotencyKey: key() });
    const ownerSeat = await prisma.pokerParticipant.findFirstOrThrow({
      where: { hand: { tableId }, playerId: owner.id },
    });
    expect(ownerSeat.hasActedThisStreet).toBe(true);
    await pokerAct({ actorId: sam.id, tableId, type: "ALL_IN", idempotencyKey: key() });
    const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(hand.streetWagerMillis).toBe(25000n);
    // Short all-in keeps the prior full increment (10), does not become 5 or 25.
    expect(hand.lastRaiseSizeMillis).toBe(10000n);
    // Owner already acted; short all-in must not reopen them.
    const ownerAfter = await prisma.pokerParticipant.findFirstOrThrow({
      where: { hand: { tableId }, playerId: owner.id },
    });
    expect(ownerAfter.hasActedThisStreet).toBe(true);
    const joSnap = await loadSnapshot(tableId, jo.id);
    expect(joSnap.poker?.minRaiseTo?.label).toBe("35");
  });

  test("raise 40→65 with prior increment 20 is rejected; 40→65 after increment 20 from a prior full raise of 20 from 20", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    await pokerAct({ actorId: owner.id, tableId, type: "RAISE", amount: "20", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "RAISE", amount: "40", idempotencyKey: key() });
    // last raise 20→40 increment 20; jo cannot raise to 50 (only +10).
    await expect(
      pokerAct({ actorId: jo.id, tableId, type: "RAISE", amount: "50", idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: "ILLEGAL_ACTION" });
    await pokerAct({ actorId: jo.id, tableId, type: "RAISE", amount: "65", idempotencyKey: key() });
    const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(hand.streetWagerMillis).toBe(65000n);
    expect(hand.lastRaiseSizeMillis).toBe(25000n);
    const next = await loadSnapshot(tableId, owner.id);
    expect(next.poker?.minRaiseTo?.label).toBe("90");
  });
});
