export const ROUND_PHASES = [
  "TABLE_SETUP",
  "BETTING",
  "PLAYING",
  "PAYOUT",
  "ROUND_COMPLETE",
] as const;

export type RoundPhase = (typeof ROUND_PHASES)[number];

export const FORWARD_TRANSITIONS = {
  TABLE_SETUP: "BETTING",
  BETTING: "PLAYING",
  PLAYING: "PAYOUT",
  PAYOUT: "ROUND_COMPLETE",
  ROUND_COMPLETE: "BETTING",
} as const satisfies Record<RoundPhase, RoundPhase>;
