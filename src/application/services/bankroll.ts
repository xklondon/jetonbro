import { appendLedger, creditBankAvailable, creditBankExposure } from "@/application/services/ledger";
import { DomainError } from "@/domain/errors";
import {
  additionalExposureMillis,
  boxProfitExposureMillis,
  insuranceProfitExposureMillis,
  type BankFundingMode,
  type CardAssistMode,
} from "@/domain/blackjack/bankroll";
import { ordinaryProfitMillis, type BoxOutcome, type InsuranceResolution } from "@/domain/blackjack/payouts";
import { formatJetons, parseWholeJetons, type JetonMillis } from "@/domain/money";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const BANK_CANNOT_COVER = "The Bank cannot cover this bet";
export const FUNDING_LOCKED = "Funding is locked for this round";

type FundedTable = {
  id: string;
  bankFundingMode: BankFundingMode;
  bankAvailableMillis: bigint;
  bankLockedExposureMillis: bigint;
  blackjackPayout: "THREE_TWO" | "SIX_FIVE";
  startingBankMillis: bigint | null;
};

export function parseCardAssist(value: unknown, fallback: CardAssistMode = "OFF"): CardAssistMode {
  if (value === "OFF" || value === "CONFIRM" || value === "AUTO") return value;
  return fallback;
}

export function parseBankFunding(value: unknown, fallback: BankFundingMode = "OPEN"): BankFundingMode {
  if (value === "OPEN" || value === "LIMITED") return value;
  return fallback;
}

export function roundHasLockedStake(round: {
  boxes: { removedAt: Date | null; lockedBetMillis: bigint }[];
  insuranceBets: { settledKey: string | null; amountMillis: bigint }[];
} | null | undefined): boolean {
  if (!round) return false;
  if (round.boxes.some((box) => !box.removedAt && box.lockedBetMillis > 0n)) return true;
  return round.insuranceBets.some((bet) => !bet.settledKey && bet.amountMillis > 0n);
}

export async function fundLimitedBankOnce(
  tx: Tx,
  input: {
    tableId: string;
    actorId: string;
    amount: JetonMillis;
  },
): Promise<void> {
  const ledgerKey = `bank-funding:${input.tableId}`;
  const existing = await tx.ledgerEntry.findUnique({ where: { idempotencyKey: ledgerKey } });
  if (existing) return;
  if (input.amount <= 0n) {
    throw new DomainError("INVALID_AMOUNT", "Starting Bank jetons must be greater than zero.");
  }
  const { before, after } = await creditBankAvailable(tx, input.tableId, input.amount);
  await appendLedger(tx, {
    actorId: input.actorId,
    tableId: input.tableId,
    transactionType: "BANK_FUNDING",
    amountMillis: input.amount,
    balanceBeforeMillis: before,
    balanceAfterMillis: after,
    idempotencyKey: ledgerKey,
    description: `BANK_VIRTUAL_RESERVE → BANK_AVAILABLE · ${formatJetons(input.amount)}`,
  });
  await tx.table.update({
    where: { id: input.tableId },
    data: { startingBankMillis: input.amount, bankFundingMode: "LIMITED" },
  });
}

export async function adjustLimitedBank(
  tx: Tx,
  input: {
    tableId: string;
    actorId: string;
    nextAmount: JetonMillis;
    idempotencyKey: string;
  },
): Promise<void> {
  const table = await tx.table.findUniqueOrThrow({ where: { id: input.tableId } });
  if (table.bankLockedExposureMillis > 0n) {
    throw new DomainError("LOCKED_FUNDS", FUNDING_LOCKED);
  }
  if (input.nextAmount < 0n) {
    throw new DomainError("INVALID_AMOUNT", "Limited Bank cannot be negative.");
  }
  const current = table.bankAvailableMillis;
  const delta = input.nextAmount - current;
  if (delta === 0n) return;
  const { before, after } = await creditBankAvailable(tx, input.tableId, delta);
  await appendLedger(tx, {
    actorId: input.actorId,
    tableId: input.tableId,
    transactionType: "BANK_FUNDING_ADJUSTMENT",
    amountMillis: delta > 0n ? delta : -delta,
    balanceBeforeMillis: before,
    balanceAfterMillis: after,
    idempotencyKey: `${input.idempotencyKey}:bank-adjust`,
    description:
      delta > 0n
        ? `BANK_VIRTUAL_RESERVE → BANK_AVAILABLE · ${formatJetons(delta)}`
        : `BANK_AVAILABLE → BANK_VIRTUAL_RESERVE · ${formatJetons(-delta)}`,
  });
  await tx.table.update({
    where: { id: input.tableId },
    data: { startingBankMillis: input.nextAmount },
  });
}

export async function applyBankFundingMode(
  tx: Tx,
  input: {
    table: FundedTable & {
      currentPhase: string;
      currentRound: {
        boxes: { removedAt: Date | null; lockedBetMillis: bigint }[];
        insuranceBets: { settledKey: string | null; amountMillis: bigint }[];
      } | null;
    };
    actorId: string;
    mode: BankFundingMode;
    startingBank?: string;
    idempotencyKey: string;
  },
): Promise<void> {
  const staked = roundHasLockedStake(input.table.currentRound) || input.table.bankLockedExposureMillis > 0n;
  if (staked) {
    throw new DomainError("FUNDING_LOCKED", FUNDING_LOCKED);
  }
  if (input.mode === "OPEN") {
    await tx.table.update({
      where: { id: input.table.id },
      data: { bankFundingMode: "OPEN" },
    });
    return;
  }
  const preserved = input.table.bankAvailableMillis + input.table.bankLockedExposureMillis;
  const requested = input.startingBank?.trim()
    ? parseWholeJetons(input.startingBank, "Starting Bank jetons")
    : input.table.startingBankMillis && input.table.startingBankMillis > 0n
      ? input.table.startingBankMillis
      : preserved > 0n
        ? preserved
        : parseWholeJetons("500", "Starting Bank jetons");
  await tx.table.update({
    where: { id: input.table.id },
    data: { bankFundingMode: "LIMITED" },
  });
  await fundLimitedBankOnce(tx, {
    tableId: input.table.id,
    actorId: input.actorId,
    amount: requested,
  });
  const funded = await tx.table.findUniqueOrThrow({ where: { id: input.table.id } });
  if (funded.bankAvailableMillis !== requested) {
    await adjustLimitedBank(tx, {
      tableId: input.table.id,
      actorId: input.actorId,
      nextAmount: requested,
      idempotencyKey: input.idempotencyKey,
    });
  }
}

async function reserveAmount(
  tx: Tx,
  table: FundedTable,
  amount: JetonMillis,
  actorId: string,
  idempotencyKey: string,
  description: string,
): Promise<void> {
  if (table.bankFundingMode !== "LIMITED" || amount <= 0n) return;
  if (table.bankAvailableMillis < amount) {
    throw new DomainError("BANK_CANNOT_COVER", BANK_CANNOT_COVER);
  }
  const available = await creditBankAvailable(tx, table.id, -amount);
  const exposure = await creditBankExposure(tx, table.id, amount);
  await appendLedger(tx, {
    actorId,
    tableId: table.id,
    transactionType: "BANK_EXPOSURE_RESERVED",
    amountMillis: amount,
    balanceBeforeMillis: exposure.before,
    balanceAfterMillis: exposure.after,
    idempotencyKey,
    description: `BANK_AVAILABLE → BANK_LOCKED_EXPOSURE · ${formatJetons(amount)} · ${description}`,
  });
  void available;
  table.bankAvailableMillis = available.after;
  table.bankLockedExposureMillis = exposure.after;
}

async function releaseAmount(
  tx: Tx,
  table: FundedTable,
  amount: JetonMillis,
  actorId: string,
  idempotencyKey: string,
  description: string,
): Promise<void> {
  if (table.bankFundingMode !== "LIMITED" || amount <= 0n) return;
  const exposure = await creditBankExposure(tx, table.id, -amount);
  const available = await creditBankAvailable(tx, table.id, amount);
  await appendLedger(tx, {
    actorId,
    tableId: table.id,
    transactionType: "BANK_EXPOSURE_RELEASED",
    amountMillis: amount,
    balanceBeforeMillis: exposure.before,
    balanceAfterMillis: exposure.after,
    idempotencyKey,
    description: `BANK_LOCKED_EXPOSURE → BANK_AVAILABLE · ${formatJetons(amount)} · ${description}`,
  });
  void available;
  table.bankAvailableMillis = available.after;
  table.bankLockedExposureMillis = exposure.after;
}

export async function syncBoxExposure(
  tx: Tx,
  input: {
    table: FundedTable;
    actorId: string;
    boxId: string;
    currentReserved: JetonMillis;
    nextStake: JetonMillis;
    idempotencyKey: string;
    label: string;
  },
): Promise<JetonMillis> {
  if (input.table.bankFundingMode !== "LIMITED") return 0n;
  const needed = input.nextStake <= 0n ? 0n : boxProfitExposureMillis(input.nextStake, input.table.blackjackPayout);
  if (needed > input.currentReserved) {
    await reserveAmount(
      tx,
      input.table,
      needed - input.currentReserved,
      input.actorId,
      `${input.idempotencyKey}:bank-reserve`,
      `Reserved Bank exposure for ${input.label}`,
    );
  } else if (needed < input.currentReserved) {
    await releaseAmount(
      tx,
      input.table,
      input.currentReserved - needed,
      input.actorId,
      `${input.idempotencyKey}:bank-release`,
      `Released unused Bank exposure for ${input.label}`,
    );
  }
  await tx.bettingBox.update({
    where: { id: input.boxId },
    data: { exposureReservedMillis: needed },
  });
  return needed;
}

export async function reserveSplitExposure(
  tx: Tx,
  input: {
    table: FundedTable;
    actorId: string;
    boxId: string;
    stake: JetonMillis;
    idempotencyKey: string;
    label: string;
  },
): Promise<JetonMillis> {
  const needed = boxProfitExposureMillis(input.stake, input.table.blackjackPayout);
  await reserveAmount(
    tx,
    input.table,
    needed,
    input.actorId,
    `${input.idempotencyKey}:bank-reserve`,
    `Reserved Bank exposure for ${input.label}`,
  );
  await tx.bettingBox.update({
    where: { id: input.boxId },
    data: { exposureReservedMillis: needed },
  });
  return needed;
}

export async function reserveInsuranceExposure(
  tx: Tx,
  input: {
    table: FundedTable;
    actorId: string;
    insuranceBetId: string;
    insuranceStake: JetonMillis;
    idempotencyKey: string;
    label: string;
  },
): Promise<JetonMillis> {
  const needed = insuranceProfitExposureMillis(input.insuranceStake);
  await reserveAmount(
    tx,
    input.table,
    needed,
    input.actorId,
    `${input.idempotencyKey}:bank-reserve`,
    `Reserved Bank exposure for ${input.label}`,
  );
  await tx.insuranceBet.update({
    where: { id: input.insuranceBetId },
    data: { exposureReservedMillis: needed },
  });
  return needed;
}

export async function settleLimitedBankBox(
  tx: Tx,
  input: {
    table: FundedTable;
    actorId: string;
    boxId: string;
    stake: JetonMillis;
    reserved: JetonMillis;
    outcome: BoxOutcome;
    idempotencyKey: string;
    label: string;
  },
): Promise<void> {
  if (input.table.bankFundingMode !== "LIMITED") return;
  const profit = ordinaryProfitMillis(input.stake, input.outcome, input.table.blackjackPayout);
  if (input.outcome === "LOST" && input.stake > 0n) {
    const take = await creditBankAvailable(tx, input.table.id, input.stake);
    await appendLedger(tx, {
      actorId: input.actorId,
      tableId: input.table.id,
      boxId: input.boxId,
      transactionType: "BANK_STAKE_TAKE",
      amountMillis: input.stake,
      balanceBeforeMillis: take.before,
      balanceAfterMillis: take.after,
      idempotencyKey: `${input.idempotencyKey}:bank-take`,
      description: `LOCKED_BET → BANK_AVAILABLE · ${formatJetons(input.stake)} · ${input.label}`,
    });
    input.table.bankAvailableMillis = take.after;
  }
  if (profit > 0n) {
    const payout = await creditBankExposure(tx, input.table.id, -profit);
    await appendLedger(tx, {
      actorId: input.actorId,
      tableId: input.table.id,
      boxId: input.boxId,
      transactionType: "BANK_PAYOUT",
      amountMillis: profit,
      balanceBeforeMillis: payout.before,
      balanceAfterMillis: payout.after,
      idempotencyKey: `${input.idempotencyKey}:bank-payout`,
      description: `BANK_LOCKED_EXPOSURE → AVAILABLE · Bank-side profit ${formatJetons(profit)} · ${input.label} · Player credit is the BET/BLACKJACK return`,
    });
    input.table.bankLockedExposureMillis = payout.after;
  }
  const unused = input.reserved - profit;
  if (unused > 0n) {
    await releaseAmount(
      tx,
      input.table,
      unused,
      input.actorId,
      `${input.idempotencyKey}:bank-release`,
      `Released unused Bank exposure for ${input.label}`,
    );
  }
  await tx.bettingBox.update({
    where: { id: input.boxId },
    data: { exposureReservedMillis: 0n },
  });
}

export async function settleLimitedBankInsurance(
  tx: Tx,
  input: {
    table: FundedTable;
    actorId: string;
    insuranceBetId: string;
    boxId: string;
    stake: JetonMillis;
    reserved: JetonMillis;
    resolution: InsuranceResolution;
    idempotencyKey: string;
  },
): Promise<void> {
  if (input.table.bankFundingMode !== "LIMITED") return;
  const profit = input.resolution === "DEALER_BLACKJACK" ? insuranceProfitExposureMillis(input.stake) : 0n;
  if (input.resolution === "NO_DEALER_BLACKJACK" && input.stake > 0n) {
    const take = await creditBankAvailable(tx, input.table.id, input.stake);
    await appendLedger(tx, {
      actorId: input.actorId,
      tableId: input.table.id,
      boxId: input.boxId,
      insuranceBetId: input.insuranceBetId,
      transactionType: "BANK_STAKE_TAKE",
      amountMillis: input.stake,
      balanceBeforeMillis: take.before,
      balanceAfterMillis: take.after,
      idempotencyKey: `${input.idempotencyKey}:bank-take`,
      description: `LOCKED_INSURANCE → BANK_AVAILABLE · ${formatJetons(input.stake)}`,
    });
    input.table.bankAvailableMillis = take.after;
  }
  if (profit > 0n) {
    const payout = await creditBankExposure(tx, input.table.id, -profit);
    await appendLedger(tx, {
      actorId: input.actorId,
      tableId: input.table.id,
      boxId: input.boxId,
      insuranceBetId: input.insuranceBetId,
      transactionType: "BANK_PAYOUT",
      amountMillis: profit,
      balanceBeforeMillis: payout.before,
      balanceAfterMillis: payout.after,
      idempotencyKey: `${input.idempotencyKey}:bank-payout`,
      description: `BANK_LOCKED_EXPOSURE → AVAILABLE · Bank-side Insurance profit ${formatJetons(profit)} · Player credit is INSURANCE_WIN_RETURN`,
    });
    input.table.bankLockedExposureMillis = payout.after;
  }
  const unused = input.reserved - profit;
  if (unused > 0n) {
    await releaseAmount(
      tx,
      input.table,
      unused,
      input.actorId,
      `${input.idempotencyKey}:bank-release`,
      "Released unused Insurance Bank exposure",
    );
  }
  await tx.insuranceBet.update({
    where: { id: input.insuranceBetId },
    data: { exposureReservedMillis: 0n },
  });
}

export function boxCoverageOk(
  table: { bankFundingMode: BankFundingMode; bankAvailableMillis: bigint; blackjackPayout: "THREE_TWO" | "SIX_FIVE" },
  currentReserved: JetonMillis,
  nextStake: JetonMillis,
): boolean {
  if (table.bankFundingMode !== "LIMITED") return true;
  const extra = additionalExposureMillis(currentReserved, nextStake, table.blackjackPayout);
  return extra <= table.bankAvailableMillis;
}

export function insuranceCoverageOk(
  table: { bankFundingMode: BankFundingMode; bankAvailableMillis: bigint },
  insuranceStake: JetonMillis,
): boolean {
  if (table.bankFundingMode !== "LIMITED") return true;
  return insuranceProfitExposureMillis(insuranceStake) <= table.bankAvailableMillis;
}
