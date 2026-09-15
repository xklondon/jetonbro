import { DomainError } from "../errors";
import type { JetonMillis } from "../money";

export const PAYOUT_RULES = ["THREE_TWO", "SIX_FIVE"] as const;
export type BlackjackPayoutRule = (typeof PAYOUT_RULES)[number];

export const BOX_OUTCOMES = ["WON", "PUSH", "LOST", "BLACKJACK"] as const;
export type BoxOutcome = (typeof BOX_OUTCOMES)[number];

export const INSURANCE_RESOLUTIONS = ["DEALER_BLACKJACK", "NO_DEALER_BLACKJACK"] as const;
export type InsuranceResolution = (typeof INSURANCE_RESOLUTIONS)[number];

/**
 * Total return credited to AVAILABLE when a box is settled.
 * Profit is total return minus the locked stake, except a loss returns 0
 * (the locked stake is absorbed by the Bank virtual reserve).
 *
 * Win: profit 1× stake, return 2× stake.
 * Push: profit 0, return 1× stake.
 * Loss: return 0.
 * Blackjack 3:2: profit 1.5× stake, return 2.5× stake.
 * Blackjack 6:5: profit 1.2× stake, return 2.2× stake.
 */
export function ordinaryReturnMillis(
  lockedStake: JetonMillis,
  outcome: BoxOutcome,
  rule: BlackjackPayoutRule,
): JetonMillis {
  if (lockedStake < 0n) {
    throw new DomainError("INVALID_STAKE", "Locked stake cannot be negative.");
  }
  switch (outcome) {
    case "LOST":
      return 0n;
    case "PUSH":
      return lockedStake;
    case "WON":
      return lockedStake * 2n;
    case "BLACKJACK":
      return lockedStake + blackjackWinningsMillis(lockedStake, rule);
    default: {
      const impossible: never = outcome;
      throw new DomainError("INVALID_OUTCOME", `Unsupported outcome: ${impossible}`);
    }
  }
}

/** Profit paid by the Bank virtual reserve, excluding returned stake. */
export function ordinaryProfitMillis(
  lockedStake: JetonMillis,
  outcome: BoxOutcome,
  rule: BlackjackPayoutRule,
): JetonMillis {
  if (outcome === "LOST") return 0n;
  return ordinaryReturnMillis(lockedStake, outcome, rule) - lockedStake;
}

export function blackjackWinningsMillis(
  lockedStake: JetonMillis,
  rule: BlackjackPayoutRule,
): JetonMillis {
  if (rule === "THREE_TWO") {
    return (lockedStake * 3n) / 2n;
  }
  return (lockedStake * 6n) / 5n;
}

/** Insurance 2:1: profit 2× Insurance stake, total return 3× Insurance stake. */
export function insuranceReturnMillis(
  lockedInsurance: JetonMillis,
  resolution: InsuranceResolution,
): JetonMillis {
  if (resolution === "DEALER_BLACKJACK") {
    return lockedInsurance * 3n;
  }
  return 0n;
}

export function insuranceProfitMillis(lockedInsurance: JetonMillis, resolution: InsuranceResolution): JetonMillis {
  if (resolution === "DEALER_BLACKJACK") return lockedInsurance * 2n;
  return 0n;
}

export function insuranceMaxMillis(originalStake: JetonMillis): JetonMillis {
  return originalStake / 2n;
}

export function outcomeLedgerType(outcome: BoxOutcome) {
  switch (outcome) {
    case "WON":
      return "BET_WIN_RETURN" as const;
    case "PUSH":
      return "BET_PUSH_RETURN" as const;
    case "LOST":
      return "BET_LOSS" as const;
    case "BLACKJACK":
      return "BLACKJACK_RETURN" as const;
  }
}
