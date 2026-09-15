import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { closeTable, createTable, saveTable } from "@/application/services/tables";
import { joinWithToken } from "@/application/services/invitations";
import { loadSnapshot } from "@/application/queries/snapshot";
import {
  addBox,
  buyInsurance,
  closeInsurance,
  dealCards,
  enterPayout,
  openInsurance,
  placeOrRetractBet,
  scheduleNextRound,
  settleBox,
  settleInsurance,
  startBetting,
  startNextRound,
  ensureNextRoundIfDue,
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

async function fundedTable() {
  const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
  const sam = await user(`sam-${randomUUID()}@jetonbro.test`, "Sam");
  const jo = await user(`jo-${randomUUID()}@jetonbro.test`, "Jo");
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: randomUUID(),
    name: "Lifecycle",
    startingJetonsPerPlayer: "100",
  });
  const qr = await prisma.invitation.findFirstOrThrow({
    where: { tableId: created.tableId, kind: "QR", revokedAt: null },
  });
  await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
  await joinWithToken({ userId: jo.id, token: qr.token, userEmail: jo.email });
  return { owner, sam, jo, tableId: created.tableId };
}

async function playToPayout(ownerId: string, samId: string, joId: string, tableId: string) {
  await startBetting({ actorId: ownerId, tableId, idempotencyKey: randomUUID() });
  const samSnap = await loadSnapshot(tableId, samId);
  const joSnap = await loadSnapshot(tableId, joId);
  await placeOrRetractBet({
    actorId: samId,
    tableId,
    boxId: samSnap.player!.boxes[0]!.id,
    amount: "25",
    mode: "ADD",
    idempotencyKey: randomUUID(),
  });
  await addBox({ actorId: samId, tableId, idempotencyKey: randomUUID() });
  const samTwo = await loadSnapshot(tableId, samId);
  const second = samTwo.player!.boxes.find((box) => box.boxNumber === 2)!;
  await placeOrRetractBet({
    actorId: samId,
    tableId,
    boxId: second.id,
    amount: "10",
    mode: "ADD",
    idempotencyKey: randomUUID(),
  });
  await placeOrRetractBet({
    actorId: joId,
    tableId,
    boxId: joSnap.player!.boxes[0]!.id,
    amount: "25",
    mode: "ADD",
    idempotencyKey: randomUUID(),
  });
  await dealCards({ actorId: ownerId, tableId, idempotencyKey: randomUUID() });
  await enterPayout({ actorId: ownerId, tableId, idempotencyKey: randomUUID() });
  return { samBoxes: (await loadSnapshot(tableId, samId)).player!.boxes, joBox: (await loadSnapshot(tableId, joId)).player!.boxes[0]! };
}

describeDb("dealer list, next round and table close", () => {
  test("bank snapshot is a player list with independent boxes", async () => {
    const { owner, sam, jo, tableId } = await fundedTable();
    const { samBoxes } = await playToPayout(owner.id, sam.id, jo.id, tableId);
    const bank = await loadSnapshot(tableId, owner.id);
    expect(bank.bank?.players.length).toBe(2);
    expect(bank.bank?.players.find((player) => player.name === "Sam")?.boxes.length).toBe(2);
    expect(samBoxes).toHaveLength(2);
    expect(bank.bank?.actions.nextHand).toBe(false);
    expect(bank.bank?.actions.scheduleNextRound).toBe(false);
  });

  test("box settlement is independent, idempotent, and next-round waits until all are done", async () => {
    const { owner, sam, jo, tableId } = await fundedTable();
    const { samBoxes, joBox } = await playToPayout(owner.id, sam.id, jo.id, tableId);
    const first = samBoxes[0]!;
    const second = samBoxes[1]!;
    const winKey = randomUUID();
    await settleBox({ actorId: owner.id, tableId, boxId: first.id, outcome: "WON", idempotencyKey: winKey });
    await settleBox({ actorId: owner.id, tableId, boxId: first.id, outcome: "WON", idempotencyKey: winKey });
    await expect(
      settleBox({ actorId: owner.id, tableId, boxId: first.id, outcome: "LOST", idempotencyKey: randomUUID() }),
    ).rejects.toBeInstanceOf(DomainError);
    const afterWin = await prisma.bettingBox.findUniqueOrThrow({ where: { id: first.id } });
    expect(afterWin.outcome).toBe("WON");
    expect(afterWin.returnedMillis).toBe(50000n);
    const stillOpen = await prisma.bettingBox.findUniqueOrThrow({ where: { id: second.id } });
    expect(stillOpen.outcome).toBeNull();
    await settleBox({ actorId: owner.id, tableId, boxId: second.id, outcome: "LOST", idempotencyKey: randomUUID() });
    await settleBox({ actorId: owner.id, tableId, boxId: joBox.id, outcome: "PUSH", idempotencyKey: randomUUID() });
    const ready = await loadSnapshot(tableId, owner.id);
    expect(ready.phase).toBe("ROUND_COMPLETE");
    expect(ready.bank?.actions.nextHand).toBe(true);
    expect(ready.bank?.players.every((player) => player.boxes.every((box) => box.outcome))).toBe(true);
  });

  test("next round now and seven-second countdown open exactly one BETTING round", async () => {
    const { owner, sam, jo, tableId } = await fundedTable();
    const { samBoxes, joBox } = await playToPayout(owner.id, sam.id, jo.id, tableId);
    await settleBox({ actorId: owner.id, tableId, boxId: samBoxes[0]!.id, outcome: "WON", idempotencyKey: randomUUID() });
    await settleBox({ actorId: owner.id, tableId, boxId: samBoxes[1]!.id, outcome: "LOST", idempotencyKey: randomUUID() });
    await settleBox({ actorId: owner.id, tableId, boxId: joBox.id, outcome: "PUSH", idempotencyKey: randomUUID() });
    const scheduled = await scheduleNextRound({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const bankMid = await loadSnapshot(tableId, owner.id);
    const playerMid = await loadSnapshot(tableId, sam.id);
    expect(bankMid.bank?.nextRoundDeadlineAt).toBe(scheduled.deadline);
    expect(playerMid.player?.nextRoundDeadlineAt).toBe(scheduled.deadline);
    await prisma.round.update({
      where: { id: (await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).currentRoundId! },
      data: { nextRoundDeadlineAt: new Date(Date.now() - 50) },
    });
    await ensureNextRoundIfDue(tableId);
    await ensureNextRoundIfDue(tableId);
    expect(await prisma.round.count({ where: { tableId } })).toBe(2);
    expect((await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).currentPhase).toBe("BETTING");
  });

  test("NEXT ROUND NOW during a countdown still creates only one next round", async () => {
    const { owner, sam, jo, tableId } = await fundedTable();
    const { samBoxes, joBox } = await playToPayout(owner.id, sam.id, jo.id, tableId);
    await settleBox({ actorId: owner.id, tableId, boxId: samBoxes[0]!.id, outcome: "PUSH", idempotencyKey: randomUUID() });
    await settleBox({ actorId: owner.id, tableId, boxId: samBoxes[1]!.id, outcome: "PUSH", idempotencyKey: randomUUID() });
    await settleBox({ actorId: owner.id, tableId, boxId: joBox.id, outcome: "PUSH", idempotencyKey: randomUUID() });
    await scheduleNextRound({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await startNextRound({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await startNextRound({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect(await prisma.round.count({ where: { tableId } })).toBe(2);
  });

  test("save preserves balances and close moves AVAILABLE to PLAYER_POCKET once", async () => {
    const { owner, sam, jo, tableId } = await fundedTable();
    const { samBoxes, joBox } = await playToPayout(owner.id, sam.id, jo.id, tableId);
    await expect(
      closeTable({ actorId: owner.id, tableId, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/locked|complete/i) });
    await settleBox({ actorId: owner.id, tableId, boxId: samBoxes[0]!.id, outcome: "WON", idempotencyKey: randomUUID() });
    await settleBox({ actorId: owner.id, tableId, boxId: samBoxes[1]!.id, outcome: "LOST", idempotencyKey: randomUUID() });
    await settleBox({ actorId: owner.id, tableId, boxId: joBox.id, outcome: "PUSH", idempotencyKey: randomUUID() });
    const beforeClose = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: sam.id } },
    });
    await saveTable({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const saved = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(saved.pausedAt).not.toBeNull();
    expect(saved.status).toBe("ACTIVE");
    const afterSave = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: sam.id } },
    });
    expect(afterSave.availableMillis).toBe(beforeClose.availableMillis);

    await expect(closeTable({ actorId: sam.id, tableId, idempotencyKey: randomUUID() })).rejects.toBeInstanceOf(DomainError);

    const closeKey = randomUUID();
    await closeTable({ actorId: owner.id, tableId, idempotencyKey: closeKey });
    await closeTable({ actorId: owner.id, tableId, idempotencyKey: closeKey });
    await closeTable({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const pocket = await prisma.playerAccount.findUniqueOrThrow({ where: { userId: sam.id } });
    expect(pocket.globalAvailableMillis).toBe(beforeClose.availableMillis);
    expect(await prisma.ledgerEntry.count({ where: { tableId, playerId: sam.id, transactionType: "TABLE_TRANSFER_OUT" } })).toBe(1);
    expect(await prisma.playerAccount.findFirst({ where: { userId: owner.id } })).toBeNull();
    await expect(
      startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: "TABLE_CLOSED" });

    const later = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Next table",
      startingJetonsPerPlayer: "0",
    });
    const qr = await prisma.invitation.findFirstOrThrow({
      where: { tableId: later.tableId, kind: "QR", revokedAt: null },
    });
    await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
    const carried = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId: later.tableId, userId: sam.id } },
    });
    expect(carried.availableMillis).toBe(beforeClose.availableMillis);
    expect((await prisma.playerAccount.findUniqueOrThrow({ where: { userId: sam.id } })).globalAvailableMillis).toBe(0n);
    expect(await prisma.ledgerEntry.count({ where: { tableId: later.tableId, transactionType: "TABLE_TRANSFER_IN" } })).toBe(1);
  });

  test("Insurance stays independent and blocks next-round until it is settled", async () => {
    const { owner, sam, jo, tableId } = await fundedTable();
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const samSnap = await loadSnapshot(tableId, sam.id);
    const joSnap = await loadSnapshot(tableId, jo.id);
    await placeOrRetractBet({
      actorId: sam.id,
      tableId,
      boxId: samSnap.player!.boxes[0]!.id,
      amount: "25",
      mode: "ADD",
      idempotencyKey: randomUUID(),
    });
    await placeOrRetractBet({
      actorId: jo.id,
      tableId,
      boxId: joSnap.player!.boxes[0]!.id,
      amount: "25",
      mode: "ADD",
      idempotencyKey: randomUUID(),
    });
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await openInsurance({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await buyInsurance({
      actorId: sam.id,
      tableId,
      boxId: samSnap.player!.boxes[0]!.id,
      amount: "10",
      idempotencyKey: randomUUID(),
    });
    await closeInsurance({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const boxes = (await loadSnapshot(tableId, owner.id)).bank!.boxes;
    for (const box of boxes) {
      await settleBox({ actorId: owner.id, tableId, boxId: box.id, outcome: "PUSH", idempotencyKey: randomUUID() });
    }
    const waiting = await loadSnapshot(tableId, owner.id);
    expect(waiting.phase).toBe("PAYOUT");
    expect(waiting.bank?.actions.nextHand).toBe(false);
    expect(waiting.bank?.actions.settleInsurance).toBe(true);
    const openInsuranceBet = await prisma.insuranceBet.findFirstOrThrow({
      where: { playerId: sam.id, settledKey: null },
    });
    expect(openInsuranceBet.settledKey).toBeNull();
    await settleInsurance({
      actorId: owner.id,
      tableId,
      resolution: "NO_DEALER_BLACKJACK",
      idempotencyKey: randomUUID(),
    });
    const done = await loadSnapshot(tableId, owner.id);
    expect(done.phase).toBe("ROUND_COMPLETE");
    expect(done.bank?.actions.nextHand).toBe(true);
    expect((await prisma.insuranceBet.findUniqueOrThrow({ where: { id: openInsuranceBet.id } })).settledKey).not.toBeNull();
    expect((await prisma.bettingBox.findUniqueOrThrow({ where: { id: boxes[0]!.id } })).outcome).toBe("PUSH");
  });
});
