import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable, distributeJetons } from "@/application/services/tables";
import { joinWithToken } from "@/application/services/invitations";
import { advancePokerStreet, pokerAct, startTexasHoldem } from "@/application/services/poker-hand";
import { setPokerCommunityCards, setPokerHoleCards } from "@/application/services/poker-cards";
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

async function actUntilStreetReady(tableId: string, ownerId: string) {
  for (let i = 0; i < 12; i += 1) {
    const snap = await loadSnapshot(tableId, ownerId);
    if (snap.poker?.canDealStreet || snap.poker?.phase === "SHOWDOWN" || snap.poker?.phase === "HAND_COMPLETE") {
      return snap;
    }
    const actorId = snap.poker?.currentActorId;
    if (!actorId) return snap;
    const actor = await loadSnapshot(tableId, actorId);
    const type = actor.poker?.legalActions.some((action) => action.type === "CHECK") ? "CHECK" : "CALL";
    await pokerAct({ actorId, tableId, type, idempotencyKey: key() });
  }
  return loadSnapshot(tableId, ownerId);
}

async function seatedTable() {
  const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
  const sam = await user(`sam-${randomUUID()}@jetonbro.test`, "Sam");
  const jo = await user(`jo-${randomUUID()}@jetonbro.test`, "Jo");
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: key(),
    name: "Card table",
    startingJetonsPerPlayer: "0",
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

describeDb("optional Poker cards", () => {
  test("community cards are public, hole cards stay private, and neither mutates phase or ledger", async () => {
    const { owner, sam, tableId } = await seatedTable();
    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
      seatOrder: [owner.id, sam.id],
    });
    await expect(
      setPokerCommunityCards({
        actorId: owner.id,
        tableId,
        idempotencyKey: key(),
        cards: [{ rank: "A", suit: "S" }, { rank: "K", suit: "H" }, { rank: "Q", suit: "D" }],
      }),
    ).rejects.toMatchObject({ code: "CARD_LIMIT" });

    await actUntilStreetReady(tableId, owner.id);
    await advancePokerStreet({ actorId: owner.id, tableId, idempotencyKey: key() });
    const before = await loadSnapshot(tableId, owner.id);
    const ledgerBefore = await prisma.ledgerEntry.count({ where: { tableId } });
    const flopCards = [
      { rank: "A", suit: "S" },
      { rank: "K", suit: "H" },
      { rank: "Q", suit: "D" },
    ];
    await setPokerCommunityCards({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      cards: flopCards,
    });
    await setPokerHoleCards({
      actorId: sam.id,
      tableId,
      idempotencyKey: key(),
      cards: [
        { rank: "2", suit: "C" },
        { rank: "7", suit: "H" },
      ],
    });
    const ownerView = await loadSnapshot(tableId, owner.id);
    const samView = await loadSnapshot(tableId, sam.id);
    const ownerSamSeat = ownerView.poker?.seats.find((seat) => seat.userId === sam.id);
    const samSeat = samView.poker?.seats.find((seat) => seat.userId === sam.id);
    expect(ownerView.poker?.phase).toBe(before.poker?.phase);
    expect(ownerView.poker?.currentActorId).toBe(before.poker?.currentActorId);
    expect(ownerView.poker?.pot.millis).toBe(before.poker?.pot.millis);
    expect(ownerView.poker?.streetComplete).toBe(before.poker?.streetComplete);
    expect(ownerView.poker?.communityCards.map((card) => card.label)).toEqual(["A♠", "K♥", "Q♦"]);
    expect(samView.poker?.communityCards.map((card) => card.label)).toEqual(["A♠", "K♥", "Q♦"]);
    expect(ownerSamSeat?.hasHoleCards).toBe(true);
    expect(ownerSamSeat?.holeCards).toBeNull();
    expect(samSeat?.holeCards?.map((card) => card.label)).toEqual(["2♣", "7♥"]);
    expect(JSON.stringify(ownerView)).not.toContain("2♣");
    expect(JSON.stringify(ownerView)).not.toContain("7♥");
    expect(await prisma.ledgerEntry.count({ where: { tableId } })).toBe(ledgerBefore);
    const hand = await prisma.pokerHand.findFirstOrThrow({ where: { tableId } });
    expect(hand.phase).toBe("FLOP");
    expect(hand.streetWagerMillis).toBe(0n);
  });
});
