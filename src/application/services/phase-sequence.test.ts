import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable, finalizeSetup } from "@/application/services/tables";
import { joinWithToken } from "@/application/services/invitations";
import { loadSnapshot } from "@/application/queries/snapshot";
import {
  dealCards,
  enterPayout,
  placeOrRetractBet,
  scheduleDeal,
  settleBox,
  startBetting,
  startNextRound,
} from "@/application/services/blackjack-round";
import { DomainError, PhaseConflictError } from "@/domain/errors";

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

async function productionTable() {
  const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Bank");
  const player = await user(`player-${randomUUID()}@jetonbro.test`, "Sam");
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: randomUUID(),
    name: "Production sequence",
    startingJetonsPerPlayer: "100",
  });
  await finalizeSetup({
    actorId: owner.id,
    tableId: created.tableId,
    idempotencyKey: randomUUID(),
    name: "Production sequence",
    startingJetonsPerPlayer: "100",
  });
  const qr = await prisma.invitation.findFirstOrThrow({
    where: { tableId: created.tableId, kind: "QR", revokedAt: null },
  });
  await joinWithToken({ userId: player.id, token: qr.token, userEmail: player.email });
  return { owner, player, tableId: created.tableId };
}

async function bet25(playerId: string, tableId: string) {
  const snap = await loadSnapshot(tableId, playerId);
  const boxId = snap.player!.boxes[0]!.id;
  await placeOrRetractBet({
    actorId: playerId,
    tableId,
    boxId,
    amount: "25",
    mode: "ADD",
    idempotencyKey: randomUUID(),
  });
  return boxId;
}

async function settleAllPush(ownerId: string, tableId: string) {
  const bank = await loadSnapshot(tableId, ownerId);
  for (const box of bank.bank?.boxes ?? []) {
    await settleBox({
      actorId: ownerId,
      tableId,
      boxId: box.id,
      outcome: "PUSH",
      idempotencyKey: randomUUID(),
    });
  }
}

describeDb("production Blackjack phase sequence", () => {
  test("two complete rounds from the current create/join/open/deal path", async () => {
    const { owner, player, tableId } = await productionTable();
    const joined = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: player.id } },
    });
    expect(joined.availableMillis).toBe(100000n);
    expect(joined.startingJetonsCredited).toBe(true);

    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect((await loadSnapshot(tableId, owner.id)).phase).toBe("BETTING");
    expect((await loadSnapshot(tableId, player.id)).phase).toBe("BETTING");

    await bet25(player.id, tableId);
    const ready = await loadSnapshot(tableId, owner.id);
    expect(ready.bank?.actions.dealCards).toBe(true);
    expect(ready.bank?.hasValidBet).toBe(true);

    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const playingBank = await loadSnapshot(tableId, owner.id);
    const playingPlayer = await loadSnapshot(tableId, player.id);
    expect(playingBank.phase).toBe("PLAYING");
    expect(playingPlayer.phase).toBe("PLAYING");
    const dealt = await prisma.table.findUniqueOrThrow({
      where: { id: tableId },
      include: { currentRound: true },
    });
    expect(dealt.currentPhase).toBe("PLAYING");
    expect(dealt.currentRound?.phase).toBe("PLAYING");
    expect(dealt.currentRound?.bettingCloseDeadlineAt).toBeNull();
    expect(playingBank.revision).toBe(dealt.updatedAt.getTime());
    expect(playingPlayer.revision).toBe(dealt.updatedAt.getTime());
    expect(playingBank.revision).toBeGreaterThan(ready.revision ?? 0);

    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect((await loadSnapshot(tableId, owner.id)).phase).toBe("PAYOUT");
    await settleAllPush(owner.id, tableId);
    expect((await loadSnapshot(tableId, owner.id)).phase).toBe("ROUND_COMPLETE");

    await startNextRound({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect((await loadSnapshot(tableId, owner.id)).phase).toBe("BETTING");
    expect((await loadSnapshot(tableId, player.id)).phase).toBe("BETTING");
    expect(await prisma.round.count({ where: { tableId } })).toBe(2);

    await bet25(player.id, tableId);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect((await loadSnapshot(tableId, owner.id)).phase).toBe("PLAYING");
    expect((await loadSnapshot(tableId, player.id)).phase).toBe("PLAYING");
  }, 30_000);

  test("Deal Now during the seven-second countdown enters PLAYING once and clears the deadline", async () => {
    const { owner, player, tableId } = await productionTable();
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await bet25(player.id, tableId);
    await scheduleDeal({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const mid = await loadSnapshot(tableId, owner.id);
    expect(mid.phase).toBe("BETTING");
    expect(mid.bank?.bettingCloseDeadlineAt).toBeTruthy();
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const playing = await prisma.table.findUniqueOrThrow({
      where: { id: tableId },
      include: { currentRound: true },
    });
    expect(playing.currentPhase).toBe("PLAYING");
    expect(playing.currentRound?.bettingCloseDeadlineAt).toBeNull();
  });

  test("duplicate Bank Deal clicks stay on one PLAYING transition", async () => {
    const { owner, player, tableId } = await productionTable();
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await bet25(player.id, tableId);
    const first = await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const second = await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect(first.phase).toBe("PLAYING");
    expect(second.phase).toBe("PLAYING");
    expect(first.roundId).toBe(second.roundId);
    expect((await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).currentPhase).toBe("PLAYING");
    expect(await prisma.round.count({ where: { tableId } })).toBe(1);
  });

  test("a stale Bank tab receives PHASE_CONFLICT and a refresh shows the live phase", async () => {
    const { owner, player, tableId } = await productionTable();
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await bet25(player.id, tableId);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await expect(
      dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: "PHASE_CONFLICT" });
    const refreshed = await loadSnapshot(tableId, owner.id);
    expect(refreshed.phase).toBe("PAYOUT");
    expect(refreshed.bank?.actions.dealCards).toBe(false);
    expect(refreshed.bank?.actions.payoutPhase).toBe(false);
  });

  test("no-bet Deal stays blocked with NO_BETS and leftover originalStake does not enable Deal", async () => {
    const { owner, player, tableId } = await productionTable();
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await expect(
      dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: "NO_BETS" });
    const box = await prisma.bettingBox.findFirstOrThrow({
      where: { round: { tableId }, removedAt: null },
    });
    await prisma.bettingBox.update({
      where: { id: box.id },
      data: { originalStakeMillis: 25000n, lockedBetMillis: 0n },
    });
    const bank = await loadSnapshot(tableId, owner.id);
    expect(bank.bank?.hasValidBet).toBe(false);
    expect(bank.bank?.actions.dealCards).toBe(false);
    await expect(
      dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: "NO_BETS" });
    expect(player.id).toBeTruthy();
  });

  test("a table/round phase desync is repaired so Deal is idempotent and Betting can resume after payout", async () => {
    const { owner, player, tableId } = await productionTable();
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await bet25(player.id, tableId);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await prisma.table.update({ where: { id: tableId }, data: { currentPhase: "BETTING" } });
    const repaired = await loadSnapshot(tableId, owner.id);
    expect(repaired.phase).toBe("PLAYING");
    const again = await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect(again.phase).toBe("PLAYING");
    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await settleAllPush(owner.id, tableId);
    await startNextRound({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect((await loadSnapshot(tableId, owner.id)).phase).toBe("BETTING");
  });

  test("orphaned BETTING without a current round can resume by opening a live betting round", async () => {
    const { owner, player, tableId } = await productionTable();
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await prisma.table.update({ where: { id: tableId }, data: { currentRoundId: null } });
    const resumed = await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect(resumed.phase).toBe("BETTING");
    const table = await prisma.table.findUniqueOrThrow({
      where: { id: tableId },
      include: { currentRound: { include: { boxes: true } } },
    });
    expect(table.currentRound?.phase).toBe("BETTING");
    expect(table.currentRound?.boxes.some((box) => box.playerId === player.id)).toBe(true);
    await bet25(player.id, tableId);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect((await loadSnapshot(tableId, owner.id)).phase).toBe("PLAYING");
  });

  test("OPEN BETTING from PLAYING is a phase conflict, not a silent no-op", async () => {
    const { owner, player, tableId } = await productionTable();
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await bet25(player.id, tableId);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await expect(
      startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() }),
    ).rejects.toBeInstanceOf(PhaseConflictError);
    expect((await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).currentPhase).toBe("PLAYING");
  });

  test("a stale Player bet after Deal returns PHASE_CONFLICT", async () => {
    const { owner, player, tableId } = await productionTable();
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const boxId = await bet25(player.id, tableId);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await expect(
      placeOrRetractBet({
        actorId: player.id,
        tableId,
        boxId,
        amount: "5",
        mode: "ADD",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "PHASE_CONFLICT" });
    expect((await loadSnapshot(tableId, player.id)).phase).toBe("PLAYING");
  });
});

describe("phase errors", () => {
  test("DomainError remains the public contract for no-bet moves", () => {
    const error = new DomainError("NO_BETS", "At least one player must place a bet first.");
    expect(error.code).toBe("NO_BETS");
  });
});
