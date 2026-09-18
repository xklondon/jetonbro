export const POKER_HAND_PHASES = [
  "POKER_SETUP",
  "PRE_FLOP",
  "FLOP",
  "TURN",
  "RIVER",
  "SHOWDOWN",
  "HAND_COMPLETE",
] as const;

export type PokerHandPhase = (typeof POKER_HAND_PHASES)[number];

export const BETTING_STREETS = ["PRE_FLOP", "FLOP", "TURN", "RIVER"] as const;
export type BettingStreet = (typeof BETTING_STREETS)[number];

export const STREET_ADVANCE = {
  PRE_FLOP: { next: "FLOP", command: "DEAL FLOP" },
  FLOP: { next: "TURN", command: "DEAL TURN" },
  TURN: { next: "RIVER", command: "DEAL RIVER" },
  RIVER: { next: "SHOWDOWN", command: "SHOWDOWN" },
} as const satisfies Record<BettingStreet, { next: PokerHandPhase; command: string }>;

export function isBettingStreet(phase: string): phase is BettingStreet {
  return (BETTING_STREETS as readonly string[]).includes(phase);
}

export const POKER_STREET_RAIL = ["DEAL", "PRE-FLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;
export type PokerStreetRailStop = (typeof POKER_STREET_RAIL)[number];
export type PokerStreetRailState = "done" | "current" | "next";

export function pokerStreetRail(phase: string): { id: PokerStreetRailStop; state: PokerStreetRailState }[] {
  const currentIndex =
    phase === "HAND_COMPLETE"
      ? POKER_STREET_RAIL.length
      : phase === "POKER_SETUP"
        ? 0
        : phase === "PRE_FLOP"
          ? 1
          : phase === "FLOP"
            ? 2
            : phase === "TURN"
              ? 3
              : phase === "RIVER"
                ? 4
                : phase === "SHOWDOWN"
                  ? 5
                  : 0;
  return POKER_STREET_RAIL.map((id, index) => ({
    id,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "next",
  }));
}

export const POKER_PHASE_RANK: Record<PokerHandPhase, number> = {
  POKER_SETUP: 0,
  PRE_FLOP: 1,
  FLOP: 2,
  TURN: 3,
  RIVER: 4,
  SHOWDOWN: 5,
  HAND_COMPLETE: 6,
};
