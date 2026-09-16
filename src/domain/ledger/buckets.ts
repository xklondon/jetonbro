import { DomainError } from "../errors";
import type { JetonMillis } from "../money";
import type { AccountingBucket, LedgerTransactionType } from "./types";

export type BucketMove = {
  from: AccountingBucket;
  to: AccountingBucket;
  amount: JetonMillis;
};

export function moveBetweenBuckets(
  buckets: Record<AccountingBucket, JetonMillis>,
  move: BucketMove,
): Record<AccountingBucket, JetonMillis> {
  if (move.amount < 0n) {
    throw new DomainError("INVALID_AMOUNT", "Cannot move a negative jeton amount.");
  }
  if (buckets[move.from] < move.amount) {
    throw new DomainError(
      "INSUFFICIENT_JETONS",
      `Not enough jetons in ${move.from} to move ${move.amount.toString()}.`,
    );
  }
  return {
    ...buckets,
    [move.from]: buckets[move.from] - move.amount,
    [move.to]: buckets[move.to] + move.amount,
  };
}

export function emptyBuckets(): Record<AccountingBucket, JetonMillis> {
  return {
    AVAILABLE: 0n,
    LOCKED_BET: 0n,
    LOCKED_INSURANCE: 0n,
    SETTLED: 0n,
    BANK_AVAILABLE: 0n,
    BANK_LOCKED_EXPOSURE: 0n,
  };
}

export function bucketForLockType(type: LedgerTransactionType): AccountingBucket {
  switch (type) {
    case "INSURANCE_LOCKED":
    case "INSURANCE_WIN_RETURN":
    case "INSURANCE_LOSS":
      return "LOCKED_INSURANCE";
    case "BET_LOCKED":
    case "BET_RETRACTED":
    case "DOUBLE_LOCKED":
    case "SPLIT_LOCKED":
    case "BET_WIN_RETURN":
    case "BET_PUSH_RETURN":
    case "BET_LOSS":
    case "BLACKJACK_RETURN":
      return "LOCKED_BET";
    case "BANK_FUNDING":
    case "BANK_FUNDING_ADJUSTMENT":
    case "BANK_STAKE_TAKE":
      return "BANK_AVAILABLE";
    case "BANK_PAYOUT":
    case "BANK_EXPOSURE_RESERVED":
    case "BANK_EXPOSURE_RELEASED":
      return "BANK_LOCKED_EXPOSURE";
    default:
      return "AVAILABLE";
  }
}
