import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { listHomeTables } from "@/application/queries/home";
import { closeTable, createTable, deleteTable } from "@/application/services/tables";
import { joinWithToken } from "@/application/services/invitations";
import { loadSnapshot } from "@/application/queries/snapshot";
import {
  addBox,
  dealCards,
  enterPayout,
  placeOrRetractBet,
  settleBox,
  startBetting,
} from "@/application/services/blackjack-round";
import { DomainError, ForbiddenError } from "@/domain/errors";

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
    name: "Management",
    startingJetonsPerPlayer: "100",
  });
  const qr = await prisma.invitation.findFirstOrThrow({
    where: { tableId: created.tableId, kind: "QR", revokedAt: null },
  });
  await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
  await joinWithToken({ userId: jo.id, token: qr.token, userEmail: jo.email });
  return { owner, sam, jo, tableId: created.tableId };
}

describeDb("home cards and table delete/archive", () => {
  test("owner home shows player names and balances; non-owner does not see others", async () => {
    const { owner, sam, jo, tableId } = await fundedTable();
    const ownerHome = await listHomeTables(owner.id);
    const card = ownerHome.find((item) => item.id === tableId);
    expect(card?.isOwner).toBe(true);
    expect(card?.bankName).toBe("Owner");
    expect(card?.players.map((player) => player.name).sort()).toEqual(["Jo", "Sam"]);
    expect(card?.players.find((player) => player.name === "Sam")?.available?.label).toBe("100");
    expect(card?.players.find((player) => player.name === "Jo")?.available?.label).toBe("100");
    expect(card?.canDeleteDraft).toBe(false);
    expect(card?.canClose).toBe(true);
    expect(card?.canSave).toBe(true);

    const samHome = await listHomeTables(sam.id);
    const samCard = samHome.find((item) => item.id === tableId);
    expect(samCard?.isOwner).toBe(false);
    expect(samCard?.players.map((player) => player.name).sort()).toEqual(["Jo", "Sam"]);
    expect(samCard?.players.find((player) => player.userId === sam.id)?.available?.label).toBe("100");
    expect(samCard?.players.find((player) => player.userId === jo.id)?.available).toBeNull();
    expect(samCard?.players.find((player) => player.userId === jo.id)?.locked).toBeNull();
  });

  test("empty draft can be permanently deleted with unused invitations", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Unused draft",
      emails: [`invite-${randomUUID()}@jetonbro.test`],
    });
    const home = (await listHomeTables(owner.id)).find((item) => item.id === created.tableId);
    expect(home?.canDeleteDraft).toBe(true);
    expect(home?.canSave).toBe(false);
    expect(home?.closePreview?.kind).toBe("delete-draft");
    expect(await prisma.invitation.count({ where: { tableId: created.tableId } })).toBeGreaterThan(0);

    const deleted = await deleteTable({
      actorId: owner.id,
      tableId: created.tableId,
      idempotencyKey: randomUUID(),
    });
    expect(deleted.deleted).toBe(true);
    expect(deleted.archived).toBe(false);
    expect(await prisma.table.findUnique({ where: { id: created.tableId } })).toBeNull();
    expect(await prisma.invitation.count({ where: { tableId: created.tableId } })).toBe(0);
    expect((await listHomeTables(owner.id)).some((item) => item.id === created.tableId)).toBe(false);
  });

  test("started table is archived not hard-deleted, and close transfers once", async () => {
    const { owner, sam, tableId } = await fundedTable();
    const before = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: sam.id } },
    });
    const ledgerBefore = await prisma.ledgerEntry.count({ where: { tableId } });
    expect(ledgerBefore).toBeGreaterThan(0);

    await expect(
      deleteTable({ actorId: sam.id, tableId, idempotencyKey: randomUUID() }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const first = await deleteTable({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect(first.deleted).toBe(false);
    expect(first.archived).toBe(true);
    const again = await deleteTable({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect(again.archived).toBe(true);

    const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(table.status).toBe("ARCHIVED");
    expect(table.closedAt).not.toBeNull();
    expect(await prisma.ledgerEntry.count({ where: { tableId } })).toBeGreaterThanOrEqual(ledgerBefore);
    expect(
      await prisma.ledgerEntry.count({
        where: { tableId, playerId: sam.id, transactionType: "TABLE_TRANSFER_OUT" },
      }),
    ).toBe(1);
    expect((await prisma.playerAccount.findUniqueOrThrow({ where: { userId: sam.id } })).globalAvailableMillis).toBe(
      before.availableMillis,
    );
    expect((await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: sam.id } },
    })).availableMillis).toBe(0n);
    expect((await listHomeTables(owner.id)).some((item) => item.id === tableId)).toBe(false);
    expect((await listHomeTables(sam.id)).some((item) => item.id === tableId)).toBe(false);
  });

  test("locked funds block close and remove", async () => {
    const { owner, sam, jo, tableId } = await fundedTable();
    await startBetting({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const samSnap = await loadSnapshot(tableId, sam.id);
    await placeOrRetractBet({
      actorId: sam.id,
      tableId,
      boxId: samSnap.player!.boxes[0]!.id,
      amount: "25",
      mode: "ADD",
      idempotencyKey: randomUUID(),
    });
    const home = (await listHomeTables(owner.id)).find((item) => item.id === tableId);
    expect(home?.canClose).toBe(false);
    expect(home?.closeBlockedReason).toMatch(/locked bets or Insurance/i);

    await expect(closeTable({ actorId: owner.id, tableId, idempotencyKey: randomUUID() })).rejects.toMatchObject({
      code: "LOCKED_FUNDS",
    });
    await expect(deleteTable({ actorId: owner.id, tableId, idempotencyKey: randomUUID() })).rejects.toMatchObject({
      code: "LOCKED_FUNDS",
    });
    expect((await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).status).not.toBe("ARCHIVED");

    const joSnap = await loadSnapshot(tableId, jo.id);
    await placeOrRetractBet({
      actorId: jo.id,
      tableId,
      boxId: joSnap.player!.boxes[0]!.id,
      amount: "10",
      mode: "ADD",
      idempotencyKey: randomUUID(),
    });
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    await expect(deleteTable({ actorId: owner.id, tableId, idempotencyKey: randomUUID() })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  test("payout close still transfers remaining AVAILABLE exactly once", async () => {
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
    await addBox({ actorId: sam.id, tableId, idempotencyKey: randomUUID() });
    const samTwo = await loadSnapshot(tableId, sam.id);
    const second = samTwo.player!.boxes.find((box) => box.boxNumber === 2)!;
    await placeOrRetractBet({
      actorId: sam.id,
      tableId,
      boxId: second.id,
      amount: "10",
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
    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    const bank = await loadSnapshot(tableId, owner.id);
    const boxes = bank.bank!.boxes;
    await settleBox({ actorId: owner.id, tableId, boxId: boxes[0]!.id, outcome: "WON", idempotencyKey: randomUUID() });
    await settleBox({ actorId: owner.id, tableId, boxId: boxes[1]!.id, outcome: "LOST", idempotencyKey: randomUUID() });
    await settleBox({ actorId: owner.id, tableId, boxId: boxes[2]!.id, outcome: "PUSH", idempotencyKey: randomUUID() });
    const before = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: sam.id } },
    });
    const key = randomUUID();
    await deleteTable({ actorId: owner.id, tableId, idempotencyKey: key });
    await deleteTable({ actorId: owner.id, tableId, idempotencyKey: key });
    await deleteTable({ actorId: owner.id, tableId, idempotencyKey: randomUUID() });
    expect(
      await prisma.ledgerEntry.count({
        where: { tableId, playerId: sam.id, transactionType: "TABLE_TRANSFER_OUT" },
      }),
    ).toBe(1);
    expect((await prisma.playerAccount.findUniqueOrThrow({ where: { userId: sam.id } })).globalAvailableMillis).toBe(
      before.availableMillis,
    );
  });
});
