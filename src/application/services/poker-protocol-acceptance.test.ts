import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { loadSnapshot } from "@/application/queries/snapshot";
import { joinWithToken } from "@/application/services/invitations";
import {
  advancePokerStreet,
  awardPokerPots,
  pokerAct,
  scheduleNextPokerHand,
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

async function seatedTable(names: string[], stacks: string[] = []) {
  const players = await Promise.all(names.map((name) => user(`${name}-${randomUUID()}@jetonbro.test`, name)));
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

function types(snap: Awaited<ReturnType<typeof loadSnapshot>>) {
  return snap.poker?.legalActions.map((action) => action.type) ?? [];
}

async function availableTotal(tableId: string) {
  const members = await prisma.tableMember.findMany({ where: { tableId, leftAt: null } });
  const locked = await prisma.pokerParticipant.aggregate({
    where: { hand: { tableId }, lockedMillis: { gt: 0n } },
    _sum: { lockedMillis: true },
  });
  return members.reduce((sum, member) => sum + member.availableMillis, 0n) + (locked._sum.lockedMillis ?? 0n);
}

function expectClosedHand(snap: Awaited<ReturnType<typeof loadSnapshot>>) {
  expect(snap.poker?.phase).toBe("HAND_COMPLETE");
  expect(snap.poker?.toCall.label).toBe("0");
  expect(snap.poker?.potPaid).toBe(true);
  expect(snap.poker?.currentActorId).toBeNull();
  expect(snap.poker?.waitingCopy).toBeNull();
  expect(snap.poker?.legalActions).toEqual([]);
  expect(snap.poker?.seats.every((seat) => !seat.isActor && seat.toCall.label === "0")).toBe(true);
  expect(snap.poker?.seats.some((seat) => seat.status === "ACTIVE" && seat.isActor)).toBe(false);
}

describeDb("Texas Hold’em two-hand acceptance", () => {
  test("heads-up fold then call/check/bet/call rotates the dealer and conserves jetons", async () => {
    const { players, owner, tableId } = await seatedTable(["Alex", "Sam"]);
    const sam = players[1]!;
    const startTotal = await availableTotal(tableId);
    expect(startTotal).toBe(200000n);

    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id],
    });

    const ownerPre = await loadSnapshot(tableId, owner.id);
    const samPre = await loadSnapshot(tableId, sam.id);
    expect(ownerPre.poker?.phase).toBe("PRE_FLOP");
    expect(ownerPre.poker?.pot.label).toBe("15");
    expect(ownerPre.poker?.toCall.label).toBe("5");
    expect(ownerPre.poker?.currentActorId).toBe(owner.id);
    expect(ownerPre.poker?.seats.find((seat) => seat.isDealer)?.userId).toBe(owner.id);
    expect(ownerPre.poker?.seats.find((seat) => seat.isSmallBlind)?.userId).toBe(owner.id);
    expect(ownerPre.poker?.seats.find((seat) => seat.isBigBlind)?.userId).toBe(sam.id);
    expect(ownerPre.poker?.seats.find((seat) => seat.isSmallBlind)?.streetContribution.label).toBe("5");
    expect(ownerPre.poker?.seats.find((seat) => seat.isBigBlind)?.streetContribution.label).toBe("10");
    expect(types(ownerPre)).toEqual(expect.arrayContaining(["CALL", "RAISE", "ALL_IN", "FOLD"]));
    expect(types(ownerPre)).not.toContain("CHECK");
    expect(ownerPre.poker?.legalActions.find((action) => action.type === "CALL")?.label).toBe("CALL 5");
    expect(ownerPre.poker?.pot).toEqual(samPre.poker?.pot);
    expect(ownerPre.poker?.currentActorId).toBe(samPre.poker?.currentActorId);
    expect(types(samPre)).toEqual([]);

    await pokerAct({ actorId: owner.id, tableId, type: "FOLD", idempotencyKey: key() });
    const ownerFold = await loadSnapshot(tableId, owner.id);
    const samFold = await loadSnapshot(tableId, sam.id);
    expectClosedHand(ownerFold);
    expectClosedHand(samFold);
    expect(ownerFold.poker?.winners[0]?.userId).toBe(sam.id);
    expect(ownerFold.poker?.winners[0]?.amount.label).toBe("15");
    expect(ownerFold.poker?.copy).toBe("Sam WON 15");
    expect(await availableTotal(tableId)).toBe(200000n);
    const afterFold = await prisma.tableMember.findMany({ where: { tableId, leftAt: null } });
    expect(afterFold.find((item) => item.userId === owner.id)?.availableMillis).toBe(95000n);
    expect(afterFold.find((item) => item.userId === sam.id)?.availableMillis).toBe(105000n);

    const refreshed = await loadSnapshot(tableId, owner.id);
    expectClosedHand(refreshed);

    await startNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() });
    const hand2Owner = await loadSnapshot(tableId, owner.id);
    const hand2Sam = await loadSnapshot(tableId, sam.id);
    expect(hand2Owner.poker?.phase).toBe("PRE_FLOP");
    expect(hand2Owner.poker?.handNumber).toBe(2);
    expect(hand2Owner.poker?.pot.label).toBe("15");
    expect(hand2Owner.poker?.seats.find((seat) => seat.isDealer)?.userId).toBe(sam.id);
    expect(hand2Owner.poker?.seats.find((seat) => seat.isSmallBlind)?.userId).toBe(sam.id);
    expect(hand2Owner.poker?.seats.find((seat) => seat.isBigBlind)?.userId).toBe(owner.id);
    expect(hand2Owner.poker?.currentActorId).toBe(sam.id);
    expect(hand2Sam.poker?.toCall.label).toBe("5");
    expect(types(hand2Sam)).toEqual(expect.arrayContaining(["CALL", "RAISE", "ALL_IN", "FOLD"]));
    expect(types(hand2Owner)).toEqual([]);

    await pokerAct({ actorId: sam.id, tableId, type: "CALL", idempotencyKey: key() });
    const afterCall = await loadSnapshot(tableId, owner.id);
    expect(afterCall.poker?.pot.label).toBe("20");
    expect(afterCall.poker?.toCall.label).toBe("0");
    expect(afterCall.poker?.currentActorId).toBe(owner.id);
    expect(types(afterCall)).toEqual(expect.arrayContaining(["CHECK", "RAISE", "ALL_IN"]));
    expect(types(afterCall)).not.toContain("CALL");
    expect(types(afterCall)).not.toContain("BET");

    await pokerAct({ actorId: owner.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    const flop = await loadSnapshot(tableId, owner.id);
    expect(flop.poker?.phase).toBe("FLOP");
    expect(flop.poker?.currentActorId).toBe(owner.id);
    expect(flop.poker?.pot.label).toBe("20");
    expect(types(flop)).toEqual(expect.arrayContaining(["CHECK", "BET", "ALL_IN", "FOLD"]));

    await pokerAct({ actorId: owner.id, tableId, type: "CHECK", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "BET", amount: "10", idempotencyKey: key() });
    const facing = await loadSnapshot(tableId, owner.id);
    expect(facing.poker?.toCall.label).toBe("10");
    expect(facing.poker?.pot.label).toBe("30");
    expect(types(facing)).toEqual(expect.arrayContaining(["CALL", "RAISE", "ALL_IN", "FOLD"]));
    expect(types(facing)).not.toContain("CHECK");
    expect(facing.poker?.legalActions.find((action) => action.type === "CALL")?.label).toBe("CALL 10");

    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    const called = await loadSnapshot(tableId, sam.id);
    expect(called.poker?.pot.label).toBe("40");
    expect(called.poker?.streetComplete).toBe(true);
    expect(called.poker?.currentActorId).toBeNull();

    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    const turn = await loadSnapshot(tableId, owner.id);
    expect(turn.poker?.phase).toBe("TURN");
    expect(turn.poker?.currentActorId).toBe(owner.id);
    expect(turn.poker?.pot.label).toBe("40");
    await pokerAct({ actorId: owner.id, tableId, type: "CHECK", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    const river = await loadSnapshot(tableId, owner.id);
    expect(river.poker?.phase).toBe("RIVER");
    expect(river.poker?.currentActorId).toBe(owner.id);
    await pokerAct({ actorId: owner.id, tableId, type: "CHECK", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });

    const showdown = await loadSnapshot(tableId, owner.id);
    expect(showdown.poker?.phase).toBe("SHOWDOWN");
    expect(showdown.poker?.toCall.label).toBe("0");
    expect(showdown.poker?.currentActorId).toBeNull();
    expect(showdown.poker?.legalActions).toEqual([]);
    const pots = showdown.poker?.pots ?? [];
    await awardPokerPots({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      pots: pots.map((pot) => ({ index: pot.index, winnerIds: [owner.id] })),
    });
    const paid = await loadSnapshot(tableId, owner.id);
    const paidSam = await loadSnapshot(tableId, sam.id);
    expectClosedHand(paid);
    expectClosedHand(paidSam);
    expect(paid.poker?.winners[0]?.userId).toBe(owner.id);
    expect(paid.poker?.winners[0]?.amount.label).toBe("40");
    expect(await availableTotal(tableId)).toBe(200000n);
    expect(await prisma.ledgerEntry.count({ where: { tableId, transactionType: "POKER_POT_AWARD" } })).toBe(2);

    await startNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() });
    const hand3 = await loadSnapshot(tableId, owner.id);
    expect(hand3.poker?.handNumber).toBe(3);
    expect(hand3.poker?.seats.find((seat) => seat.isDealer)?.userId).toBe(owner.id);
    expect(hand3.poker?.seats.find((seat) => seat.isSmallBlind)?.userId).toBe(owner.id);
    expect(hand3.poker?.seats.find((seat) => seat.isBigBlind)?.userId).toBe(sam.id);
    expect(hand3.poker?.pot.label).toBe("15");
    expect(hand3.poker?.currentActorId).toBe(owner.id);
    expect(await availableTotal(tableId)).toBe(200000n);
  });

  test("three-player blinds, short all-in call, and split pot conserve jetons", async () => {
    const { players, owner, tableId } = await seatedTable(["Owner", "Sam", "Jo"], ["100", "3", "100"]);
    const sam = players[1]!;
    const jo = players[2]!;
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    const pre = await loadSnapshot(tableId, owner.id);
    expect(pre.poker?.seats.find((seat) => seat.isSmallBlind)?.userId).toBe(sam.id);
    expect(pre.poker?.seats.find((seat) => seat.isBigBlind)?.userId).toBe(jo.id);
    expect(pre.poker?.currentActorId).toBe(owner.id);
    expect(pre.poker?.seats.find((seat) => seat.userId === sam.id)?.status).toBe("ALL_IN");
    expect(pre.poker?.seats.find((seat) => seat.userId === sam.id)?.streetContribution.label).toBe("3");
    expect(pre.poker?.toCall.label).toBe("10");
    expect(types(pre)).toEqual(expect.arrayContaining(["CALL", "RAISE", "ALL_IN", "FOLD"]));

    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    const afterOwner = await loadSnapshot(tableId, jo.id);
    expect(afterOwner.poker?.currentActorId).toBe(jo.id);
    expect(types(afterOwner)).toEqual(expect.arrayContaining(["CHECK", "RAISE", "ALL_IN"]));
    await pokerAct({ actorId: jo.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    expect((await loadSnapshot(tableId, owner.id)).poker?.phase).toBe("FLOP");
    expect(await availableTotal(tableId)).toBe(203000n);
  });

  test("manual and countdown next-hand share one rotation", async () => {
    const { players, owner, tableId } = await seatedTable(["Owner", "Sam"]);
    const sam = players[1]!;
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id],
    });
    await pokerAct({ actorId: owner.id, tableId, type: "FOLD", idempotencyKey: key() });
    await scheduleNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() });
    await startNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() });
    await expect(startNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() })).rejects.toThrow();
    const hands = await prisma.pokerHand.findMany({ where: { tableId }, orderBy: { number: "asc" } });
    expect(hands).toHaveLength(2);
    expect(hands[1]?.dealerPlayerId).toBe(sam.id);
    expect(hands[1]?.phase).toBe("PRE_FLOP");
  });
});
