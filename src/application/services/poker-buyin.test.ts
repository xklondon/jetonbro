import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { ForbiddenError, ConflictError } from "@/domain/errors";
import { createTable, distributeJetons, assignBankDealer } from "@/application/services/tables";
import { startTexasHoldem, pokerAct } from "@/application/services/poker-hand";
import { joinWithToken } from "@/application/services/invitations";
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

async function user(email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, isGuest: false },
    create: { email, name, emailVerified: new Date(), isGuest: false },
  });
}

function key() {
  return randomUUID();
}

describeDb("Poker Owner buy-in via distributeJetons", () => {
  test("Owner can fund before START HAND; Dealer-not-Owner and Player rejected; active hand blocked", async () => {
    const owner = await user(`buyin-own-${randomUUID()}@jetonbro.test`, "Owner");
    const dealer = await user(`buyin-dlr-${randomUUID()}@jetonbro.test`, "Dealer");
    const sam = await user(`buyin-sam-${randomUUID()}@jetonbro.test`, "Sam");

    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: key(),
      name: "Buy-in table",
      game: "POKER",
      startingJetonsPerPlayer: "0",
      smallBlind: "5",
      bigBlind: "10",
    });
    const tableId = created.tableId;
    const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
    await joinWithToken({ userId: dealer.id, token: qr.token, userEmail: dealer.email });
    await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
    await assignBankDealer({ actorId: owner.id, tableId, userId: dealer.id, idempotencyKey: key() });

    await distributeJetons({ actorId: owner.id, tableId, userId: owner.id, amount: "100", idempotencyKey: key() });
    await distributeJetons({ actorId: owner.id, tableId, userId: dealer.id, amount: "100", idempotencyKey: key() });
    await distributeJetons({ actorId: owner.id, tableId, userId: sam.id, amount: "50", idempotencyKey: key() });

    const before = await loadSnapshot(tableId, owner.id);
    expect(before.poker?.canGiveJetons).toBe(true);
    expect(before.poker?.phase).toBe("POKER_SETUP");

    await distributeJetons({ actorId: owner.id, tableId, userId: sam.id, amount: "25", idempotencyKey: key() });
    const afterBuyIn = await loadSnapshot(tableId, owner.id);
    const samSeat = afterBuyIn.poker?.seats.find((seat) => seat.userId === sam.id);
    expect(samSeat?.available.label).toBe("75");

    await expect(
      distributeJetons({ actorId: dealer.id, tableId, userId: sam.id, amount: "10", idempotencyKey: key() }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await expect(
      distributeJetons({ actorId: sam.id, tableId, userId: sam.id, amount: "10", idempotencyKey: key() }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    await startTexasHoldem({
      actorId: owner.id,
      tableId,
      idempotencyKey: key(),
      smallBlind: "5",
      bigBlind: "10",
    });
    const live = await loadSnapshot(tableId, owner.id);
    expect(live.poker?.phase).toBe("PRE_FLOP");
    expect(live.poker?.canGiveJetons).toBe(false);

    await expect(
      distributeJetons({ actorId: owner.id, tableId, userId: sam.id, amount: "10", idempotencyKey: key() }),
    ).rejects.toBeInstanceOf(ConflictError);

    // Conservation: extra buy-in remains on Sam after blinds posted for others.
    const samLive = live.poker?.seats.find((seat) => seat.userId === sam.id);
    expect(Number(samLive?.available.label ?? "0")).toBeGreaterThanOrEqual(65);

    void pokerAct;
  });
});
