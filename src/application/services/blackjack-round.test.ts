import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable, distributeJetons } from "@/application/services/tables";
import { joinWithToken } from "@/application/services/invitations";
import {
  addBox,
  buyInsurance,
  closeInsurance,
  dealCards,
  doubleBox,
  enterPayout,
  openInsurance,
  placeOrRetractBet,
  settleBox,
  settleDealerWon,
  settleInsurance,
  splitBox,
  startBetting,
  startNextRound,
} from "@/application/services/blackjack-round";
import { loadSnapshot } from "@/application/queries/snapshot";
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

function key() {
  return randomUUID();
}

describeDb("Blackjack table flow", () => {
  test("complete round accounting, privacy, idempotency and next hand", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
    const alex = await user(`alex-${randomUUID()}@jetonbro.test`, "Alex");
    const jo = await user(`jo-${randomUUID()}@jetonbro.test`, "Jo");

    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: key(),
      name: "Salon table",
      startingAllocation: "0",
    });
    const tableId = created.tableId;

    const qr = await prisma.invitation.findFirstOrThrow({
      where: { tableId, kind: "QR", revokedAt: null },
    });
    await joinWithToken({ userId: alex.id, token: qr.token, userEmail: alex.email });
    await prisma.tableMember.create({
      data: { tableId, userId: jo.id },
    });

    await distributeJetons({
      actorId: owner.id,
      tableId,
      userId: alex.id,
      amount: "100",
      idempotencyKey: key(),
    });
    await distributeJetons({
      actorId: owner.id,
      tableId,
      userId: jo.id,
      amount: "80",
      idempotencyKey: key(),
    });

    await startBetting({ actorId: owner.id, tableId, idempotencyKey: key() });

    const alexSnap = await loadSnapshot(tableId, alex.id);
    expect(alexSnap.player?.boxes.every((box) => box.playerId === alex.id)).toBe(true);
    expect(alexSnap.player?.boxes.length).toBeGreaterThan(0);
    expect(alexSnap.bank).toBeNull();
    const otherBalances = alexSnap.members.filter((member) => member.userId !== alex.id && member.available);
    expect(otherBalances.every((member) => member.available === null || member.userId === alex.id)).toBe(true);

    const bankSnap = await loadSnapshot(tableId, owner.id);
    expect(bankSnap.bank?.boxes.length).toBeGreaterThan(0);

    const alexBox1 = alexSnap.player!.boxes[0]!;
    await addBox({ actorId: alex.id, tableId, idempotencyKey: key() });
    const afterAdd = await loadSnapshot(tableId, alex.id);
    expect(afterAdd.player?.boxes.length).toBe(2);
    const alexBox2 = afterAdd.player!.boxes.find((box) => box.id !== alexBox1.id)!;

    await placeOrRetractBet({
      actorId: alex.id,
      tableId,
      boxId: alexBox1.id,
      amount: "25",
      mode: "ADD",
      idempotencyKey: key(),
    });
    await placeOrRetractBet({
      actorId: alex.id,
      tableId,
      boxId: alexBox2.id,
      amount: "10",
      mode: "SET",
      idempotencyKey: key(),
    });

    const duplicateKey = key();
    await placeOrRetractBet({
      actorId: jo.id,
      tableId,
      boxId: (await loadSnapshot(tableId, jo.id)).player!.boxes[0]!.id,
      amount: "15",
      mode: "SET",
      idempotencyKey: duplicateKey,
    });
    await placeOrRetractBet({
      actorId: jo.id,
      tableId,
      boxId: (await loadSnapshot(tableId, jo.id)).player!.boxes[0]!.id,
      amount: "15",
      mode: "SET",
      idempotencyKey: duplicateKey,
    });

    let alexMember = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: alex.id } },
    });
    expect(alexMember.availableMillis).toBe(65000n);

    await placeOrRetractBet({
      actorId: alex.id,
      tableId,
      boxId: alexBox2.id,
      amount: "10",
      mode: "RETRACT",
      idempotencyKey: key(),
    });
    alexMember = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: alex.id } },
    });
    expect(alexMember.availableMillis).toBe(75000n);
    await placeOrRetractBet({
      actorId: alex.id,
      tableId,
      boxId: alexBox2.id,
      amount: "10",
      mode: "SET",
      idempotencyKey: key(),
    });

    await dealCards({ actorId: owner.id, tableId, idempotencyKey: key() });
    await expect(
      placeOrRetractBet({
        actorId: alex.id,
        tableId,
        boxId: alexBox1.id,
        amount: "5",
        mode: "ADD",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await doubleBox({ actorId: alex.id, tableId, boxId: alexBox1.id, idempotencyKey: key() });
    const doubled = await prisma.bettingBox.findUniqueOrThrow({ where: { id: alexBox1.id } });
    expect(doubled.lockedBetMillis).toBe(50000n);
    expect(doubled.isDoubled).toBe(true);
    await expect(
      doubleBox({ actorId: alex.id, tableId, boxId: alexBox1.id, idempotencyKey: key() }),
    ).rejects.toBeInstanceOf(DomainError);

    const split = await splitBox({ actorId: alex.id, tableId, boxId: alexBox2.id, idempotencyKey: key() });
    const splitBoxRow = await prisma.bettingBox.findUniqueOrThrow({ where: { id: split.boxId } });
    expect(splitBoxRow.parentBoxId).toBe(alexBox2.id);
    expect(splitBoxRow.lockedBetMillis).toBe(10000n);

    await expect(
      buyInsurance({
        actorId: alex.id,
        tableId,
        boxId: alexBox1.id,
        amount: "10",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await openInsurance({ actorId: owner.id, tableId, idempotencyKey: key() });
    await buyInsurance({
      actorId: alex.id,
      tableId,
      boxId: alexBox1.id,
      amount: "10",
      idempotencyKey: key(),
    });
    const insurance = await prisma.insuranceBet.findFirstOrThrow({ where: { boxId: alexBox1.id } });
    expect(insurance.amountMillis).toBe(10000n);
    await closeInsurance({ actorId: owner.id, tableId, idempotencyKey: key() });

    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: key() });
    await settleBox({
      actorId: owner.id,
      tableId,
      boxId: alexBox1.id,
      outcome: "BLACKJACK",
      idempotencyKey: key(),
    });
    const settledBox = await prisma.bettingBox.findUniqueOrThrow({ where: { id: alexBox1.id } });
    expect(settledBox.returnedMillis).toBe(125000n);
    expect(settledBox.lockedBetMillis).toBe(0n);
    const insuranceStillOpen = await prisma.insuranceBet.findUniqueOrThrow({ where: { id: insurance.id } });
    expect(insuranceStillOpen.settledKey).toBeNull();

    await settleInsurance({
      actorId: owner.id,
      tableId,
      resolution: "DEALER_BLACKJACK",
      idempotencyKey: key(),
    });
    const settledInsurance = await prisma.insuranceBet.findUniqueOrThrow({ where: { id: insurance.id } });
    expect(settledInsurance.returnedMillis).toBe(30000n);
    expect(settledBox.outcome).toBe("BLACKJACK");

    const joBox = (await loadSnapshot(tableId, jo.id)).player!.boxes[0]!;
    await settleBox({ actorId: owner.id, tableId, boxId: joBox.id, outcome: "LOST", idempotencyKey: key() });
    await settleBox({ actorId: owner.id, tableId, boxId: alexBox2.id, outcome: "PUSH", idempotencyKey: key() });
    await settleBox({ actorId: owner.id, tableId, boxId: split.boxId, outcome: "WON", idempotencyKey: key() });

    const round = await prisma.round.findFirstOrThrow({
      where: { tableId },
      orderBy: { number: "desc" },
    });
    expect(round.phase).toBe("ROUND_COMPLETE");

    const ledger = await prisma.ledgerEntry.findMany({ where: { playerId: alex.id, tableId } });
    expect(ledger.some((entry) => entry.transactionType === "INSURANCE_LOCKED")).toBe(true);
    expect(ledger.some((entry) => entry.transactionType === "BLACKJACK_RETURN")).toBe(true);
    expect(ledger.some((entry) => entry.transactionType === "INSURANCE_WIN_RETURN")).toBe(true);

    await startNextRound({ actorId: owner.id, tableId, idempotencyKey: key() });
    const next = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(next.currentPhase).toBe("BETTING");
    const alexAfter = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: alex.id } },
    });
    expect(alexAfter.availableMillis > 0n).toBe(true);
  }, 30_000);

  test("ordinary loss and Insurance win settle independently and cannot pay twice", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
    const alex = await user(`alex-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: key(),
      name: "Insurance independence",
      startingAllocation: "0",
    });
    const tableId = created.tableId;
    const qr = await prisma.invitation.findFirstOrThrow({
      where: { tableId, kind: "QR", revokedAt: null },
    });
    await joinWithToken({ userId: alex.id, token: qr.token, userEmail: alex.email });
    await distributeJetons({
      actorId: owner.id,
      tableId,
      userId: alex.id,
      amount: "100",
      idempotencyKey: key(),
    });
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: key() });
    const box = (await loadSnapshot(tableId, alex.id)).player!.boxes[0]!;
    await placeOrRetractBet({
      actorId: alex.id,
      tableId,
      boxId: box.id,
      amount: "20",
      mode: "SET",
      idempotencyKey: key(),
    });
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: key() });
    await expect(
      buyInsurance({ actorId: alex.id, tableId, boxId: box.id, amount: "10", idempotencyKey: key() }),
    ).rejects.toBeInstanceOf(DomainError);
    await openInsurance({ actorId: owner.id, tableId, idempotencyKey: key() });
    await buyInsurance({ actorId: alex.id, tableId, boxId: box.id, amount: "10", idempotencyKey: key() });
    await expect(
      buyInsurance({ actorId: alex.id, tableId, boxId: box.id, amount: "20", idempotencyKey: key() }),
    ).rejects.toBeInstanceOf(DomainError);
    await closeInsurance({ actorId: owner.id, tableId, idempotencyKey: key() });
    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: key() });
    await settleBox({ actorId: owner.id, tableId, boxId: box.id, outcome: "LOST", idempotencyKey: key() });
    const afterLoss = await prisma.bettingBox.findUniqueOrThrow({ where: { id: box.id } });
    const insurance = await prisma.insuranceBet.findFirstOrThrow({ where: { boxId: box.id } });
    expect(afterLoss.outcome).toBe("LOST");
    expect(afterLoss.returnedMillis).toBe(0n);
    expect(insurance.settledKey).toBeNull();
    const tableAfterLoss = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(tableAfterLoss.currentPhase).toBe("PAYOUT");
    const settleKey = key();
    await settleInsurance({
      actorId: owner.id,
      tableId,
      resolution: "DEALER_BLACKJACK",
      idempotencyKey: settleKey,
    });
    await settleInsurance({
      actorId: owner.id,
      tableId,
      resolution: "DEALER_BLACKJACK",
      idempotencyKey: settleKey,
    });
    await expect(
      settleInsurance({
        actorId: owner.id,
        tableId,
        resolution: "NO_DEALER_BLACKJACK",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(DomainError);
    const settledInsurance = await prisma.insuranceBet.findUniqueOrThrow({ where: { id: insurance.id } });
    expect(settledInsurance.returnedMillis).toBe(30000n);
    expect(afterLoss.outcome).toBe("LOST");
    const wins = await prisma.ledgerEntry.count({
      where: { playerId: alex.id, tableId, transactionType: "INSURANCE_WIN_RETURN" },
    });
    expect(wins).toBe(1);
    const losses = await prisma.ledgerEntry.count({
      where: { playerId: alex.id, tableId, transactionType: "BET_LOSS" },
    });
    expect(losses).toBe(1);
    const member = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: alex.id } },
    });
    expect(member.availableMillis).toBe(100000n);
  }, 30_000);

  test("DEALER WON settles only unresolved boxes as LOST and never Insurance", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
    const alex = await user(`alex-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: key(),
      name: "Dealer won table",
      startingAllocation: "0",
    });
    const tableId = created.tableId;
    const qr = await prisma.invitation.findFirstOrThrow({
      where: { tableId, kind: "QR", revokedAt: null },
    });
    await joinWithToken({ userId: alex.id, token: qr.token, userEmail: alex.email });
    await distributeJetons({
      actorId: owner.id,
      tableId,
      userId: alex.id,
      amount: "100",
      idempotencyKey: key(),
    });
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: key() });
    const first = (await loadSnapshot(tableId, alex.id)).player!.boxes[0]!;
    await addBox({ actorId: alex.id, tableId, idempotencyKey: key() });
    const second = (await loadSnapshot(tableId, alex.id)).player!.boxes.find((item) => item.id !== first.id)!;
    await placeOrRetractBet({
      actorId: alex.id,
      tableId,
      boxId: first.id,
      amount: "20",
      mode: "SET",
      idempotencyKey: key(),
    });
    await placeOrRetractBet({
      actorId: alex.id,
      tableId,
      boxId: second.id,
      amount: "10",
      mode: "SET",
      idempotencyKey: key(),
    });
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: key() });
    await openInsurance({ actorId: owner.id, tableId, idempotencyKey: key() });
    await buyInsurance({ actorId: alex.id, tableId, boxId: first.id, amount: "10", idempotencyKey: key() });
    await closeInsurance({ actorId: owner.id, tableId, idempotencyKey: key() });
    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: key() });
    await settleBox({
      actorId: owner.id,
      tableId,
      boxId: first.id,
      outcome: "WON",
      idempotencyKey: key(),
    });
    const dealerKey = key();
    await settleDealerWon({ actorId: owner.id, tableId, idempotencyKey: dealerKey });
    await settleDealerWon({ actorId: owner.id, tableId, idempotencyKey: dealerKey });
    await settleDealerWon({ actorId: owner.id, tableId, idempotencyKey: key() });
    const won = await prisma.bettingBox.findUniqueOrThrow({ where: { id: first.id } });
    const lost = await prisma.bettingBox.findUniqueOrThrow({ where: { id: second.id } });
    const insurance = await prisma.insuranceBet.findFirstOrThrow({ where: { boxId: first.id } });
    expect(won.outcome).toBe("WON");
    expect(lost.outcome).toBe("LOST");
    expect(lost.returnedMillis).toBe(0n);
    expect(insurance.settledKey).toBeNull();
    const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(table.currentPhase).toBe("PAYOUT");
    const losses = await prisma.ledgerEntry.count({
      where: { tableId, boxId: second.id, transactionType: "BET_LOSS" },
    });
    expect(losses).toBe(1);
    const wins = await prisma.ledgerEntry.count({
      where: { tableId, boxId: first.id, transactionType: "BET_WIN_RETURN" },
    });
    expect(wins).toBe(1);
  }, 30_000);

  test("min-bet top-up, short-stack ALL IN, and next-round staging", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
    const alex = await user(`alex-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: key(),
      name: "Next-round table",
      startingAllocation: "0",
      minBet: "10",
    });
    const tableId = created.tableId;
    const qr = await prisma.invitation.findFirstOrThrow({
      where: { tableId, kind: "QR", revokedAt: null },
    });
    await joinWithToken({ userId: alex.id, token: qr.token, userEmail: alex.email });
    await distributeJetons({
      actorId: owner.id,
      tableId,
      userId: alex.id,
      amount: "7",
      idempotencyKey: key(),
    });

    await startBetting({ actorId: owner.id, tableId, idempotencyKey: key() });
    let alexMember = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: alex.id } },
    });
    expect(alexMember.availableMillis).toBe(10000n);
    const topUps = await prisma.ledgerEntry.count({
      where: {
        tableId,
        playerId: alex.id,
        transactionType: "BANK_DISTRIBUTION",
        description: { contains: "min-bet top-up" },
      },
    });
    expect(topUps).toBe(1);

    const boxId = (await loadSnapshot(tableId, alex.id)).player!.boxes[0]!.id;
    await placeOrRetractBet({
      actorId: alex.id,
      tableId,
      boxId,
      amount: "10",
      mode: "SET",
      idempotencyKey: key(),
    });
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: key() });
    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: key() });
    // Still in PAYOUT until settle — next-round bets must be rejected.
    expect((await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).currentPhase).toBe("PAYOUT");
    await expect(
      placeOrRetractBet({
        actorId: alex.id,
        tableId,
        boxId,
        amount: "4",
        mode: "SET",
        idempotencyKey: key(),
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await settleBox({
      actorId: owner.id,
      tableId,
      boxId,
      outcome: "LOST",
      idempotencyKey: key(),
    });

    const afterLoss = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(afterLoss.currentPhase).toBe("ROUND_COMPLETE");
    alexMember = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: alex.id } },
    });
    expect(alexMember.availableMillis).toBe(0n);

    // Short-stack ALL IN below min during next-round prep after a tiny credit.
    await distributeJetons({
      actorId: owner.id,
      tableId,
      userId: alex.id,
      amount: "4",
      idempotencyKey: key(),
      mode: "BANK_DISTRIBUTION",
    });
    await placeOrRetractBet({
      actorId: alex.id,
      tableId,
      boxId,
      amount: "4",
      mode: "SET",
      idempotencyKey: key(),
    });
    const stagedSnap = await loadSnapshot(tableId, alex.id);
    expect(stagedSnap.player?.actions.nextRoundBet).toBe(true);
    expect(stagedSnap.player?.boxes[0]?.bet.label).toBe("0");
    expect(stagedSnap.player?.boxes[0]?.outcome).toBeNull();
    expect(stagedSnap.player?.boxes[0]?.nextRoundBet?.label).toBe("4");
    alexMember = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: alex.id } },
    });
    expect(alexMember.availableMillis).toBe(0n);

    const lockedBefore = await prisma.bettingBox.findUniqueOrThrow({ where: { id: boxId } });
    expect(lockedBefore.lockedBetMillis).toBe(0n);

    await startNextRound({ actorId: owner.id, tableId, idempotencyKey: key() });
    const nextSnap = await loadSnapshot(tableId, alex.id);
    expect(nextSnap.phase).toBe("BETTING");
    expect(nextSnap.player?.boxes[0]?.bet.label).toBe("4");
    expect(nextSnap.player?.boxes[0]?.nextRoundBet ?? null).toBeNull();
    alexMember = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: alex.id } },
    });
    // Top-up sees staged 4 already reserved → credits 6 to reach min 10 effective before apply,
    // then apply moves the staged 4 onto the box without a second debit.
    expect(alexMember.availableMillis).toBe(6000n);

    const stagedLeft = await prisma.stagedBlackjackBet.count({
      where: { tableId, appliedToRoundId: null },
    });
    expect(stagedLeft).toBe(0);
  }, 30_000);
});
