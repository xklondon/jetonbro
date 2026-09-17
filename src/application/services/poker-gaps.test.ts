import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { listHomeTables } from "@/application/queries/home";
import { loadSnapshot } from "@/application/queries/snapshot";
import { joinWithToken } from "@/application/services/invitations";
import {
  advancePokerStreet,
  awardPokerPots,
  configurePoker,
  ensureNextPokerHandIfDue,
  pokerAct,
  scheduleNextPokerHand,
  startNextPokerHand,
  startTexasHoldem,
} from "@/application/services/poker-hand";
import { closeTable, createTable, distributeJetons, finalizeSetup, saveTable } from "@/application/services/tables";

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
    update: { name },
    create: { email, name, emailVerified: new Date() },
  });
}

function key() {
  return randomUUID();
}

async function directPokerTable(starting = "0") {
  const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
  const sam = await user(`sam-${randomUUID()}@jetonbro.test`, "Sam");
  const jo = await user(`jo-${randomUUID()}@jetonbro.test`, "Jo");
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: key(),
    name: "Direct Hold’em",
    game: "POKER",
    startingJetonsPerPlayer: starting,
    smallBlind: "5",
    bigBlind: "10",
  });
  const tableId = created.tableId;
  const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
  await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
  await joinWithToken({ userId: jo.id, token: qr.token, userEmail: jo.email });
  if (starting === "0") {
    await distributeJetons({ actorId: owner.id, tableId, userId: owner.id, amount: "100", idempotencyKey: key() });
    await distributeJetons({ actorId: owner.id, tableId, userId: sam.id, amount: "100", idempotencyKey: key() });
    await distributeJetons({ actorId: owner.id, tableId, userId: jo.id, amount: "100", idempotencyKey: key() });
  }
  return { owner, sam, jo, tableId };
}

async function foldOut(tableId: string, ownerId: string) {
  for (let i = 0; i < 8; i += 1) {
    const snap = await loadSnapshot(tableId, ownerId);
    if (snap.poker?.phase === "HAND_COMPLETE") return;
    const actor = snap.poker?.currentActorId;
    if (!actor) return;
    await pokerAct({ actorId: actor, tableId, type: "FOLD", idempotencyKey: key() });
  }
}

describeDb("Batch 3 Poker acceptance gaps", () => {
  test("Poker can be selected during table creation", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: key(),
      name: "Hold’em create",
      game: "POKER",
      smallBlind: "5",
      bigBlind: "10",
      startingJetonsPerPlayer: "80",
    });
    const table = await prisma.table.findUniqueOrThrow({ where: { id: created.tableId } });
    expect(table.game).toBe("POKER");
    expect(table.pokerSmallBlindMillis).toBe(5000n);
    expect(table.pokerBigBlindMillis).toBe(10000n);
  });

  test("Poker creation opens POKER_SETUP without a Blackjack round", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const draft = await createTable({
      actorId: owner.id,
      idempotencyKey: key(),
      name: "Draft then Poker",
      game: "BLACKJACK",
    });
    await finalizeSetup({
      actorId: owner.id,
      tableId: draft.tableId,
      idempotencyKey: key(),
      name: "Draft then Poker",
      game: "POKER",
      smallBlind: "5",
      bigBlind: "10",
      startingJetonsPerPlayer: "50",
    });
    const table = await prisma.table.findUniqueOrThrow({ where: { id: draft.tableId } });
    expect(table.game).toBe("POKER");
    expect(table.currentRoundId).toBeNull();
    expect(await prisma.round.count({ where: { tableId: draft.tableId } })).toBe(0);
    const snap = await loadSnapshot(draft.tableId, owner.id);
    expect(snap.phase).toBe("POKER_SETUP");
    expect(snap.poker?.phase).toBe("POKER_SETUP");
    expect(snap.bank).toBeNull();
    expect(snap.setup).toBeNull();
  });

  test("owner can reorder seats before the first hand and non-owners cannot", async () => {
    const { owner, sam, jo, tableId } = await directPokerTable();
    await configurePoker({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      seatOrder: [jo.id, owner.id, sam.id],
    });
    const seats = await prisma.pokerSeat.findMany({ where: { tableId }, orderBy: { orderIndex: "asc" } });
    expect(seats.map((seat) => seat.playerId)).toEqual([jo.id, owner.id, sam.id]);
    await expect(
      configurePoker({
        actorId: sam.id,
        tableId,
        idempotencyKey: key(),
        seatOrder: [sam.id, jo.id, owner.id],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const unchanged = await prisma.pokerSeat.findMany({ where: { tableId }, orderBy: { orderIndex: "asc" } });
    expect(unchanged.map((seat) => seat.playerId)).toEqual([jo.id, owner.id, sam.id]);
    await startTexasHoldem({ actorId: owner.id, tableId, idempotencyKey: key(), smallBlind: "5", bigBlind: "10" });
    await foldOut(tableId, owner.id);
    await expect(
      configurePoker({
        actorId: owner.id,
        tableId,
        idempotencyKey: key(),
        seatOrder: [sam.id, jo.id, owner.id],
      }),
    ).rejects.toMatchObject({ code: "SEATS_LOCKED" });
    const locked = await prisma.pokerSeat.findMany({ where: { tableId }, orderBy: { orderIndex: "asc" } });
    expect(locked.map((seat) => seat.playerId)).toEqual([jo.id, owner.id, sam.id]);
    const setup = await loadSnapshot(tableId, owner.id);
    expect(setup.poker?.canReorderSeats).toBe(false);
  });

  test("reordering is blocked during a hand and dealer rotation follows stored order", async () => {
    const { owner, sam, jo, tableId } = await directPokerTable();
    await configurePoker({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      seatOrder: [jo.id, sam.id, owner.id],
    });
    await startTexasHoldem({ actorId: owner.id, tableId, idempotencyKey: key(), smallBlind: "5", bigBlind: "10" });
    await expect(
      configurePoker({
        actorId: owner.id,
        tableId,
        idempotencyKey: key(),
        seatOrder: [owner.id, sam.id, jo.id],
      }),
    ).rejects.toMatchObject({ code: "SEATS_LOCKED" });
    const first = await prisma.pokerHand.findFirstOrThrow({ where: { tableId } });
    expect(first.dealerPlayerId).toBe(jo.id);
    expect(first.smallBlindPlayerId).toBe(sam.id);
    expect(first.bigBlindPlayerId).toBe(owner.id);
    await foldOut(tableId, owner.id);
    await startNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() });
    const next = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(next.dealerPlayerId).toBe(sam.id);
    expect(next.smallBlindPlayerId).toBe(owner.id);
    expect(next.bigBlindPlayerId).toBe(jo.id);
  });

  test("NEXT HAND NOW posts blinds once and the seven-second countdown is authoritative", async () => {
    const { owner, sam, jo, tableId } = await directPokerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    await foldOut(tableId, owner.id);
    const completed = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    const first = await scheduleNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() });
    const second = await scheduleNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() });
    expect(second.deadline).toBe(first.deadline);
    const stored = await prisma.pokerHand.findUniqueOrThrow({ where: { id: completed.id } });
    expect(stored.nextHandDeadlineAt?.toISOString()).toBe(first.deadline);

    await startNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() });
    await startNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() }).catch(() => undefined);
    const hands = await prisma.pokerHand.findMany({ where: { tableId } });
    expect(hands).toHaveLength(2);
    const blinds = await prisma.ledgerEntry.count({
      where: { tableId, transactionType: "POKER_BLIND_LOCKED", pokerHandId: hands.find((hand) => hand.number === 2)?.id },
    });
    expect(blinds).toBe(2);

    await foldOut(tableId, owner.id);
    const waiting = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    await scheduleNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() });
    await prisma.pokerHand.update({
      where: { id: waiting.id },
      data: { nextHandDeadlineAt: new Date(Date.now() - 50) },
    });
    await ensureNextPokerHandIfDue(tableId);
    await ensureNextPokerHandIfDue(tableId);
    expect(await prisma.pokerHand.count({ where: { tableId } })).toBe(3);
    const due = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(due.phase).toBe("PRE_FLOP");
    expect(
      await prisma.ledgerEntry.count({ where: { tableId, transactionType: "POKER_BLIND_LOCKED", pokerHandId: due.id } }),
    ).toBe(2);
  });

  test("Poker table cards show Poker phase and save/close is blocked with active value", async () => {
    const { owner, sam, jo, tableId } = await directPokerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    const home = (await listHomeTables(owner.id)).find((item) => item.id === tableId);
    expect(home?.headline).toBe("Texas Hold’em · PRE-FLOP");
    expect(home?.phase).not.toBe("BETTING");
    expect(home?.phase).not.toBe("TABLE_SETUP");
    expect(home?.canClose).toBe(false);
    expect(home?.canSave).toBe(false);
    const snap = await loadSnapshot(tableId, owner.id);
    expect(snap.headline).toBe("Texas Hold’em · PRE-FLOP");
    expect(snap.phase).toBe("PRE_FLOP");
    await expect(saveTable({ actorId: owner.id, tableId, idempotencyKey: key() })).rejects.toMatchObject({
      code: "LOCKED_FUNDS",
    });
    await expect(closeTable({ actorId: owner.id, tableId, idempotencyKey: key() })).rejects.toMatchObject({
      code: "LOCKED_FUNDS",
    });
    void sam;
    void jo;
  });

  test("current actor is clearly identified", async () => {
    const { owner, sam, jo, tableId } = await directPokerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    const actorSnap = await loadSnapshot(tableId, owner.id);
    expect(actorSnap.poker?.currentActorId).toBe(owner.id);
    expect(actorSnap.poker?.waitingCopy).toBe("YOUR TURN");
    expect(actorSnap.poker?.copy).toBe("YOUR TURN");
    expect(actorSnap.poker?.seats.find((seat) => seat.userId === owner.id)?.isActor).toBe(true);
    const waiting = await loadSnapshot(tableId, sam.id);
    expect(waiting.poker?.waitingCopy).toBe("Waiting for Owner");
    expect(waiting.poker?.seats.find((seat) => seat.userId === owner.id)?.isActor).toBe(true);
    void jo;
  });

  test("all-in side-pot settlement conserves balances and cannot pay twice", async () => {
    const { owner, sam, jo, tableId } = await directPokerTable();
    await prisma.tableMember.update({
      where: { tableId_userId: { tableId, userId: sam.id } },
      data: { availableMillis: 15000n },
    });
    const before = await prisma.tableMember.findMany({ where: { tableId, leftAt: null } });
    const beforeTotal = before.reduce((sum, member) => sum + member.availableMillis, 0n);
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    await pokerAct({ actorId: owner.id, tableId, type: "RAISE", amount: "20", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "ALL_IN", idempotencyKey: key() });
    await pokerAct({ actorId: jo.id, tableId, type: "CALL", idempotencyKey: key() });
    const mid = await loadSnapshot(tableId, owner.id);
    expect(mid.poker?.pots).toHaveLength(2);
    expect(mid.poker?.pots[0]?.eligiblePlayerIds).toEqual(expect.arrayContaining([owner.id, sam.id, jo.id]));
    expect(mid.poker?.pots[1]?.eligiblePlayerIds).toEqual(expect.arrayContaining([owner.id, jo.id]));
    expect(mid.poker?.pots[1]?.eligiblePlayerIds).not.toContain(sam.id);
    for (let street = 0; street < 4; street += 1) {
      const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
      if (hand.phase === "SHOWDOWN" || hand.phase === "HAND_COMPLETE") break;
      for (let act = 0; act < 6; act += 1) {
        const live = await prisma.pokerHand.findUniqueOrThrow({ where: { id: hand.id } });
        if (!live.currentActorPlayerId) break;
        await pokerAct({ actorId: live.currentActorPlayerId, tableId, type: "CHECK", idempotencyKey: key() });
      }
      const afterActs = await prisma.pokerHand.findUniqueOrThrow({ where: { id: hand.id } });
      if (afterActs.phase !== "SHOWDOWN" && afterActs.phase !== "HAND_COMPLETE") {
        await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
      }
    }
    const showdown = await prisma.pokerHand.findFirstOrThrow({
      where: { tableId },
      include: { pots: true },
      orderBy: { number: "desc" },
    });
    expect(showdown.phase).toBe("SHOWDOWN");
    const awardKey = key();
    await awardPokerPots({
      actorId: owner.id,
      tableId,
      idempotencyKey: awardKey,
      pots: [
        { index: 0, winnerIds: [sam.id] },
        { index: 1, winnerIds: [owner.id] },
      ],
    });
    await awardPokerPots({
      actorId: owner.id,
      tableId,
      idempotencyKey: awardKey,
      pots: [
        { index: 0, winnerIds: [sam.id] },
        { index: 1, winnerIds: [owner.id] },
      ],
    });
    await awardPokerPots({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      pots: [
        { index: 0, winnerIds: [sam.id] },
        { index: 1, winnerIds: [owner.id] },
      ],
    });
    const after = await prisma.tableMember.findMany({ where: { tableId, leftAt: null } });
    const afterTotal = after.reduce((sum, member) => sum + member.availableMillis, 0n);
    const locked = await prisma.pokerParticipant.aggregate({
      where: { hand: { tableId } },
      _sum: { lockedMillis: true },
    });
    expect(afterTotal + (locked._sum.lockedMillis ?? 0n)).toBe(beforeTotal);
    expect(await prisma.ledgerEntry.count({ where: { tableId, transactionType: "POKER_POT_AWARD" } })).toBe(2);
    const refreshed = await loadSnapshot(tableId, owner.id);
    expect(refreshed.poker?.phase).toBe("HAND_COMPLETE");
  });
});
