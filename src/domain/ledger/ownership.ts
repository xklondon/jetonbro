import type { AccountingBucket } from "./types";

/**
 * The Bank issues and absorbs virtual jetons from an unlimited reserve.
 * This is not a stored balance. It is the explicit source and sink for
 * minting, winnings, and lost stakes.
 */
export const BANK_VIRTUAL_RESERVE = "BANK_VIRTUAL_RESERVE" as const;
export type ValueAccount = AccountingBucket | typeof BANK_VIRTUAL_RESERVE | "PLAYER_POCKET";

export type ValueMove = {
  operation: string;
  from: ValueAccount;
  to: ValueAccount;
  notes: string;
};

export const VALUE_OWNERSHIP: ValueMove[] = [
  {
    operation: "Bank distributes jetons",
    from: BANK_VIRTUAL_RESERVE,
    to: "AVAILABLE",
    notes: "Unlimited mint into the player's table allocation.",
  },
  {
    operation: "Player places bet",
    from: "AVAILABLE",
    to: "LOCKED_BET",
    notes: "Stake is locked on the selected box. No mint.",
  },
  {
    operation: "Player retracts bet",
    from: "LOCKED_BET",
    to: "AVAILABLE",
    notes: "Only while Betting is open. No mint.",
  },
  {
    operation: "Player doubles",
    from: "AVAILABLE",
    to: "LOCKED_BET",
    notes: "Locks one additional stake on the same box.",
  },
  {
    operation: "Player splits",
    from: "AVAILABLE",
    to: "LOCKED_BET",
    notes: "Locks a matching stake on a new independently settled box.",
  },
  {
    operation: "Player takes Insurance",
    from: "AVAILABLE",
    to: "LOCKED_INSURANCE",
    notes: "Never mixed into LOCKED_BET.",
  },
  {
    operation: "Player loses",
    from: "LOCKED_BET",
    to: BANK_VIRTUAL_RESERVE,
    notes: "Locked stake is absorbed. AVAILABLE is unchanged. Total return 0.",
  },
  {
    operation: "Player wins",
    from: BANK_VIRTUAL_RESERVE,
    to: "AVAILABLE",
    notes: "LOCKED_BET is consumed. AVAILABLE is credited 2× stake (returned stake + 1× profit minted by the Bank).",
  },
  {
    operation: "Player pushes",
    from: "LOCKED_BET",
    to: "AVAILABLE",
    notes: "Stake returned. Profit 0. No mint.",
  },
  {
    operation: "Player gets Blackjack",
    from: BANK_VIRTUAL_RESERVE,
    to: "AVAILABLE",
    notes: "LOCKED_BET is consumed. AVAILABLE is credited 2.5× stake at 3:2 or 2.2× stake at 6:5.",
  },
  {
    operation: "Insurance wins",
    from: BANK_VIRTUAL_RESERVE,
    to: "AVAILABLE",
    notes: "LOCKED_INSURANCE is consumed. AVAILABLE is credited 3× Insurance stake. Box result is untouched.",
  },
  {
    operation: "Insurance loses",
    from: "LOCKED_INSURANCE",
    to: BANK_VIRTUAL_RESERVE,
    notes: "Insurance stake absorbed. Box result is untouched.",
  },
  {
    operation: "Carry into another round",
    from: "AVAILABLE",
    to: "AVAILABLE",
    notes: "Table AVAILABLE persists. No transfer.",
  },
  {
    operation: "Carry into another table",
    from: "AVAILABLE",
    to: "PLAYER_POCKET",
    notes: "TABLE_TRANSFER_OUT then TABLE_TRANSFER_IN into the destination table AVAILABLE.",
  },
  {
    operation: "Fund Limited Bank",
    from: BANK_VIRTUAL_RESERVE,
    to: "BANK_AVAILABLE",
    notes: "Table-specific bankroll minted once. Not a Player pocket.",
  },
  {
    operation: "Reserve Bank exposure",
    from: "BANK_AVAILABLE",
    to: "BANK_LOCKED_EXPOSURE",
    notes: "Maximum configured box or Insurance profit liability.",
  },
  {
    operation: "Release unused Bank exposure",
    from: "BANK_LOCKED_EXPOSURE",
    to: "BANK_AVAILABLE",
    notes: "Unused reserved profit returns after settlement or retract.",
  },
  {
    operation: "Limited Bank takes a lost stake",
    from: "LOCKED_BET",
    to: "BANK_AVAILABLE",
    notes: "Player loss credits the Limited Bank. Reserved exposure is released.",
  },
  {
    operation: "Limited Bank pays a win",
    from: "BANK_LOCKED_EXPOSURE",
    to: "AVAILABLE",
    notes: "Profit paid from reserved exposure. Player is credited once by BET_WIN_RETURN / BLACKJACK_RETURN / INSURANCE_WIN_RETURN. BANK_PAYOUT is the Bank-side exposure consumption, not a second Player credit. Remaining exposure returns to BANK_AVAILABLE.",
  },
  {
    operation: "Limited Bank takes Insurance loss",
    from: "LOCKED_INSURANCE",
    to: "BANK_AVAILABLE",
    notes: "Insurance stake absorbed independently of the box. Reserved Insurance exposure is released.",
  },
  {
    operation: "Increase Limited Bank",
    from: BANK_VIRTUAL_RESERVE,
    to: "BANK_AVAILABLE",
    notes: "Explicit BANK_FUNDING_ADJUSTMENT mint. Does not credit a Player.",
  },
  {
    operation: "Decrease Limited Bank",
    from: "BANK_AVAILABLE",
    to: BANK_VIRTUAL_RESERVE,
    notes: "Explicit BANK_FUNDING_ADJUSTMENT burn. Blocked while BANK_LOCKED_EXPOSURE > 0. Cannot go negative.",
  },
];
