import type { BlackjackPayoutRule } from "./payouts";

export const BLACKJACK_TABLE_DEFAULTS = {
  blackjackPayout: "THREE_TWO" as BlackjackPayoutRule,
  maxBoxesPerPlayer: 3,
  insuranceEnabled: true,
  startingAllocation: "100",
} as const;

export const MAX_BOXES_PER_PLAYER_MIN = 1;
export const MAX_BOXES_PER_PLAYER_MAX = 8;

export function parseMaxBoxesPerPlayer(value: string | number | undefined, fallback = BLACKJACK_TABLE_DEFAULTS.maxBoxesPerPlayer): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < MAX_BOXES_PER_PLAYER_MIN || parsed > MAX_BOXES_PER_PLAYER_MAX) {
    return fallback;
  }
  return parsed;
}
