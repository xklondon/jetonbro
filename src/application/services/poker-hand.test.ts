import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable, distributeJetons } from "@/application/services/tables";
import { joinWithToken } from "@/application/services/invitations";
import { placeOrRetractBet, setBankFunding, startBetting, ensureBettingClosedIfDue } from "@/application/services/blackjack-round";
import { switchGame } from "@/application/services/switch-game";
import {
  advancePokerStreet,
  awardPokerPots,
  pokerAct,
  startNextPokerHand,
  startTexasHoldem,
} from "@/application/services/poker-hand";
import { loadSnapshot } from "@/application/queries/snapshot";
import { shouldApplySnapshot } from "@/ui/core/snapshot-revision";

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

async function tableValue(tableId: string) {
  const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
  const members = await prisma.tableMember.findMany({ where: { tableId, leftAt: null } });
  const locked = await prisma.pokerParticipant.aggregate({
    where: { hand: { tableId }, lockedMillis: { gt: 0n } },
    _sum: { lockedMillis: true },
  });
  const available = members.reduce((sum, member) => sum + member.availableMillis, 0n);
  return {
    table,
    members,
    available,
    lockedPoker: locked._sum.lockedMillis ?? 0n,
    bank: table.bankAvailableMillis + table.bankLockedExposureMillis,
    total: available + (locked._sum.lockedMillis ?? 0n) + table.bankAvailableMillis + table.bankLockedExposureMillis,
  };
}

async function threePlayerTable() {
  const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
  const sam = await user(`sam-${randomUUID()}@jetonbro.test`, "Sam");
  const jo = await user(`jo-${randomUUID()}@jetonbro.test`, "Jo");
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: key(),
    name: "Hold’em table",
    startingJetonsPerPlayer: "0",
    bankFundingMode: "LIMITED",
    startingBank: "500",
  });
  const tableId = created.tableId;
  const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
  await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
  await joinWithToken({ userId: jo.id, token: qr.token, userEmail: jo.email });
  await distributeJetons({ actorId: owner.id, tableId, userId: sam.id, amount: "100", idempotencyKey: key() });
  await distributeJetons({ actorId: owner.id, tableId, userId: jo.id, amount: "100", idempotencyKey: key() });
  await distributeJetons({ actorId: owner.id, tableId, userId: owner.id, amount: "100", idempotencyKey: key() });
  return { owner, sam, jo, tableId };
}

describeDb("Texas Hold’em and game switching", () => {
  test("cannot switch with a locked blackjack bet and preserves balances when allowed", async () => {
    const { owner, sam, tableId } = await threePlayerTable();
    const beforeBank = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: key() });
    const box = await prisma.bettingBox.findFirstOrThrow({ where: { playerId: sam.id, round: { tableId }, removedAt: null } });
    await placeOrRetractBet({
      actorId: sam.id,
      tableId,
      boxId: box.id,
      amount: "25",
      mode: "SET",
      idempotencyKey: key(),
    });
    await expect(switchGame({ actorId: owner.id, tableId, game: "POKER", idempotencyKey: key() })).rejects.toMatchObject({
      code: "SWITCH_BLOCKED",
    });
    await expect(
      setBankFunding({ actorId: owner.id, tableId, bankFundingMode: "OPEN", idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: "FUNDING_LOCKED" });
    await placeOrRetractBet({
      actorId: sam.id,
      tableId,
      boxId: box.id,
      amount: "25",
      mode: "RETRACT",
      idempotencyKey: key(),
    });
    const samBefore = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: sam.id } },
    });
    const before = await tableValue(tableId);
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
    });
    const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(table.game).toBe("POKER");
    expect(table.bankAvailableMillis).toBe(beforeBank.bankAvailableMillis);
    const poker = await loadSnapshot(tableId, owner.id);
    expect(poker.poker?.phase).toBe("PRE_FLOP");
    expect(poker.bank).toBeNull();
    expect(poker.player).toBeNull();
    const samAfter = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: sam.id } },
    });
    expect(
      samAfter.availableMillis +
        (await prisma.pokerParticipant.aggregate({
          where: { playerId: sam.id, hand: { tableId } },
          _sum: { lockedMillis: true },
        }))._sum.lockedMillis!,
    ).toBe(samBefore.availableMillis);
    const after = await tableValue(tableId);
    expect(after.total).toBe(before.total);
    expect(after.bank).toBe(before.bank);
  });

  test("switch to Hold’em pauses on POKER_SETUP until DEAL CARDS posts blinds and marks the actor", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await switchGame({
      actorId: owner.id,
      tableId,
      game: "POKER",
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
      idempotencyKey: key(),
    });
    const setup = await loadSnapshot(tableId, owner.id);
    expect(setup.poker?.phase).toBe("POKER_SETUP");
    expect(setup.poker?.canReorderSeats).toBe(true);
    expect(setup.poker?.currentActorId).toBeNull();
    expect(setup.poker?.legalActions).toEqual([]);
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
    });
    const ownerSnap = await loadSnapshot(tableId, owner.id);
    const samSnap = await loadSnapshot(tableId, sam.id);
    expect(ownerSnap.poker?.phase).toBe("PRE_FLOP");
    expect(ownerSnap.poker?.canReorderSeats).toBe(false);
    expect(samSnap.poker?.canReorderSeats).toBe(false);
    expect(ownerSnap.poker?.seats).toEqual(samSnap.poker?.seats);
    expect(ownerSnap.poker?.pot).toEqual(samSnap.poker?.pot);
    expect(ownerSnap.poker?.currentActorId).toBe(owner.id);
    expect(ownerSnap.poker?.waitingCopy).toBe("YOUR TURN");
    expect(samSnap.poker?.waitingCopy).toBe("Waiting for Owner");
    expect(ownerSnap.poker?.legalActions.some((action) => action.type === "CALL")).toBe(true);
    expect(samSnap.poker?.legalActions).toEqual([]);
    const blinds = ownerSnap.poker?.seats ?? [];
    expect(blinds.find((seat) => seat.isSmallBlind)?.available.label).toBe("95");
    expect(blinds.find((seat) => seat.isBigBlind)?.available.label).toBe("90");
  });

  test("three-player blinds, actor-only actions, fold-to-one, and next-hand rotation", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, include: { participants: true } });
    expect(hand.dealerPlayerId).toBe(owner.id);
    expect(hand.smallBlindPlayerId).toBe(sam.id);
    expect(hand.bigBlindPlayerId).toBe(jo.id);
    expect(hand.currentActorPlayerId).toBe(owner.id);
    await expect(advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() })).rejects.toMatchObject({
      code: "STREET_OPEN",
    });
    await expect(pokerAct({ actorId: owner.id, tableId, type: "CHECK", idempotencyKey: key() })).rejects.toMatchObject({
      code: "ILLEGAL_ACTION",
    });
    await expect(pokerAct({ actorId: sam.id, tableId, type: "FOLD", idempotencyKey: key() })).rejects.toMatchObject({
      code: "TURN_CONFLICT",
    });
    const firstSnap = await loadSnapshot(tableId, owner.id);
    await pokerAct({ actorId: owner.id, tableId, type: "FOLD", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "FOLD", idempotencyKey: key() });
    const ended = await prisma.pokerHand.findUniqueOrThrow({ where: { id: hand.id } });
    expect(ended.phase).toBe("HAND_COMPLETE");
    const laterSnap = await loadSnapshot(tableId, owner.id);
    expect(
      shouldApplySnapshot(
        {
          revision: laterSnap.revision,
          phase: laterSnap.phase,
          roundNumber: laterSnap.roundNumber,
          turnNumber: laterSnap.turnNumber,
        },
        {
          revision: firstSnap.revision,
          phase: firstSnap.phase,
          roundNumber: firstSnap.roundNumber,
          turnNumber: firstSnap.turnNumber,
        },
      ),
    ).toBe(false);
    const joMember = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: jo.id } },
    });
    expect(joMember.availableMillis).toBeGreaterThan(100000n - 10000n);
    const bank = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(bank.bankAvailableMillis).toBe(500000n);
    await startNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() });
    const next = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(next.dealerPlayerId).toBe(sam.id);
    expect(next.smallBlindPlayerId).toBe(jo.id);
    expect(next.bigBlindPlayerId).toBe(owner.id);
    expect(next.number).toBe(2);
    await expect(startNextPokerHand({ actorId: owner.id, tableId, idempotencyKey: key() })).rejects.toThrow();
  });

  test("heads-up blinds and action order", async () => {
    const { owner, sam, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id],
    });
    const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId } });
    expect(hand.dealerPlayerId).toBe(owner.id);
    expect(hand.smallBlindPlayerId).toBe(owner.id);
    expect(hand.bigBlindPlayerId).toBe(sam.id);
    expect(hand.currentActorPlayerId).toBe(owner.id);
    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    const flop = await prisma.pokerHand.findUniqueOrThrow({ where: { id: hand.id } });
    expect(flop.phase).toBe("FLOP");
    expect(flop.currentActorPlayerId).toBe(sam.id);
  });

  test("a full raise reopens action for players who already acted", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CALL", idempotencyKey: key() });
    await pokerAct({ actorId: jo.id, tableId, type: "RAISE", amount: "20", idempotencyKey: key() });
    const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, include: { participants: true } });
    const ownerSeat = hand.participants.find((item) => item.playerId === owner.id)!;
    expect(ownerSeat.hasActedThisStreet).toBe(false);
    expect(hand.currentActorPlayerId).toBe(owner.id);
    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
  });

  test("showdown split conserves millijetons and cannot pay twice", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CALL", idempotencyKey: key() });
    await pokerAct({ actorId: jo.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });
    await pokerAct({ actorId: jo.id, tableId, type: "CHECK", idempotencyKey: key() });
    await pokerAct({ actorId: owner.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });
    await pokerAct({ actorId: jo.id, tableId, type: "CHECK", idempotencyKey: key() });
    await pokerAct({ actorId: owner.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });
    await pokerAct({ actorId: jo.id, tableId, type: "CHECK", idempotencyKey: key() });
    await pokerAct({ actorId: owner.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, include: { pots: true } });
    expect(hand.phase).toBe("SHOWDOWN");
    await expect(
      awardPokerPots({
        actorId: owner.id,
        tableId,
        idempotencyKey: key(),
        pots: hand.pots.map((pot) => ({ index: pot.index, winnerIds: [randomUUID()] })),
      }),
    ).rejects.toMatchObject({ code: "INELIGIBLE_WINNER" });
    const awardKey = key();
    await awardPokerPots({
      actorId: owner.id,
      tableId,
      idempotencyKey: awardKey,
      pots: hand.pots.map((pot) => ({ index: pot.index, winnerIds: [sam.id, jo.id] })),
    });
    await awardPokerPots({
      actorId: owner.id,
      tableId,
      idempotencyKey: awardKey,
      pots: hand.pots.map((pot) => ({ index: pot.index, winnerIds: [sam.id, jo.id] })),
    });
    await awardPokerPots({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      pots: hand.pots.map((pot) => ({ index: pot.index, winnerIds: [sam.id, jo.id] })),
    });
    const awards = await prisma.ledgerEntry.count({ where: { tableId, transactionType: "POKER_POT_AWARD" } });
    expect(awards).toBe(2);
    const after = await tableValue(tableId);
    expect(after.available + after.lockedPoker).toBe(300000n);
    expect(after.bank).toBe(500000n);
    await switchGame({ actorId: owner.id, tableId, game: "BLACKJACK", idempotencyKey: key() });
    const back = await loadSnapshot(tableId, owner.id);
    expect(back.game).toBe("BLACKJACK");
    expect(back.poker).toBeNull();
    expect(back.setup ?? back.bank).not.toBeNull();
    const restored = await tableValue(tableId);
    expect(restored.bank).toBe(500000n);
    expect(restored.available).toBe(300000n);
  });

  test("all-in creates a side pot", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await prisma.tableMember.update({
      where: { tableId_userId: { tableId, userId: sam.id } },
      data: { availableMillis: 15000n },
    });
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
    const pots = await prisma.pokerPot.findMany({ where: { hand: { tableId } }, orderBy: { index: "asc" } });
    expect(pots).toHaveLength(2);
    expect(pots[0]?.eligiblePlayerIds).toEqual(expect.arrayContaining([owner.id, sam.id, jo.id]));
    expect(pots[1]?.eligiblePlayerIds).toEqual(expect.arrayContaining([owner.id, jo.id]));
    expect(pots[1]?.eligiblePlayerIds).not.toContain(sam.id);
  });

  test("P1 action offers P2 legal actions, blinds post once, and DEAL FLOP waits for a matched street", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    const blinds = await prisma.ledgerEntry.findMany({
      where: { tableId, transactionType: "POKER_BLIND_LOCKED" },
    });
    expect(blinds).toHaveLength(2);
    const ownerSnap = await loadSnapshot(tableId, owner.id);
    expect(ownerSnap.poker?.role).toBe("POKER_DEALER");
    expect(ownerSnap.poker?.currentActorId).toBe(owner.id);
    expect(ownerSnap.poker?.legalActions.map((action) => action.type)).toEqual(
      expect.arrayContaining(["FOLD", "CALL", "RAISE", "ALL_IN"]),
    );
    expect(ownerSnap.poker?.canDealStreet).toBe(false);
    expect(ownerSnap.poker?.nextStreetLabel).toBe("DEAL FLOP");
    expect(ownerSnap.poker?.seats.find((seat) => seat.userId === owner.id)?.isDealer).toBe(true);
    expect(ownerSnap.poker?.seats.find((seat) => seat.userId === sam.id)?.isSmallBlind).toBe(true);
    expect(ownerSnap.poker?.seats.find((seat) => seat.userId === jo.id)?.isBigBlind).toBe(true);
    expect(ownerSnap.poker?.seats.find((seat) => seat.userId === sam.id)?.available.label).toBe("95");
    expect(ownerSnap.poker?.seats.find((seat) => seat.userId === jo.id)?.available.label).toBe("90");
    expect(ownerSnap.poker?.available.label).toBe("100");

    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    const samSnap = await loadSnapshot(tableId, sam.id);
    expect(samSnap.poker?.currentActorId).toBe(sam.id);
    expect(samSnap.poker?.waitingCopy).toBe("YOUR TURN");
    expect(samSnap.poker?.legalActions.map((action) => action.type)).toEqual(
      expect.arrayContaining(["FOLD", "CALL", "RAISE", "ALL_IN"]),
    );
    const ownerWaiting = await loadSnapshot(tableId, owner.id);
    expect(ownerWaiting.poker?.legalActions).toEqual([]);
    expect(ownerWaiting.poker?.waitingCopy).toMatch(/^Waiting for /);
    expect(ownerWaiting.poker?.canDealStreet).toBe(false);
    await expect(pokerAct({ actorId: owner.id, tableId, type: "FOLD", idempotencyKey: key() })).rejects.toMatchObject({
      code: "TURN_CONFLICT",
    });

    await pokerAct({ actorId: sam.id, tableId, type: "CALL", idempotencyKey: key() });
    await pokerAct({ actorId: jo.id, tableId, type: "CHECK", idempotencyKey: key() });
    const matched = await loadSnapshot(tableId, owner.id);
    expect(matched.poker?.streetComplete).toBe(true);
    expect(matched.poker?.canDealStreet).toBe(true);
    expect(matched.poker?.currentActorId).toBeNull();
    const samMatched = await loadSnapshot(tableId, sam.id);
    expect(samMatched.poker?.canDealStreet).toBe(false);
    expect(samMatched.poker?.legalActions).toEqual([]);
    expect(samMatched.poker?.nextStreetLabel).toBeNull();
  });

  test("folded and all-in players lose actor controls while owner still advances streets", async () => {
    const { owner, sam, jo, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    await pokerAct({ actorId: owner.id, tableId, type: "FOLD", idempotencyKey: key() });
    const folded = await loadSnapshot(tableId, owner.id);
    expect(folded.poker?.viewerStatus).toBe("FOLDED");
    expect(folded.poker?.legalActions).toEqual([]);
    expect(folded.poker?.seats.find((seat) => seat.userId === owner.id)?.isDealer).toBe(true);
    expect(folded.poker?.nextStreetLabel).toBe("DEAL FLOP");
    expect(folded.poker?.canDealStreet).toBe(false);

    await pokerAct({ actorId: sam.id, tableId, type: "ALL_IN", idempotencyKey: key() });
    const allInSam = await loadSnapshot(tableId, sam.id);
    expect(allInSam.poker?.viewerStatus).toBe("ALL_IN");
    expect(allInSam.poker?.legalActions).toEqual([]);
    expect(allInSam.poker?.nextStreetLabel).toBeNull();
    expect(allInSam.poker?.canDealStreet).toBe(false);
  });

  test("Poker snapshot loading does not run Blackjack close-betting", async () => {
    const { owner, sam, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id],
    });
    await expect(ensureBettingClosedIfDue(tableId)).resolves.toBe(false);
    await expect(loadSnapshot(tableId, owner.id)).resolves.toMatchObject({ game: "POKER" });
  });

  test("heads-up snapshots keep actor-only controls on every street", async () => {
    const { owner, sam, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id],
    });
    const setup = await loadSnapshot(tableId, owner.id);
    expect(setup.poker?.phase).toBe("PRE_FLOP");
    expect(setup.poker?.legalActions.length).toBeGreaterThan(0);
    expect((await loadSnapshot(tableId, sam.id)).poker?.legalActions).toEqual([]);

    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: key() });
    expect((await loadSnapshot(tableId, sam.id)).poker?.legalActions.map((action) => action.type)).toEqual(
      expect.arrayContaining(["CHECK"]),
    );
    await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });

    for (const label of ["DEAL FLOP", "DEAL TURN", "DEAL RIVER", "SHOWDOWN"] as const) {
      const ownerMatched = await loadSnapshot(tableId, owner.id);
      const samMatched = await loadSnapshot(tableId, sam.id);
      expect(ownerMatched.poker?.canDealStreet).toBe(true);
      expect(ownerMatched.poker?.nextStreetLabel).toBe(label);
      expect(ownerMatched.poker?.legalActions).toEqual([]);
      expect(samMatched.poker?.canDealStreet).toBe(false);
      expect(samMatched.poker?.nextStreetLabel).toBeNull();
      expect(samMatched.poker?.legalActions).toEqual([]);
      if (label === "SHOWDOWN") break;
      await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
      const actor = await loadSnapshot(tableId, sam.id);
      expect(actor.poker?.waitingCopy).toBe("YOUR TURN");
      expect(actor.poker?.legalActions.map((item) => item.type)).toEqual(expect.arrayContaining(["CHECK"]));
      expect((await loadSnapshot(tableId, owner.id)).poker?.legalActions).toEqual([]);
      await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });
      await pokerAct({ actorId: owner.id, tableId, type: "CHECK", idempotencyKey: key() });
    }

    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    const showdown = await loadSnapshot(tableId, owner.id);
    expect(showdown.poker?.phase).toBe("SHOWDOWN");
    expect(showdown.poker?.canAward).toBe(true);
    expect(showdown.poker?.legalActions).toEqual([]);
    expect((await loadSnapshot(tableId, sam.id)).poker?.canAward).toBe(false);
  });

  test("minimum bet/raise is enforced except All-In, and duplicate confirmation does not debit twice", async () => {
    const { owner, sam, tableId } = await threePlayerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id],
    });
    const duplicate = key();
    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: duplicate });
    await pokerAct({ actorId: owner.id, tableId, type: "CALL", idempotencyKey: duplicate });
    const calls = await prisma.pokerAction.count({ where: { hand: { tableId }, type: "CALL" } });
    expect(calls).toBe(1);
    await pokerAct({ actorId: sam.id, tableId, type: "CHECK", idempotencyKey: key() });
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    await expect(pokerAct({ actorId: sam.id, tableId, type: "BET", amount: "1", idempotencyKey: key() })).rejects.toMatchObject({
      code: "ILLEGAL_ACTION",
    });
    await pokerAct({ actorId: sam.id, tableId, type: "BET", amount: "10", idempotencyKey: key() });
    await expect(pokerAct({ actorId: owner.id, tableId, type: "RAISE", amount: "11", idempotencyKey: key() })).rejects.toMatchObject({
      code: "ILLEGAL_ACTION",
    });
    await expect(pokerAct({ actorId: owner.id, tableId, type: "RAISE", amount: "1000", idempotencyKey: key() })).rejects.toMatchObject({
      code: "INSUFFICIENT_FUNDS",
    });
    await pokerAct({ actorId: owner.id, tableId, type: "RAISE", amount: "20", idempotencyKey: key() });
    const ownerMember = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: owner.id } },
    });
    expect(ownerMember.availableMillis).toBeGreaterThan(0n);
  });
});
