import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { loadSnapshot } from "@/application/queries/snapshot";
import { joinWithToken } from "@/application/services/invitations";
import { leaveTable, assignBankDealer, createTable, distributeJetons } from "@/application/services/tables";
import { switchGame } from "@/application/services/switch-game";
import { pokerAct, startNextPokerHand, startTexasHoldem } from "@/application/services/poker-hand";
import { setPokerHoleCards } from "@/application/services/poker-cards";
import { dealCards, placeOrRetractBet, startBetting } from "@/application/services/blackjack-round";
import { mutateCards } from "@/application/services/blackjack-round";

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

async function fundedPokerTable() {
  const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
  const sam = await user(`sam-${randomUUID()}@jetonbro.test`, "Sam");
  const jo = await user(`jo-${randomUUID()}@jetonbro.test`, "Jo");
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: key(),
    name: "Owner exit switch",
    game: "POKER",
    startingJetonsPerPlayer: "0",
    smallBlind: "5",
    bigBlind: "10",
  });
  const tableId = created.tableId;
  const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
  await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
  await joinWithToken({ userId: jo.id, token: qr.token, userEmail: jo.email });
  await distributeJetons({ actorId: owner.id, tableId, userId: owner.id, amount: "200", idempotencyKey: key() });
  await distributeJetons({ actorId: owner.id, tableId, userId: sam.id, amount: "150", idempotencyKey: key() });
  await distributeJetons({ actorId: owner.id, tableId, userId: jo.id, amount: "80", idempotencyKey: key() });
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

describeDb("Owner authority, exit table, switch balances, card assist", () => {
  test("owner keeps BUY IN / INVITE / CHANGE GAME after Poker dealer rotates", async () => {
    const { owner, sam, jo, tableId } = await fundedPokerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    await foldOut(tableId, owner.id);
    const complete = await loadSnapshot(tableId, owner.id);
    expect(complete.poker?.phase).toBe("HAND_COMPLETE");
    expect(complete.poker?.canGiveJetons).toBe(true);
    expect(complete.poker?.canAddPlayer).toBe(true);
    expect(complete.poker?.canSwitchGame).toBe(true);
    const nextId = complete.poker?.nextDealerPlayerId;
    expect(nextId).toBeTruthy();
    expect(nextId).not.toBe(owner.id);
    expect((await loadSnapshot(tableId, nextId!)).poker?.canNextHand).toBe(true);
    expect((await loadSnapshot(tableId, nextId!)).poker?.canGiveJetons).toBe(false);
    await startNextPokerHand({ actorId: nextId!, tableId, idempotencyKey: key() });
    const ownerLive = await loadSnapshot(tableId, owner.id);
    expect(ownerLive.poker?.canGiveJetons).toBe(false); // mid-hand
    expect(ownerLive.isOwner).toBe(true);
    await foldOut(tableId, owner.id);
    const again = await loadSnapshot(tableId, owner.id);
    expect(again.poker?.canGiveJetons).toBe(true);
    expect(again.poker?.canAddPlayer).toBe(true);
    expect(again.poker?.canSwitchGame).toBe(true);
  });

  test("Blackjack dealer assignment does not transfer owner privileges", async () => {
    const owner = await user(`bj-owner-${randomUUID()}@jetonbro.test`, "Owner");
    const sam = await user(`bj-sam-${randomUUID()}@jetonbro.test`, "Sam");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: key(),
      name: "BJ owner",
      startingJetonsPerPlayer: "100",
    });
    const tableId = created.tableId;
    const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
    await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
    await assignBankDealer({ actorId: owner.id, tableId, userId: sam.id, idempotencyKey: key() });
    await expect(
      distributeJetons({ actorId: sam.id, tableId, userId: sam.id, amount: "10", idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await distributeJetons({ actorId: owner.id, tableId, userId: sam.id, amount: "10", idempotencyKey: key() });
    const ownerSnap = await loadSnapshot(tableId, owner.id);
    const samSnap = await loadSnapshot(tableId, sam.id);
    expect(ownerSnap.isOwner).toBe(true);
    expect(ownerSnap.isBank).toBe(false);
    expect(samSnap.isBank).toBe(true);
    expect(samSnap.bank?.actions.giveJetons).toBe(false);
    expect(samSnap.bank?.actions.switchGame).toBe(false);
    expect(samSnap.bank?.actions.changeBank).toBe(false);
    expect(ownerSnap.bank?.actions.giveJetons).toBe(true);
    expect(ownerSnap.bank?.actions.changeBank).toBe(true);
  });

  test("Poker card entry accepts 0–5 cards and rejects a sixth", async () => {
    const { owner, sam, tableId } = await fundedPokerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id],
    });
    const five = [
      { rank: "A", suit: "S" },
      { rank: "K", suit: "H" },
      { rank: "Q", suit: "D" },
      { rank: "J", suit: "C" },
      { rank: "10", suit: "S" },
    ];
    await setPokerHoleCards({ actorId: sam.id, tableId, idempotencyKey: key(), cards: five });
    const samView = await loadSnapshot(tableId, sam.id);
    expect(samView.poker?.seats.find((s) => s.userId === sam.id)?.holeCards?.length).toBe(5);
    const ownerView = await loadSnapshot(tableId, owner.id);
    expect(ownerView.poker?.seats.find((s) => s.userId === sam.id)?.holeCards).toBeNull();
    expect(JSON.stringify(ownerView)).not.toContain("A♠");
    await expect(
      setPokerHoleCards({
        actorId: sam.id,
        tableId,
        idempotencyKey: key(),
        cards: [...five, { rank: "9", suit: "H" }],
      }),
    ).rejects.toMatchObject({ code: "CARD_LIMIT" });
  });

  test("Blackjack card entry disabled before deal and enabled during play; splits stay independent", async () => {
    const owner = await user(`cards-owner-${randomUUID()}@jetonbro.test`, "Owner");
    const alex = await user(`cards-alex-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: key(),
      name: "Cards BJ",
      startingJetonsPerPlayer: "100",
      cardAssist: "CONFIRM",
    });
    const tableId = created.tableId;
    const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
    await joinWithToken({ userId: alex.id, token: qr.token, userEmail: alex.email });
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: key() });
    const box = await prisma.bettingBox.findFirstOrThrow({
      where: { playerId: alex.id, round: { tableId }, removedAt: null },
    });
    await expect(
      mutateCards({ actorId: alex.id, tableId, idempotencyKey: key(), boxId: box.id, action: "ADD", rank: "K" }),
    ).rejects.toMatchObject({ code: "CARDS_LOCKED" });
    await placeOrRetractBet({
      actorId: alex.id,
      tableId,
      boxId: box.id,
      amount: "25",
      mode: "SET",
      idempotencyKey: key(),
    });
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: key() });
    await mutateCards({ actorId: alex.id, tableId, idempotencyKey: key(), boxId: box.id, action: "ADD", rank: "8" });
    await mutateCards({ actorId: alex.id, tableId, idempotencyKey: key(), boxId: box.id, action: "ADD", rank: "8" });
    const { splitBox } = await import("@/application/services/blackjack-round");
    await splitBox({ actorId: alex.id, tableId, boxId: box.id, idempotencyKey: key() });
    const boxes = await prisma.bettingBox.findMany({
      where: { playerId: alex.id, round: { tableId }, removedAt: null },
      orderBy: { boxNumber: "asc" },
    });
    expect(boxes.length).toBe(2);
    await mutateCards({
      actorId: alex.id,
      tableId,
      idempotencyKey: key(),
      boxId: boxes[0]!.id,
      action: "ADD",
      rank: "2",
    });
    await mutateCards({
      actorId: alex.id,
      tableId,
      idempotencyKey: key(),
      boxId: boxes[1]!.id,
      action: "ADD",
      rank: "9",
    });
    const after = await prisma.bettingBox.findMany({
      where: { playerId: alex.id, round: { tableId }, removedAt: null },
      orderBy: { boxNumber: "asc" },
    });
    expect(JSON.stringify(after[0]!.ranks)).toContain("2");
    expect(JSON.stringify(after[1]!.ranks)).toContain("9");
    expect(JSON.stringify(after[0]!.ranks)).not.toContain("9");
  });

  test("EXIT TABLE works between hands but not during active hands; dealer exit does not strand next hand", async () => {
    const { owner, sam, jo, tableId } = await fundedPokerTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id, jo.id],
    });
    await expect(leaveTable({ actorId: sam.id, tableId, idempotencyKey: key() })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(leaveTable({ actorId: owner.id, tableId, idempotencyKey: key() })).rejects.toMatchObject({
      code: "OWNER_MUST_CLOSE",
    });
    await foldOut(tableId, owner.id);
    await leaveTable({ actorId: jo.id, tableId, idempotencyKey: key() });
    const seats = await prisma.pokerSeat.findMany({ where: { tableId } });
    expect(seats.map((s) => s.playerId).sort()).toEqual([owner.id, sam.id].sort());
    const nextId = (await loadSnapshot(tableId, owner.id)).poker?.nextDealerPlayerId;
    expect(nextId).toBeTruthy();
    await startNextPokerHand({ actorId: nextId!, tableId, idempotencyKey: key() });
    const live = await prisma.pokerHand.findFirstOrThrow({ where: { tableId }, orderBy: { number: "desc" } });
    expect(live.phase).toBe("PRE_FLOP");
  });

  test("switch game preserves unequal balances by default and resets when requested", async () => {
    const { owner, sam, jo, tableId } = await fundedPokerTable();
    const before = await prisma.tableMember.findMany({ where: { tableId, leftAt: null } });
    const byId = Object.fromEntries(before.map((m) => [m.userId, m.availableMillis]));
    await switchGame({
      actorId: owner.id,
      tableId,
      game: "BLACKJACK",
      idempotencyKey: key(),
    });
    for (const member of await prisma.tableMember.findMany({ where: { tableId, leftAt: null } })) {
      expect(member.availableMillis).toBe(byId[member.userId]);
    }
    await switchGame({
      actorId: owner.id,
      tableId,
      game: "POKER",
      resetBalances: true,
      startingJetonsPerPlayer: "50",
      seatOrder: [owner.id, sam.id, jo.id],
      idempotencyKey: key(),
    });
    for (const member of await prisma.tableMember.findMany({ where: { tableId, leftAt: null } })) {
      expect(member.availableMillis).toBe(50000n);
    }
    const opens = await prisma.ledgerEntry.findMany({
      where: { tableId, transactionType: "GAME_SESSION_OPEN" },
      orderBy: { timestamp: "desc" },
      take: 12,
    });
    expect(opens.some((row) => row.description?.includes("reset"))).toBe(true);
    expect(opens.some((row) => row.description?.includes("carry"))).toBe(true);
  });
});
