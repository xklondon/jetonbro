import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { closeTable, createTable, distributeJetons, saveTable } from "@/application/services/tables";
import { joinWithToken } from "@/application/services/invitations";
import {
  applyCardOutcome,
  buyInsurance,
  dealCards,
  doubleBox,
  enterPayout,
  mutateCards,
  openInsurance,
  placeOrRetractBet,
  setBankFunding,
  setCardAssist,
  settleBox,
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

async function seatedTable(options?: { limited?: boolean; cardAssist?: "OFF" | "CONFIRM" | "AUTO"; bank?: string }) {
  const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
  const alex = await user(`alex-${randomUUID()}@jetonbro.test`, "Alex");
  const jo = await user(`jo-${randomUUID()}@jetonbro.test`, "Jo");
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: key(),
    name: "Card table",
    startingAllocation: "0",
    cardAssist: options?.cardAssist ?? "OFF",
    bankFundingMode: options?.limited ? "LIMITED" : "OPEN",
    startingBank: options?.bank ?? "500",
  });
  const tableId = created.tableId;
  const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
  await joinWithToken({ userId: alex.id, token: qr.token, userEmail: alex.email });
  await prisma.tableMember.create({ data: { tableId, userId: jo.id } });
  await distributeJetons({ actorId: owner.id, tableId, userId: alex.id, amount: "100", idempotencyKey: key() });
  await distributeJetons({ actorId: owner.id, tableId, userId: jo.id, amount: "100", idempotencyKey: key() });
  await startBetting({ actorId: owner.id, tableId, idempotencyKey: key() });
  const snap = await loadSnapshot(tableId, alex.id);
  const alexBox = snap.player!.boxes[0]!;
  return { owner, alex, jo, tableId, alexBox };
}

async function bet(playerId: string, tableId: string, boxId: string, amount = "25") {
  await placeOrRetractBet({
    actorId: playerId,
    tableId,
    boxId,
    amount,
    mode: "SET",
    idempotencyKey: key(),
  });
}

async function addRanks(actorId: string, tableId: string, ranks: string[], boxId?: string, dealer = false) {
  for (const rank of ranks) {
    await mutateCards({
      actorId,
      tableId,
      idempotencyKey: key(),
      boxId,
      dealer,
      action: "ADD",
      rank,
    });
  }
}

describeDb("optional cards and Limited Bank", () => {
  test("card entry is optional and the manual payout path still works", async () => {
    const { owner, alex, tableId, alexBox } = await seatedTable();
    await bet(alex.id, tableId, alexBox.id);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: key() });
    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: key() });
    await settleBox({ actorId: owner.id, tableId, boxId: alexBox.id, outcome: "WON", idempotencyKey: key() });
    const snap = await loadSnapshot(tableId, alex.id);
    expect(snap.player?.boxes[0]?.outcome).toBe("WON");
    expect(snap.player?.boxes[0]?.hand?.ranks).toEqual([]);
  });

  test("Player edits only their selected box; Dealer edits every box and the Dealer hand", async () => {
    const { owner, alex, jo, tableId, alexBox } = await seatedTable();
    await bet(alex.id, tableId, alexBox.id);
    const joSnap = await loadSnapshot(tableId, jo.id);
    await bet(jo.id, tableId, joSnap.player!.boxes[0]!.id);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: key() });
    await addRanks(alex.id, tableId, ["A", "K"], alexBox.id);
    await expect(
      mutateCards({ actorId: alex.id, tableId, idempotencyKey: key(), boxId: joSnap.player!.boxes[0]!.id, action: "ADD", rank: "9" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      mutateCards({ actorId: alex.id, tableId, idempotencyKey: key(), dealer: true, action: "ADD", rank: "9" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await addRanks(owner.id, tableId, ["9"], joSnap.player!.boxes[0]!.id);
    await addRanks(owner.id, tableId, ["A", "6"], undefined, true);
    const bank = await loadSnapshot(tableId, owner.id);
    expect(bank.bank?.boxes.find((box) => box.id === alexBox.id)?.hand?.label).toBe("Blackjack");
    expect(bank.bank?.dealerHand?.label).toBe("Soft 17");
    const alexView = await loadSnapshot(tableId, alex.id);
    expect(alexView.player?.boxes[0]?.hand?.ranks).toEqual(["A", "K"]);
    expect(alexView.player?.boxes.every((box) => box.playerId === alex.id)).toBe(true);
  });

  test("card entry survives refresh and settled cards are immutable", async () => {
    const { owner, alex, tableId, alexBox } = await seatedTable({ cardAssist: "CONFIRM" });
    await bet(alex.id, tableId, alexBox.id);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: key() });
    await addRanks(alex.id, tableId, ["K", "7"], alexBox.id);
    await mutateCards({ actorId: alex.id, tableId, idempotencyKey: key(), boxId: alexBox.id, action: "COMPLETE" });
    await addRanks(owner.id, tableId, ["K", "7"], undefined, true);
    await mutateCards({ actorId: owner.id, tableId, idempotencyKey: key(), dealer: true, action: "COMPLETE" });
    const before = await loadSnapshot(tableId, alex.id);
    expect(before.player?.boxes[0]?.hand?.ranks).toEqual(["K", "7"]);
    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: key() });
    await applyCardOutcome({ actorId: owner.id, tableId, boxId: alexBox.id, idempotencyKey: key() });
    await expect(
      mutateCards({ actorId: owner.id, tableId, idempotencyKey: key(), boxId: alexBox.id, action: "ADD", rank: "2" }),
    ).rejects.toBeInstanceOf(DomainError);
    const after = await loadSnapshot(tableId, alex.id);
    expect(after.player?.boxes[0]?.hand?.ranks).toEqual(["K", "7"]);
    expect(after.player?.boxes[0]?.outcome).toBe("PUSH");
  });

  test("OFF does not auto-settle; CONFIRM requires Apply; AUTO settles complete boxes only", async () => {
    const off = await seatedTable({ cardAssist: "OFF" });
    await bet(off.alex.id, off.tableId, off.alexBox.id);
    await dealCards({ actorId: off.owner.id, tableId: off.tableId, idempotencyKey: key() });
    await addRanks(off.alex.id, off.tableId, ["K", "9"], off.alexBox.id);
    await mutateCards({ actorId: off.alex.id, tableId: off.tableId, idempotencyKey: key(), boxId: off.alexBox.id, action: "COMPLETE" });
    await addRanks(off.owner.id, off.tableId, ["K", "7"], undefined, true);
    await mutateCards({ actorId: off.owner.id, tableId: off.tableId, idempotencyKey: key(), dealer: true, action: "COMPLETE" });
    await enterPayout({ actorId: off.owner.id, tableId: off.tableId, idempotencyKey: key() });
    expect((await loadSnapshot(off.tableId, off.alex.id)).player?.boxes[0]?.outcome).toBeNull();

    const confirm = await seatedTable({ cardAssist: "CONFIRM" });
    await bet(confirm.alex.id, confirm.tableId, confirm.alexBox.id);
    await dealCards({ actorId: confirm.owner.id, tableId: confirm.tableId, idempotencyKey: key() });
    await addRanks(confirm.alex.id, confirm.tableId, ["K", "9"], confirm.alexBox.id);
    await mutateCards({ actorId: confirm.alex.id, tableId: confirm.tableId, idempotencyKey: key(), boxId: confirm.alexBox.id, action: "COMPLETE" });
    await addRanks(confirm.owner.id, confirm.tableId, ["K", "7"], undefined, true);
    await mutateCards({ actorId: confirm.owner.id, tableId: confirm.tableId, idempotencyKey: key(), dealer: true, action: "COMPLETE" });
    await enterPayout({ actorId: confirm.owner.id, tableId: confirm.tableId, idempotencyKey: key() });
    expect((await loadSnapshot(confirm.tableId, confirm.alex.id)).player?.boxes[0]?.outcome).toBeNull();
    await applyCardOutcome({ actorId: confirm.owner.id, tableId: confirm.tableId, boxId: confirm.alexBox.id, idempotencyKey: key() });
    expect((await loadSnapshot(confirm.tableId, confirm.alex.id)).player?.boxes[0]?.outcome).toBe("WON");

    const auto = await seatedTable({ cardAssist: "AUTO" });
    await bet(auto.alex.id, auto.tableId, auto.alexBox.id);
    const joSnap = await loadSnapshot(auto.tableId, auto.jo.id);
    const joBox = joSnap.player!.boxes[0]!;
    await bet(auto.jo.id, auto.tableId, joBox.id);
    await dealCards({ actorId: auto.owner.id, tableId: auto.tableId, idempotencyKey: key() });
    await addRanks(auto.alex.id, auto.tableId, ["K", "9"], auto.alexBox.id);
    await mutateCards({ actorId: auto.alex.id, tableId: auto.tableId, idempotencyKey: key(), boxId: auto.alexBox.id, action: "COMPLETE" });
    await addRanks(auto.owner.id, auto.tableId, ["K", "7"], undefined, true);
    await mutateCards({ actorId: auto.owner.id, tableId: auto.tableId, idempotencyKey: key(), dealer: true, action: "COMPLETE" });
    await enterPayout({ actorId: auto.owner.id, tableId: auto.tableId, idempotencyKey: key() });
    const autoSnap = await loadSnapshot(auto.tableId, auto.owner.id);
    expect(autoSnap.bank?.boxes.find((box) => box.id === auto.alexBox.id)?.outcome).toBe("WON");
    expect(autoSnap.bank?.boxes.find((box) => box.id === joBox.id)?.outcome).toBeNull();
    await settleBox({ actorId: auto.owner.id, tableId: auto.tableId, boxId: joBox.id, outcome: "LOST", idempotencyKey: key() });
    expect((await loadSnapshot(auto.tableId, auto.jo.id)).player?.boxes[0]?.outcome).toBe("LOST");
  });

  test("Open Bank keeps existing behaviour; Limited Bank funds once and reserves exposure", async () => {
    const open = await seatedTable();
    await bet(open.alex.id, open.tableId, open.alexBox.id);
    const openTable = await prisma.table.findUniqueOrThrow({ where: { id: open.tableId } });
    expect(openTable.bankFundingMode).toBe("OPEN");
    expect(openTable.bankLockedExposureMillis).toBe(0n);

    const limited = await seatedTable({ limited: true, bank: "500" });
    const funded = await prisma.ledgerEntry.count({
      where: { tableId: limited.tableId, transactionType: "BANK_FUNDING" },
    });
    expect(funded).toBe(1);
    await setBankFunding({
      actorId: limited.owner.id,
      tableId: limited.tableId,
      bankFundingMode: "LIMITED",
      startingBank: "500",
      idempotencyKey: key(),
    });
    expect(await prisma.ledgerEntry.count({ where: { tableId: limited.tableId, transactionType: "BANK_FUNDING" } })).toBe(1);
    await bet(limited.alex.id, limited.tableId, limited.alexBox.id);
    const afterBet = await prisma.table.findUniqueOrThrow({ where: { id: limited.tableId } });
    expect(afterBet.bankLockedExposureMillis).toBe(37500n);
    expect(afterBet.bankAvailableMillis).toBe(500000n - 37500n);
    const alex = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId: limited.tableId, userId: limited.alex.id } },
    });
    expect(alex.availableMillis).toBe(75000n);
  });

  test("insufficient Bank exposure rejects without debiting the Player", async () => {
    const { owner, alex, tableId, alexBox } = await seatedTable({ limited: true, bank: "10" });
    await expect(bet(alex.id, tableId, alexBox.id)).rejects.toMatchObject({ code: "BANK_CANNOT_COVER" });
    const member = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: alex.id } },
    });
    expect(member.availableMillis).toBe(100000n);
    await setCardAssist({ actorId: owner.id, tableId, cardAssist: "OFF", idempotencyKey: key() });
  });

  test("Double, Split and Insurance reserve extra exposure and settle independently", async () => {
    const { owner, alex, tableId, alexBox } = await seatedTable({ limited: true, bank: "500" });
    await bet(alex.id, tableId, alexBox.id);
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: key() });
    await doubleBox({ actorId: alex.id, tableId, boxId: alexBox.id, idempotencyKey: key() });
    let table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(table.bankLockedExposureMillis).toBe(75000n);
    const splitSource = await seatedTable({ limited: true, bank: "500" });
    await bet(splitSource.alex.id, splitSource.tableId, splitSource.alexBox.id);
    await dealCards({ actorId: splitSource.owner.id, tableId: splitSource.tableId, idempotencyKey: key() });
    await splitBox({ actorId: splitSource.alex.id, tableId: splitSource.tableId, boxId: splitSource.alexBox.id, idempotencyKey: key() });
    table = await prisma.table.findUniqueOrThrow({ where: { id: splitSource.tableId } });
    expect(table.bankLockedExposureMillis).toBe(75000n);

    const ins = await seatedTable({ limited: true, bank: "500" });
    await bet(ins.alex.id, ins.tableId, ins.alexBox.id);
    await dealCards({ actorId: ins.owner.id, tableId: ins.tableId, idempotencyKey: key() });
    await openInsurance({ actorId: ins.owner.id, tableId: ins.tableId, idempotencyKey: key() });
    await buyInsurance({ actorId: ins.alex.id, tableId: ins.tableId, boxId: ins.alexBox.id, amount: "10", idempotencyKey: key() });
    table = await prisma.table.findUniqueOrThrow({ where: { id: ins.tableId } });
    expect(table.bankLockedExposureMillis).toBe(37500n + 20000n);
    await enterPayout({ actorId: ins.owner.id, tableId: ins.tableId, idempotencyKey: key() });
    await settleInsurance({ actorId: ins.owner.id, tableId: ins.tableId, resolution: "DEALER_BLACKJACK", idempotencyKey: key() });
    await settleBox({ actorId: ins.owner.id, tableId: ins.tableId, boxId: ins.alexBox.id, outcome: "LOST", idempotencyKey: key() });
    const after = await prisma.table.findUniqueOrThrow({ where: { id: ins.tableId } });
    expect(after.bankLockedExposureMillis).toBe(0n);
    expect(after.bankAvailableMillis).toBe(500000n - 20000n + 25000n);
  });

  test("Limited Bank win, loss, Blackjack and push move the reserved exposure once", async () => {
    async function settleOutcome(outcome: "LOST" | "WON" | "BLACKJACK" | "PUSH") {
      const seated = await seatedTable({ limited: true, bank: "500" });
      await bet(seated.alex.id, seated.tableId, seated.alexBox.id);
      await dealCards({ actorId: seated.owner.id, tableId: seated.tableId, idempotencyKey: key() });
      await enterPayout({ actorId: seated.owner.id, tableId: seated.tableId, idempotencyKey: key() });
      await settleBox({
        actorId: seated.owner.id,
        tableId: seated.tableId,
        boxId: seated.alexBox.id,
        outcome,
        idempotencyKey: key(),
      });
      await expect(
        settleBox({
          actorId: seated.owner.id,
          tableId: seated.tableId,
          boxId: seated.alexBox.id,
          outcome,
          idempotencyKey: key(),
        }),
      ).rejects.toBeInstanceOf(DomainError);
      return prisma.table.findUniqueOrThrow({ where: { id: seated.tableId } });
    }
    expect((await settleOutcome("LOST")).bankAvailableMillis).toBe(525000n);
    expect((await settleOutcome("WON")).bankAvailableMillis).toBe(475000n);
    expect((await settleOutcome("BLACKJACK")).bankAvailableMillis).toBe(462500n);
    expect((await settleOutcome("PUSH")).bankAvailableMillis).toBe(500000n);
  });

  test("funding toggle works only during unstaked BETTING and persists into the next round", async () => {
    const { owner, alex, tableId, alexBox } = await seatedTable();
    await setBankFunding({
      actorId: owner.id,
      tableId,
      bankFundingMode: "LIMITED",
      startingBank: "500",
      idempotencyKey: key(),
    });
    await bet(alex.id, tableId, alexBox.id);
    await expect(
      setBankFunding({
        actorId: owner.id,
        tableId,
        bankFundingMode: "OPEN",
        idempotencyKey: key(),
      }),
    ).rejects.toMatchObject({ code: "FUNDING_LOCKED" });
    await dealCards({ actorId: owner.id, tableId, idempotencyKey: key() });
    await enterPayout({ actorId: owner.id, tableId, idempotencyKey: key() });
    await settleBox({ actorId: owner.id, tableId, boxId: alexBox.id, outcome: "LOST", idempotencyKey: key() });
    await startNextRound({ actorId: owner.id, tableId, idempotencyKey: key() });
    const next = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    expect(next.bankFundingMode).toBe("LIMITED");
    expect(next.bankAvailableMillis).toBe(525000n);
    await saveTable({ actorId: owner.id, tableId, idempotencyKey: key() });
    const reloaded = await loadSnapshot(tableId, owner.id);
    expect(reloaded.bank?.bankroll?.mode).toBe("LIMITED");
    expect(reloaded.bank?.bankroll?.available.label).toBe("525");
  });

  test("closing with Bank exposure is blocked and Player plus Bank conservation holds", async () => {
    const { owner, alex, tableId, alexBox } = await seatedTable({ limited: true, bank: "500" });
    await bet(alex.id, tableId, alexBox.id);
    await prisma.table.update({ where: { id: tableId }, data: { currentPhase: "ROUND_COMPLETE" } });
    await prisma.round.update({ where: { id: (await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).currentRoundId! }, data: { phase: "ROUND_COMPLETE" } });
    await expect(closeTable({ actorId: owner.id, tableId, idempotencyKey: key() })).rejects.toMatchObject({
      code: "LOCKED_FUNDS",
    });
    const table = await prisma.table.findUniqueOrThrow({ where: { id: tableId } });
    const member = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId, userId: alex.id } },
    });
    const box = await prisma.bettingBox.findUniqueOrThrow({ where: { id: alexBox.id } });
    expect(member.availableMillis + box.lockedBetMillis + table.bankAvailableMillis + table.bankLockedExposureMillis).toBe(
      100000n + 500000n,
    );
  });
});
