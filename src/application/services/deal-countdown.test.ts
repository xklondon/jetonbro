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
    await placeOrRetractBet({
      actorId: player.id,
      tableId,
      boxId,
      amount: "25",
      mode: "RETRACT",
      idempotencyKey: randomUUID(),
    });
    const afterRetract = await loadSnapshot(tableId, player.id);
    expect(afterRetract.player?.available.label).toBe("100");
    expect(afterRetract.player?.boxes[0]?.bet.label).toBe("0");

    await placeOrRetractBet({
      actorId: player.id,
      tableId,
      boxId,
      amount: "25",
      mode: "ADD",
      idempotencyKey: randomUUID(),
    });
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
});
