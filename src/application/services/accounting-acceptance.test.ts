import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable, distributeJetons } from "@/application/services/tables";
import { joinWithToken } from "@/application/services/invitations";
import {
  buyInsurance,
  dealCards,
  doubleBox,
  enterPayout,
  mutateCards,
  openInsurance,
  placeOrRetractBet,
  setBankFunding,
  settleBox,
  settleInsurance,
  splitBox,
  startBetting,
} from "@/application/services/blackjack-round";
import { DomainError } from "@/domain/errors";
import { formatJetons } from "@/domain/money";
import type { BoxOutcome } from "@/domain/blackjack/payouts";
import type { LedgerTransactionType } from "@/domain/ledger/types";

let hasDb = Boolean(process.env.DATABASE_URL);
if (hasDb) {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    hasDb = false;
  }
}
const describeDb = hasDb ? describe : describe.skip;

const PLAYER_CREDIT_TYPES: LedgerTransactionType[] = [
  "BET_WIN_RETURN",
  "BET_PUSH_RETURN",
  "BET_LOSS",
  "BLACKJACK_RETURN",
  "INSURANCE_WIN_RETURN",
  "INSURANCE_LOSS",
];
const BANK_SIDE_TYPES: LedgerTransactionType[] = [
  "BANK_FUNDING",
  "BANK_FUNDING_ADJUSTMENT",
  "BANK_EXPOSURE_RESERVED",
  "BANK_EXPOSURE_RELEASED",
  "BANK_STAKE_TAKE",
  "BANK_PAYOUT",
];

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

type Buckets = {
  playerAvailable: bigint;
  lockedBet: bigint;
  lockedInsurance: bigint;
  bankAvailable: bigint;
  bankExposure: bigint;
};

function total(buckets: Buckets): bigint {
  return (
    buckets.playerAvailable +
    buckets.lockedBet +
    buckets.lockedInsurance +
    buckets.bankAvailable +
    buckets.bankExposure
  );
}

async function readBuckets(tableId: string, playerId: string): Promise<Buckets> {
  const table = await prisma.table.findUniqueOrThrow({
    where: { id: tableId },
    include: {
      currentRound: { include: { boxes: true, insuranceBets: true } },
    },
  });
  const member = await prisma.tableMember.findUniqueOrThrow({
    where: { tableId_userId: { tableId, userId: playerId } },
  });
  const lockedBet =
    table.currentRound?.boxes
      .filter((box) => box.playerId === playerId && !box.removedAt && !box.settledKey)
      .reduce((sum, box) => sum + box.lockedBetMillis, 0n) ?? 0n;
  const lockedInsurance =
    table.currentRound?.insuranceBets
      .filter((bet) => bet.playerId === playerId && !bet.settledKey)
      .reduce((sum, bet) => sum + bet.amountMillis, 0n) ?? 0n;
  return {
    playerAvailable: member.availableMillis,
    lockedBet,
    lockedInsurance,
    bankAvailable: table.bankAvailableMillis,
    bankExposure: table.bankLockedExposureMillis,
  };
}

function row(entry: {
  transactionType: string;
  amountMillis: bigint;
  playerId: string | null;
  balanceBeforeMillis: bigint;
  balanceAfterMillis: bigint;
  idempotencyKey: string;
  description: string;
}) {
  return {
    type: entry.transactionType,
    amount: formatJetons(entry.amountMillis),
    playerCredit: Boolean(entry.playerId),
    before: formatJetons(entry.balanceBeforeMillis),
    after: formatJetons(entry.balanceAfterMillis),
    key: entry.idempotencyKey,
    description: entry.description,
  };
}

async function ledger(tableId: string) {
  const entries = await prisma.ledgerEntry.findMany({
    where: { tableId },
    orderBy: { timestamp: "asc" },
  });
  return entries.map(row);
}

async function onePlayerLimited(options?: { cardAssist?: "OFF" | "CONFIRM" | "AUTO"; bank?: string }) {
  const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Owner");
  const alex = await user(`alex-${randomUUID()}@jetonbro.test`, "Alex");
  const created = await createTable({
    actorId: owner.id,
    idempotencyKey: key(),
    name: "Audit table",
    startingAllocation: "0",
    cardAssist: options?.cardAssist ?? "OFF",
    bankFundingMode: "LIMITED",
    startingBank: options?.bank ?? "500",
  });
  const tableId = created.tableId;
  const qr = await prisma.invitation.findFirstOrThrow({ where: { tableId, kind: "QR", revokedAt: null } });
  await joinWithToken({ userId: alex.id, token: qr.token, userEmail: alex.email });
  await distributeJetons({ actorId: owner.id, tableId, userId: alex.id, amount: "100", idempotencyKey: key() });
  await startBetting({ actorId: owner.id, tableId, idempotencyKey: key() });
  const box = await prisma.bettingBox.findFirstOrThrow({
    where: { playerId: alex.id, round: { tableId }, removedAt: null },
  });
  return { owner, alex, tableId, boxId: box.id };
}

async function lock25(playerId: string, tableId: string, boxId: string) {
  await placeOrRetractBet({
    actorId: playerId,
    tableId,
    boxId,
    amount: "25",
    mode: "SET",
    idempotencyKey: key(),
  });
}

async function toPayout(ownerId: string, tableId: string) {
  await dealCards({ actorId: ownerId, tableId, idempotencyKey: key() });
  await enterPayout({ actorId: ownerId, tableId, idempotencyKey: key() });
}

async function settle(
  ownerId: string,
  tableId: string,
  boxId: string,
  outcome: BoxOutcome,
  idempotencyKey = key(),
) {
  await settleBox({ actorId: ownerId, tableId, boxId, outcome, idempotencyKey });
}

function assertPlayerCreditedOnce(entries: ReturnType<typeof row>[], type: LedgerTransactionType, amount: string) {
  const playerCredits = entries.filter((entry) => PLAYER_CREDIT_TYPES.includes(entry.type as LedgerTransactionType) && entry.playerCredit);
  const matching = playerCredits.filter((entry) => entry.type === type);
  expect(matching).toHaveLength(1);
  expect(matching[0]?.amount).toBe(amount);
  for (const bank of entries.filter((entry) => BANK_SIDE_TYPES.includes(entry.type as LedgerTransactionType))) {
    expect(bank.playerCredit).toBe(false);
  }
}

describeDb("Limited Bank accounting acceptance", () => {
  test("25 ordinary bet: loss, win, push, Blackjack conserve 600", async () => {
    const expected: Record<BoxOutcome, { player: string; bank: string; playerType: LedgerTransactionType; playerAmount: string; bankTake?: string; bankPayout?: string; released: string }> = {
      LOST: { player: "75", bank: "525", playerType: "BET_LOSS", playerAmount: "25", bankTake: "25", released: "37.5" },
      WON: { player: "125", bank: "475", playerType: "BET_WIN_RETURN", playerAmount: "50", bankPayout: "25", released: "12.5" },
      PUSH: { player: "100", bank: "500", playerType: "BET_PUSH_RETURN", playerAmount: "25", released: "37.5" },
      BLACKJACK: { player: "137.5", bank: "462.5", playerType: "BLACKJACK_RETURN", playerAmount: "62.5", bankPayout: "37.5", released: "0" },
    };

    for (const outcome of ["LOST", "WON", "PUSH", "BLACKJACK"] as BoxOutcome[]) {
      const { owner, alex, tableId, boxId } = await onePlayerLimited();
      const start = await readBuckets(tableId, alex.id);
      expect(start).toEqual({
        playerAvailable: 100000n,
        lockedBet: 0n,
        lockedInsurance: 0n,
        bankAvailable: 500000n,
        bankExposure: 0n,
      });
      expect(total(start)).toBe(600000n);

      await lock25(alex.id, tableId, boxId);
      const reserved = await readBuckets(tableId, alex.id);
      expect(reserved).toEqual({
        playerAvailable: 75000n,
        lockedBet: 25000n,
        lockedInsurance: 0n,
        bankAvailable: 462500n,
        bankExposure: 37500n,
      });
      expect(total(reserved)).toBe(600000n);

      await toPayout(owner.id, tableId);
      await settle(owner.id, tableId, boxId, outcome);
      const after = await readBuckets(tableId, alex.id);
      expect(formatJetons(after.playerAvailable)).toBe(expected[outcome].player);
      expect(formatJetons(after.bankAvailable)).toBe(expected[outcome].bank);
      expect(after.lockedBet).toBe(0n);
      expect(after.bankExposure).toBe(0n);
      expect(total(after)).toBe(600000n);

      const duplicateKey = key();
      await expect(settle(owner.id, tableId, boxId, outcome, duplicateKey)).rejects.toBeInstanceOf(DomainError);
      const again = await readBuckets(tableId, alex.id);
      expect(again).toEqual(after);

      const entries = await ledger(tableId);
      assertPlayerCreditedOnce(entries, expected[outcome].playerType, expected[outcome].playerAmount);
      expect(entries.find((entry) => entry.type === "BANK_FUNDING")).toMatchObject({
        amount: "500",
        playerCredit: false,
        before: "0",
        after: "500",
        description: expect.stringContaining("BANK_VIRTUAL_RESERVE → BANK_AVAILABLE"),
      });
      expect(entries.find((entry) => entry.type === "BET_LOCKED")).toMatchObject({
        amount: "25",
        playerCredit: true,
        before: "100",
        after: "75",
      });
      expect(entries.filter((entry) => entry.type === "BANK_EXPOSURE_RESERVED")).toHaveLength(1);
      expect(entries.find((entry) => entry.type === "BANK_EXPOSURE_RESERVED")).toMatchObject({
        amount: "37.5",
        playerCredit: false,
        before: "0",
        after: "37.5",
        description: expect.stringContaining("BANK_AVAILABLE → BANK_LOCKED_EXPOSURE"),
      });
      const playerSettle = entries.find((entry) => entry.type === expected[outcome].playerType);
      expect(playerSettle?.playerCredit).toBe(true);
      expect(playerSettle?.amount).toBe(expected[outcome].playerAmount);
      expect(playerSettle?.before).toBe("75");
      expect(playerSettle?.after).toBe(expected[outcome].player);
      if (expected[outcome].bankTake) {
        expect(entries.filter((entry) => entry.type === "BANK_STAKE_TAKE")).toHaveLength(1);
        expect(entries.find((entry) => entry.type === "BANK_STAKE_TAKE")).toMatchObject({
          amount: expected[outcome].bankTake,
          playerCredit: false,
          before: "462.5",
          after: "487.5",
          description: expect.stringContaining("LOCKED_BET → BANK_AVAILABLE"),
        });
      } else {
        expect(entries.filter((entry) => entry.type === "BANK_STAKE_TAKE")).toHaveLength(0);
      }
      if (expected[outcome].bankPayout) {
        expect(entries.filter((entry) => entry.type === "BANK_PAYOUT")).toHaveLength(1);
        expect(entries.find((entry) => entry.type === "BANK_PAYOUT")?.playerCredit).toBe(false);
        expect(entries.find((entry) => entry.type === "BANK_PAYOUT")?.amount).toBe(expected[outcome].bankPayout);
        expect(entries.find((entry) => entry.type === "BANK_PAYOUT")?.description).toContain(
          "BANK_LOCKED_EXPOSURE → AVAILABLE",
        );
        expect(entries.find((entry) => entry.type === "BANK_PAYOUT")?.before).toBe("37.5");
        expect(entries.find((entry) => entry.type === "BANK_PAYOUT")?.after).toBe(
          expected[outcome].released === "0" ? "0" : "12.5",
        );
      } else {
        expect(entries.filter((entry) => entry.type === "BANK_PAYOUT")).toHaveLength(0);
      }
      if (expected[outcome].released === "0") {
        expect(entries.filter((entry) => entry.type === "BANK_EXPOSURE_RELEASED")).toHaveLength(0);
      } else {
        const released = entries.find((entry) => entry.type === "BANK_EXPOSURE_RELEASED");
        expect(released?.amount).toBe(expected[outcome].released);
        expect(released?.playerCredit).toBe(false);
        expect(released?.after).toBe("0");
        expect(released?.description).toContain("BANK_LOCKED_EXPOSURE → BANK_AVAILABLE");
      }
    }
  });

  test("Insurance 10 loses and wins independently of the box", async () => {
    const lose = await onePlayerLimited();
    await lock25(lose.alex.id, lose.tableId, lose.boxId);
    await dealCards({ actorId: lose.owner.id, tableId: lose.tableId, idempotencyKey: key() });
    await openInsurance({ actorId: lose.owner.id, tableId: lose.tableId, idempotencyKey: key() });
    await buyInsurance({
      actorId: lose.alex.id,
      tableId: lose.tableId,
      boxId: lose.boxId,
      amount: "10",
      idempotencyKey: key(),
    });
    const afterBuy = await readBuckets(lose.tableId, lose.alex.id);
    expect(afterBuy).toEqual({
      playerAvailable: 65000n,
      lockedBet: 25000n,
      lockedInsurance: 10000n,
      bankAvailable: 442500n,
      bankExposure: 57500n,
    });
    expect(total(afterBuy)).toBe(600000n);
    await enterPayout({ actorId: lose.owner.id, tableId: lose.tableId, idempotencyKey: key() });
    await settleInsurance({
      actorId: lose.owner.id,
      tableId: lose.tableId,
      resolution: "NO_DEALER_BLACKJACK",
      idempotencyKey: key(),
    });
    const afterInsLoss = await readBuckets(lose.tableId, lose.alex.id);
    expect(afterInsLoss.playerAvailable).toBe(65000n);
    expect(afterInsLoss.lockedInsurance).toBe(0n);
    expect(afterInsLoss.lockedBet).toBe(25000n);
    expect(afterInsLoss.bankAvailable).toBe(472500n);
    expect(afterInsLoss.bankExposure).toBe(37500n);
    expect(total(afterInsLoss)).toBe(600000n);
    const loseRows = await ledger(lose.tableId);
    assertPlayerCreditedOnce(loseRows, "INSURANCE_LOSS", "10");
    expect(loseRows.find((entry) => entry.type === "INSURANCE_LOSS")).toMatchObject({
      amount: "10",
      playerCredit: true,
      before: "65",
      after: "65",
    });
    expect(loseRows.find((entry) => entry.type === "BANK_STAKE_TAKE")).toMatchObject({
      amount: "10",
      playerCredit: false,
      before: "442.5",
      after: "452.5",
      description: expect.stringContaining("LOCKED_INSURANCE → BANK_AVAILABLE"),
    });
    expect(loseRows.filter((entry) => entry.type === "BANK_PAYOUT")).toHaveLength(0);

    const win = await onePlayerLimited();
    await lock25(win.alex.id, win.tableId, win.boxId);
    await dealCards({ actorId: win.owner.id, tableId: win.tableId, idempotencyKey: key() });
    await openInsurance({ actorId: win.owner.id, tableId: win.tableId, idempotencyKey: key() });
    await buyInsurance({
      actorId: win.alex.id,
      tableId: win.tableId,
      boxId: win.boxId,
      amount: "10",
      idempotencyKey: key(),
    });
    await enterPayout({ actorId: win.owner.id, tableId: win.tableId, idempotencyKey: key() });
    await settleInsurance({
      actorId: win.owner.id,
      tableId: win.tableId,
      resolution: "DEALER_BLACKJACK",
      idempotencyKey: key(),
    });
    const afterInsWin = await readBuckets(win.tableId, win.alex.id);
    expect(afterInsWin.playerAvailable).toBe(95000n);
    expect(afterInsWin.lockedInsurance).toBe(0n);
    expect(afterInsWin.lockedBet).toBe(25000n);
    expect(afterInsWin.bankAvailable).toBe(442500n);
    expect(afterInsWin.bankExposure).toBe(37500n);
    expect(total(afterInsWin)).toBe(600000n);
    const winRows = await ledger(win.tableId);
    assertPlayerCreditedOnce(winRows, "INSURANCE_WIN_RETURN", "30");
    expect(winRows.find((entry) => entry.type === "INSURANCE_WIN_RETURN")).toMatchObject({
      amount: "30",
      playerCredit: true,
      before: "65",
      after: "95",
    });
    expect(winRows.find((entry) => entry.type === "BANK_PAYOUT")).toMatchObject({
      amount: "20",
      playerCredit: false,
      before: "57.5",
      after: "37.5",
    });

    await settle(win.owner.id, win.tableId, win.boxId, "LOST");
    const combined = await readBuckets(win.tableId, win.alex.id);
    expect(combined).toEqual({
      playerAvailable: 95000n,
      lockedBet: 0n,
      lockedInsurance: 0n,
      bankAvailable: 505000n,
      bankExposure: 0n,
    });
    expect(total(combined)).toBe(600000n);
    const combinedRows = await ledger(win.tableId);
    expect(combinedRows.filter((entry) => entry.type === "INSURANCE_WIN_RETURN")).toHaveLength(1);
    expect(combinedRows.filter((entry) => entry.type === "BET_LOSS")).toHaveLength(1);
    expect(combinedRows.filter((entry) => entry.type === "BANK_PAYOUT")).toHaveLength(1);
    expect(combinedRows.filter((entry) => entry.type === "BANK_STAKE_TAKE")).toHaveLength(1);
    expect(combinedRows.find((entry) => entry.type === "BET_LOSS")).toMatchObject({
      amount: "25",
      playerCredit: true,
      before: "95",
      after: "95",
    });
    expect(combinedRows.find((entry) => entry.type === "BANK_STAKE_TAKE")).toMatchObject({
      amount: "25",
      playerCredit: false,
    });
    expect(combined.bankExposure).toBe(0n);
  });

  test("Double and Split reserve extra exposure and settle cleanly", async () => {
    const doubled = await onePlayerLimited();
    await lock25(doubled.alex.id, doubled.tableId, doubled.boxId);
    await dealCards({ actorId: doubled.owner.id, tableId: doubled.tableId, idempotencyKey: key() });
    await doubleBox({ actorId: doubled.alex.id, tableId: doubled.tableId, boxId: doubled.boxId, idempotencyKey: key() });
    const afterDouble = await readBuckets(doubled.tableId, doubled.alex.id);
    expect(afterDouble).toEqual({
      playerAvailable: 50000n,
      lockedBet: 50000n,
      lockedInsurance: 0n,
      bankAvailable: 425000n,
      bankExposure: 75000n,
    });
    expect(total(afterDouble)).toBe(600000n);
    await enterPayout({ actorId: doubled.owner.id, tableId: doubled.tableId, idempotencyKey: key() });
    await settle(doubled.owner.id, doubled.tableId, doubled.boxId, "WON");
    const afterDoubleWin = await readBuckets(doubled.tableId, doubled.alex.id);
    expect(afterDoubleWin).toEqual({
      playerAvailable: 150000n,
      lockedBet: 0n,
      lockedInsurance: 0n,
      bankAvailable: 450000n,
      bankExposure: 0n,
    });
    expect(total(afterDoubleWin)).toBe(600000n);

    const split = await onePlayerLimited();
    await lock25(split.alex.id, split.tableId, split.boxId);
    await dealCards({ actorId: split.owner.id, tableId: split.tableId, idempotencyKey: key() });
    const created = await splitBox({
      actorId: split.alex.id,
      tableId: split.tableId,
      boxId: split.boxId,
      idempotencyKey: key(),
    });
    const afterSplit = await readBuckets(split.tableId, split.alex.id);
    expect(afterSplit).toEqual({
      playerAvailable: 50000n,
      lockedBet: 50000n,
      lockedInsurance: 0n,
      bankAvailable: 425000n,
      bankExposure: 75000n,
    });
    expect(total(afterSplit)).toBe(600000n);
    await enterPayout({ actorId: split.owner.id, tableId: split.tableId, idempotencyKey: key() });
    await settle(split.owner.id, split.tableId, split.boxId, "PUSH");
    const afterParent = await readBuckets(split.tableId, split.alex.id);
    expect(afterParent.bankExposure).toBe(37500n);
    expect(total(afterParent)).toBe(600000n);
    await settle(split.owner.id, split.tableId, created.boxId, "PUSH");
    const afterBoth = await readBuckets(split.tableId, split.alex.id);
    expect(afterBoth).toEqual({
      playerAvailable: 100000n,
      lockedBet: 0n,
      lockedInsurance: 0n,
      bankAvailable: 500000n,
      bankExposure: 0n,
    });
    expect(total(afterBoth)).toBe(600000n);
  });

  test("insufficient coverage and duplicate settlement do not move value", async () => {
    const poor = await onePlayerLimited({ bank: "10" });
    const before = await readBuckets(poor.tableId, poor.alex.id);
    await expect(lock25(poor.alex.id, poor.tableId, poor.boxId)).rejects.toMatchObject({ code: "BANK_CANNOT_COVER" });
    expect(await readBuckets(poor.tableId, poor.alex.id)).toEqual(before);
    expect(total(before)).toBe(110000n);

    const ok = await onePlayerLimited();
    await lock25(ok.alex.id, ok.tableId, ok.boxId);
    await toPayout(ok.owner.id, ok.tableId);
    const settleKey = key();
    await settle(ok.owner.id, ok.tableId, ok.boxId, "WON", settleKey);
    const after = await readBuckets(ok.tableId, ok.alex.id);
    await settle(ok.owner.id, ok.tableId, ok.boxId, "WON", settleKey);
    expect(await readBuckets(ok.tableId, ok.alex.id)).toEqual(after);
    expect((await ledger(ok.tableId)).filter((entry) => entry.type === "BET_WIN_RETURN")).toHaveLength(1);
    expect((await ledger(ok.tableId)).filter((entry) => entry.type === "BANK_PAYOUT")).toHaveLength(1);
  });

  test("funding adjustment mints, burns, rejects negatives/exposure, and does not duplicate initial funding", async () => {
    const { owner, alex, tableId, boxId } = await onePlayerLimited();
    expect((await prisma.ledgerEntry.count({ where: { tableId, transactionType: "BANK_FUNDING" } }))).toBe(1);
    await expect(
      setBankFunding({
        actorId: owner.id,
        tableId,
        bankFundingMode: "LIMITED",
        startingBank: "-1",
        idempotencyKey: key(),
      }),
    ).rejects.toMatchObject({ code: "INVALID_AMOUNT" });
    expect(formatJetons((await readBuckets(tableId, alex.id)).bankAvailable)).toBe("500");

    await setBankFunding({
      actorId: owner.id,
      tableId,
      bankFundingMode: "LIMITED",
      startingBank: "800",
      idempotencyKey: key(),
    });
    expect(formatJetons((await readBuckets(tableId, alex.id)).bankAvailable)).toBe("800");
    const up = (await ledger(tableId)).find((entry) => entry.type === "BANK_FUNDING_ADJUSTMENT");
    expect(up?.amount).toBe("300");
    expect(up?.description).toContain("BANK_VIRTUAL_RESERVE → BANK_AVAILABLE");
    expect(up?.playerCredit).toBe(false);

    await setBankFunding({
      actorId: owner.id,
      tableId,
      bankFundingMode: "LIMITED",
      startingBank: "400",
      idempotencyKey: key(),
    });
    expect(formatJetons((await readBuckets(tableId, alex.id)).bankAvailable)).toBe("400");
    const downs = (await ledger(tableId)).filter((entry) => entry.type === "BANK_FUNDING_ADJUSTMENT");
    expect(downs.at(-1)?.description).toContain("BANK_AVAILABLE → BANK_VIRTUAL_RESERVE");
    expect(downs.at(-1)?.amount).toBe("400");

    const retryKey = key();
    await setBankFunding({
      actorId: owner.id,
      tableId,
      bankFundingMode: "LIMITED",
      startingBank: "400",
      idempotencyKey: retryKey,
    });
    await setBankFunding({
      actorId: owner.id,
      tableId,
      bankFundingMode: "LIMITED",
      startingBank: "400",
      idempotencyKey: retryKey,
    });
    expect((await prisma.ledgerEntry.count({ where: { tableId, transactionType: "BANK_FUNDING" } }))).toBe(1);
    expect(formatJetons((await readBuckets(tableId, alex.id)).bankAvailable)).toBe("400");

    await setBankFunding({ actorId: owner.id, tableId, bankFundingMode: "OPEN", idempotencyKey: key() });
    await setBankFunding({
      actorId: owner.id,
      tableId,
      bankFundingMode: "LIMITED",
      startingBank: "400",
      idempotencyKey: key(),
    });
    expect((await prisma.ledgerEntry.count({ where: { tableId, transactionType: "BANK_FUNDING" } }))).toBe(1);
    expect(formatJetons((await readBuckets(tableId, alex.id)).bankAvailable)).toBe("400");

    await lock25(alex.id, tableId, boxId);
    await expect(
      setBankFunding({
        actorId: owner.id,
        tableId,
        bankFundingMode: "LIMITED",
        startingBank: "100",
        idempotencyKey: key(),
      }),
    ).rejects.toMatchObject({ code: "FUNDING_LOCKED" });
    expect((await readBuckets(tableId, alex.id)).bankExposure > 0n).toBe(true);
  });

  test("AUTO settles complete boxes and Insurance once and matches manual balances", async () => {
    async function completeHands(ownerId: string, playerId: string, tableId: string, boxId: string, playerRanks: string[], dealerRanks: string[]) {
      for (const rank of playerRanks) {
        await mutateCards({ actorId: playerId, tableId, idempotencyKey: key(), boxId, action: "ADD", rank });
      }
      await mutateCards({ actorId: playerId, tableId, idempotencyKey: key(), boxId, action: "COMPLETE" });
      for (const rank of dealerRanks) {
        await mutateCards({ actorId: ownerId, tableId, idempotencyKey: key(), dealer: true, action: "ADD", rank });
      }
      await mutateCards({ actorId: ownerId, tableId, idempotencyKey: key(), dealer: true, action: "COMPLETE" });
    }

    const manual = await onePlayerLimited({ cardAssist: "OFF" });
    await lock25(manual.alex.id, manual.tableId, manual.boxId);
    await dealCards({ actorId: manual.owner.id, tableId: manual.tableId, idempotencyKey: key() });
    await completeHands(manual.owner.id, manual.alex.id, manual.tableId, manual.boxId, ["K", "9"], ["K", "7"]);
    await enterPayout({ actorId: manual.owner.id, tableId: manual.tableId, idempotencyKey: key() });
    await settle(manual.owner.id, manual.tableId, manual.boxId, "WON");
    const manualBuckets = await readBuckets(manual.tableId, manual.alex.id);

    const auto = await onePlayerLimited({ cardAssist: "AUTO" });
    await lock25(auto.alex.id, auto.tableId, auto.boxId);
    await dealCards({ actorId: auto.owner.id, tableId: auto.tableId, idempotencyKey: key() });
    await completeHands(auto.owner.id, auto.alex.id, auto.tableId, auto.boxId, ["K", "9"], ["K", "7"]);
    const payoutKey = key();
    await enterPayout({ actorId: auto.owner.id, tableId: auto.tableId, idempotencyKey: payoutKey });
    await enterPayout({ actorId: auto.owner.id, tableId: auto.tableId, idempotencyKey: payoutKey });
    const autoBuckets = await readBuckets(auto.tableId, auto.alex.id);
    expect(autoBuckets).toEqual(manualBuckets);
    expect(autoBuckets.bankExposure).toBe(0n);
    await expect(
      enterPayout({ actorId: auto.owner.id, tableId: auto.tableId, idempotencyKey: key() }),
    ).rejects.toMatchObject({ code: "PHASE_CONFLICT" });
    expect(await readBuckets(auto.tableId, auto.alex.id)).toEqual(autoBuckets);
    expect((await ledger(auto.tableId)).filter((entry) => entry.type === "BET_WIN_RETURN")).toHaveLength(1);
    expect((await ledger(auto.tableId)).filter((entry) => entry.type === "BANK_PAYOUT")).toHaveLength(1);

    const mixed = await onePlayerLimited({ cardAssist: "AUTO" });
    await lock25(mixed.alex.id, mixed.tableId, mixed.boxId);
    await dealCards({ actorId: mixed.owner.id, tableId: mixed.tableId, idempotencyKey: key() });
    await openInsurance({ actorId: mixed.owner.id, tableId: mixed.tableId, idempotencyKey: key() });
    await buyInsurance({
      actorId: mixed.alex.id,
      tableId: mixed.tableId,
      boxId: mixed.boxId,
      amount: "10",
      idempotencyKey: key(),
    });
    for (const rank of ["A", "K"]) {
      await mutateCards({ actorId: mixed.owner.id, tableId: mixed.tableId, idempotencyKey: key(), dealer: true, action: "ADD", rank });
    }
    await mutateCards({ actorId: mixed.owner.id, tableId: mixed.tableId, idempotencyKey: key(), dealer: true, action: "COMPLETE" });
    await enterPayout({ actorId: mixed.owner.id, tableId: mixed.tableId, idempotencyKey: key() });
    await enterPayout({ actorId: mixed.owner.id, tableId: mixed.tableId, idempotencyKey: key() });
    const mixedBuckets = await readBuckets(mixed.tableId, mixed.alex.id);
    expect(mixedBuckets.lockedInsurance).toBe(0n);
    expect(mixedBuckets.lockedBet).toBe(25000n);
    expect(mixedBuckets.playerAvailable).toBe(95000n);
    expect(mixedBuckets.bankExposure).toBe(37500n);
    expect(total(mixedBuckets)).toBe(600000n);
    expect((await ledger(mixed.tableId)).filter((entry) => entry.type === "INSURANCE_WIN_RETURN")).toHaveLength(1);
    const box = await prisma.bettingBox.findUniqueOrThrow({ where: { id: mixed.boxId } });
    expect(box.settledKey).toBeNull();
  });
});
