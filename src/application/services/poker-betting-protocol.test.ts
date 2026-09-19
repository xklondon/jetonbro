import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable, distributeJetons } from "@/application/services/tables";
import { joinWithToken } from "@/application/services/invitations";
import { advancePokerStreet, pokerAct, startTexasHoldem } from "@/application/services/poker-hand";
import { loadSnapshot } from "@/application/queries/snapshot";

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

async function seatedTable(names: string[], stacks: string[] = []) {
  const players = await Promise.all(names.map((name, index) => user(`${name}-${randomUUID()}@jetonbro.test`, name)));
  const owner = players[0]!;
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: key(),
    name: "Protocol table",
    startingJetonsPerPlayer: "0",
    bankFundingMode: "LIMITED",
    startingBank: "500",
  });
  const tableId = created.tableId;
  const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
  for (const player of players.slice(1)) {
    await joinWithToken({ userId: player.id, token: qr.token, userEmail: player.email });
  }
  for (const [index, player] of players.entries()) {
    await distributeJetons({
      actorId: owner.id,
      tableId,
      userId: player.id,
      amount: stacks[index] ?? "100",
      idempotencyKey: key(),
    });
  }
  return { players, owner, tableId };
}

async function deal(tableId: string, ownerId: string, seatOrder: string[]) {
  await startTexasHoldem({
    actorId: ownerId,
    tableId,
    idempotencyKey: key(),
    smallBlind: "5",
    bigBlind: "10",
    seatOrder,
  });
}

function types(snap: Awaited<ReturnType<typeof loadSnapshot>>) {
  return snap.poker?.legalActions.map((action) => action.type) ?? [];
}

describeDb("Texas Hold’em betting protocol", () => {
  test("heads-up blinds, call amount, and post-flop order", async () => {
    const { players, owner, tableId } = await seatedTable(["Owner", "Sam"]);
    const sam = players[1]!;
    await deal(tableId, owner.id, [owner.id, sam.id]);
    const ownerSnap = await loadSnapshot(tableId, owner.id);
    const samSnap = await loadSnapshot(tableId, sam.id);
    const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId } });
    expect(hand.dealerPlayerId).toBe(owner.id);
    expect(hand.smallBlindPlayerId).toBe(owner.id);
    expect(hand.bigBlindPlayerId).toBe(sam.id);
    expect(hand.streetWagerMillis).toBe(10000n);
    expect(hand.currentActorPlayerId).toBe(owner.id);
    expect(ownerSnap.poker?.pot.label).toBe("15");
    expect(ownerSnap.poker?.toCall.label).toBe("5");
    expect(ownerSnap.poker?.currentActorId).toBe(samSnap.poker?.currentActorId);
    expect(ownerSnap.poker?.pot).toEqual(samSnap.poker?.pot);
    expect(types(ownerSnap)).toEqual(expect.arrayContaining(["CALL", "RAISE", "ALL_IN", "FOLD"]));
    expect(types(ownerSnap)).not.toContain("CHECK");
    expect(ownerSnap.poker?.legalActions.find((action) => action.type === "CALL")?.label).toBe("CALL 5");
    expect(ownerSnap.poker?.legalActions.find((action) => action.type === "ALL_IN")?.label).toMatch(/^ALL IN /);
    expect(types(samSnap)).toEqual([]);
    await expect(pokerAct({ actorId: owner.id, tableId, type: "CHECK", idempotencyKey: key() })).rejects.toMatchObject({
      code: "ILLEGAL_ACTION",
    });
    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    const bb = await loadSnapshot(tableId, sam.id);
    expect(bb.poker?.toCall.label).toBe("0");
    expect(types(bb)).toEqual(expect.arrayContaining(["CHECK", "RAISE", "ALL_IN", "FOLD"]));
    expect(types(bb)).not.toContain("CALL");
    await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    const flopOwner = await loadSnapshot(tableId, owner.id);
    const flopSam = await loadSnapshot(tableId, sam.id);
    expect(flopOwner.poker?.phase).toBe("FLOP");
    expect(flopOwner.poker?.currentActorId).toBe(sam.id);
    expect(types(flopSam)).toEqual(expect.arrayContaining(["CHECK", "BET", "ALL_IN", "FOLD"]));
    const again = await loadSnapshot(tableId, owner.id);
    expect(again.poker?.currentActorId).toBe(sam.id);
    expect(again.poker?.seats.map((seat) => [seat.userId, seat.streetContribution.label, seat.isActor])).toEqual(
      flopSam.poker?.seats.map((seat) => [seat.userId, seat.streetContribution.label, seat.isActor]),
    );
  });

  test("three-player order, opening bet, min raise, and street close", async () => {
    const { players, owner, tableId } = await seatedTable(["Owner", "Sam", "Jo"]);
    const sam = players[1]!;
    const jo = players[2]!;
    await deal(tableId, owner.id, [owner.id, sam.id, jo.id]);
    const pre = await loadSnapshot(tableId, owner.id);
    expect(pre.poker?.seats.find((seat) => seat.isSmallBlind)?.name).toBe("Sam");
    expect(pre.poker?.seats.find((seat) => seat.isBigBlind)?.name).toBe("Jo");
    expect(pre.poker?.currentActorId).toBe(owner.id);
    expect(pre.poker?.toCall.label).toBe("10");
    expect(pre.poker?.streetComplete).toBe(false);
    await expect(advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() })).rejects.toMatchObject({
      code: "STREET_OPEN",
    });
    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CALL", idempotencyKey: key() });
    const bb = await loadSnapshot(tableId, jo.id);
    expect(types(bb)).toEqual(expect.arrayContaining(["CHECK", "RAISE"]));
    expect(bb.poker?.legalActions.find((action) => action.type === "RAISE")?.raiseTo?.label).toBe("20");
    await pokerAct({ actorId: jo.id, tableId, type: "RAISE", amount: "20", idempotencyKey: key() });
    const afterRaise = await loadSnapshot(tableId, owner.id);
    expect(afterRaise.poker?.toCall.label).toBe("10");
    expect(afterRaise.poker?.currentActorId).toBe(owner.id);
    expect(afterRaise.poker?.streetComplete).toBe(false);
    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CALL", idempotencyKey: key() });
    const closed = await loadSnapshot(tableId, owner.id);
    expect(closed.poker?.streetComplete).toBe(true);
    expect(closed.poker?.currentActorId).toBeNull();
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    const flop = await loadSnapshot(tableId, sam.id);
    expect(flop.poker?.phase).toBe("FLOP");
    expect(flop.poker?.currentActorId).toBe(sam.id);
    expect(types(flop)).toEqual(expect.arrayContaining(["CHECK", "BET"]));
    await pokerAct({ actorId: sam.id, tableId, type: "BET", amount: "10", idempotencyKey: key() });
    const facing = await loadSnapshot(tableId, jo.id);
    expect(facing.poker?.toCall.label).toBe("10");
    expect(types(facing)).toEqual(expect.arrayContaining(["CALL", "RAISE", "FOLD"]));
    expect(types(facing)).not.toContain("CHECK");
  });

  test("fold ends the hand and short all-in does not reopen raising", async () => {
    const { players, owner, tableId } = await seatedTable(["Owner", "Sam", "Jo"], ["100", "100", "25"]);
    const sam = players[1]!;
    const jo = players[2]!;
    await deal(tableId, owner.id, [owner.id, sam.id, jo.id]);
    await pokerAct({ actorId: owner.id, tableId, type: "RAISE", amount: "20", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CALL", idempotencyKey: key() });
    await pokerAct({ actorId: jo.id, tableId, type: "ALL_IN", idempotencyKey: key() });
    const ownerAfter = await loadSnapshot(tableId, owner.id);
    expect(ownerAfter.poker?.toCall.label).toBe("5");
    expect(types(ownerAfter)).toEqual(["FOLD", "CALL", "ALL_IN"]);
    expect(types(ownerAfter)).not.toContain("RAISE");
    await pokerAct({ actorId: owner.id, tableId, type: "FOLD", idempotencyKey: key() });
    const samAfter = await loadSnapshot(tableId, sam.id);
    expect(samAfter.poker?.seats.find((seat) => seat.userId === owner.id)?.status).toBe("FOLDED");
    expect(samAfter.poker?.currentActorId).toBe(sam.id);
    await pokerAct({ actorId: sam.id, tableId, type: "FOLD", idempotencyKey: key() });
    const ended = await loadSnapshot(tableId, owner.id);
    expect(ended.poker?.phase).toBe("HAND_COMPLETE");
    expect(ended.poker?.winners[0]?.userId).toBe(jo.id);
    expect(ended.poker?.currentActorId).toBeNull();
  });

  test("side pots and bank/player views stay aligned after refresh", async () => {
    const { players, owner, tableId } = await seatedTable(["Owner", "Sam", "Jo"], ["100", "40", "100"]);
    const sam = players[1]!;
    const jo = players[2]!;
    await deal(tableId, owner.id, [owner.id, sam.id, jo.id]);
    await pokerAct({ actorId: owner.id, tableId, type: "RAISE", amount: "80", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "ALL_IN", idempotencyKey: key() });
    await pokerAct({ actorId: jo.id, tableId, type: "CALL", idempotencyKey: key() });
    const ownerSnap = await loadSnapshot(tableId, owner.id);
    const samSnap = await loadSnapshot(tableId, sam.id);
    expect(ownerSnap.poker?.pots.length).toBeGreaterThan(1);
    expect(ownerSnap.poker?.pots.map((pot) => pot.amount.label)).toEqual(samSnap.poker?.pots.map((pot) => pot.amount.label));
    expect(ownerSnap.poker?.currentActorId).toBe(samSnap.poker?.currentActorId);
    expect(ownerSnap.poker?.pot).toEqual(samSnap.poker?.pot);
    const refreshed = await loadSnapshot(tableId, owner.id);
    expect(refreshed.poker?.legalActions.map((action) => action.type)).toEqual(
      ownerSnap.poker?.legalActions.map((action) => action.type),
    );
    expect(refreshed.poker?.seats.map((seat) => seat.streetContribution.label)).toEqual(
      ownerSnap.poker?.seats.map((seat) => seat.streetContribution.label),
    );
  });
});
