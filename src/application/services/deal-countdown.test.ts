import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable } from "@/application/services/tables";
import { joinWithToken } from "@/application/services/invitations";
import { loadSnapshot } from "@/application/queries/snapshot";
import {
  dealCards,
  ensureBettingClosedIfDue,
  placeOrRetractBet,
  scheduleDeal,
  startBetting,
} from "@/application/services/blackjack-round";
import { DomainError } from "@/domain/errors";

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

async function seatedTable() {
  const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
  const player = await user(`player-${randomUUID()}@jetonbro.test`, "Sam");
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: randomUUID(),
    name: "Countdown table",
    startingJetonsPerPlayer: "100",
  });
  const qr = await prisma.invitation.findFirstOrThrow({
    where: { tableId: created.tableId, kind: "QR", revokedAt: null },
  });
  await joinWithToken({ userId: player.id, token: qr.token, userEmail: player.email });
  await startBetting({ actorId: owner.id, tableId: created.tableId, idempotencyKey: randomUUID() });
  const snap = await loadSnapshot(created.tableId, player.id);
  return { owner, player, tableId: created.tableId, boxId: snap.player!.boxes[0]!.id };
}

describeDb("deal countdown", () => {
  test("deal controls require a valid bet and Deal Now enters PLAYING", async () => {
    const { owner, player, tableId, boxId } = await seatedTable();
    await expect(
      dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: "NO_BETS" });
    await expect(
      scheduleDeal({ actorId: owner.id, tableId, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: "NO_BETS" });

    await placeOrRetractBet({
      actorId: player.id,
      tableId,
      boxId,
      amount: "25",
      mode: "ADD",
      idempotencyKey: randomUUID(),
    });
    await expect(
      placeOrRetractBet({
        actorId: player.id,
        tableId,
        boxId,
        amount: "25",
        mode: "RETRACT",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "BOX_BET_LOCKED" });
    const afterLock = await loadSnapshot(tableId, player.id);
    expect(afterLock.player?.available.label).toBe("75");
    expect(afterLock.player?.boxes[0]?.bet.label).toBe("25");
    const dealerLock = await loadSnapshot(tableId, owner.id);
    expect(dealerLock.bank?.allBetsConfirmed).toBe(true);

    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const playing = await loadSnapshot(tableId, owner.id);
    expect(playing.phase).toBe("PLAYING");
    await expect(
      placeOrRetractBet({
        actorId: player.id,
        tableId,
        boxId,
        amount: "5",
        mode: "ADD",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  test("seven-second deal uses one deadline and closes exactly once", async () => {
    const { owner, player, tableId, boxId } = await seatedTable();
    await placeOrRetractBet({
      actorId: player.id,
      tableId,
      boxId,
      amount: "5",
      mode: "ADD",
      idempotencyKey: randomUUID(),
    });
    const first = await scheduleDeal({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const second = await scheduleDeal({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect(second.deadline).toBe(first.deadline);
    const live = await loadSnapshot(tableId, owner.id);
    expect(live.bank?.bettingCloseDeadlineAt).toBe(first.deadline);
    expect(live.phase).toBe("BETTING");
    const resumed = await loadSnapshot(tableId, player.id);
    expect(resumed.player?.bettingCloseDeadlineAt).toBe(first.deadline);
    expect(resumed.phase).toBe("BETTING");

    await prisma.round.update({
      where: { id: (await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).currentRoundId! },
      data: { bettingCloseDeadlineAt: new Date(Date.now() - 50) },
    });
    const closed = await loadSnapshot(tableId, owner.id);
    expect(closed.phase).toBe("PLAYING");
    await ensureBettingClosedIfDue(tableId);
    const still = await loadSnapshot(tableId, owner.id);
    expect(still.phase).toBe("PLAYING");
    expect(still.bank?.bettingCloseDeadlineAt).toBeNull();
  });

  test("confirmed PLACE BET stays locked after snapshot reload (reconnect)", async () => {
    const { owner, player, tableId, boxId } = await seatedTable();
    await placeOrRetractBet({
      actorId: player.id,
      tableId,
      boxId,
      amount: "25",
      mode: "SET",
      idempotencyKey: randomUUID(),
    });
    const reloaded = await loadSnapshot(tableId, player.id);
    expect(reloaded.player?.boxes[0]?.bet.label).toBe("25");
    expect(reloaded.bank).toBeNull();
    await expect(
      placeOrRetractBet({
        actorId: player.id,
        tableId,
        boxId,
        amount: "10",
        mode: "ADD",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "BOX_BET_LOCKED" });
    await expect(
      placeOrRetractBet({
        actorId: player.id,
        tableId,
        boxId,
        amount: "40",
        mode: "SET",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "BOX_BET_LOCKED" });
    const after = await loadSnapshot(tableId, player.id);
    expect(after.player?.boxes[0]?.bet.label).toBe("25");
    expect(after.player?.available.label).toBe("75");
    const dealer = await loadSnapshot(tableId, owner.id);
    expect(dealer.bank?.allBetsConfirmed).toBe(true);
  });

  test("orange DEAL CARDS advances with unbet seats and keeps confirmed stakes", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
    const sam = await user(`sam-${randomUUID()}@jetonbro.test`, "Sam");
    const alex = await user(`alex-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Partial deal",
      startingJetonsPerPlayer: "100",
    });
    const tableId = created.tableId;
    const qr = await prisma.invitation.findFirstOrThrow({
      where: { tableId, kind: "QR", revokedAt: null },
    });
    await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
    await joinWithToken({ userId: alex.id, token: qr.token, userEmail: alex.email });
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const samBox = (await loadSnapshot(tableId, sam.id)).player!.boxes[0]!;
    const alexBox = (await loadSnapshot(tableId, alex.id)).player!.boxes[0]!;
    await placeOrRetractBet({
      actorId: sam.id,
      tableId,
      boxId: samBox.id,
      amount: "25",
      mode: "SET",
      idempotencyKey: randomUUID(),
    });
    const beforeDeal = await loadSnapshot(tableId, owner.id);
    expect(beforeDeal.bank?.hasValidBet).toBe(true);
    expect(beforeDeal.bank?.allBetsConfirmed).toBe(false);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const playing = await loadSnapshot(tableId, owner.id);
    expect(playing.phase).toBe("PLAYING");
    const live = await prisma.bettingBox.findMany({
      where: { round: { tableId }, removedAt: null },
    });
    expect(live).toHaveLength(1);
    expect(live[0]!.id).toBe(samBox.id);
    expect(live[0]!.lockedBetMillis).toBe(25000n);
    const removed = await prisma.bettingBox.findUniqueOrThrow({ where: { id: alexBox.id } });
    expect(removed.removedAt).not.toBeNull();
    expect(removed.lockedBetMillis).toBe(0n);
    const samAfter = await loadSnapshot(tableId, sam.id);
    expect(samAfter.player?.boxes[0]?.bet.label).toBe("25");
    expect(samAfter.player?.available.label).toBe("75");
  });
});
