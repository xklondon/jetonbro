/**
 * Shared phase copy: one primary label, at most one short supporting instruction.
 * Role badges are never phase labels. Title and instruction are always stacked.
 */

export type PhaseCopy = {
  primary: string;
  instruction?: string;
};

export function blackjackPhaseCopy(input: {
  role: "DEALER" | "PLAYER" | "BANK";
  phase: string;
  insuranceOpen?: boolean;
  /** Seated non-bank Players — drives Setup instruction only. */
  seatedPlayerCount?: number;
}): PhaseCopy {
  const phase = input.phase;
  const role = input.role === "BANK" ? "DEALER" : input.role;

  if (phase === "TABLE_SETUP") {
    if (role === "PLAYER") {
      return { primary: "TABLE SETUP", instruction: "Waiting for the Dealer to open betting." };
    }
    const seated = input.seatedPlayerCount ?? 0;
    if (seated === 0) {
      return { primary: "TABLE SETUP", instruction: "Invite a Player to begin." };
    }
    return { primary: "TABLE SETUP", instruction: "Ready to open betting." };
  }

  if (phase === "BETTING") {
    return {
      primary: "BETTING",
      instruction: role === "PLAYER" ? "Place your bets." : "Players place their bets.",
    };
  }

  if (phase === "PLAYING" && input.insuranceOpen) {
    return { primary: "INSURANCE", instruction: "Insurance is open." };
  }

  if (phase === "PLAYING") {
    return { primary: "PLAYING", instruction: "Play the hands." };
  }

  if (phase === "PAYOUT" || phase === "ROUND_COMPLETE") {
    return { primary: "PAYOUT", instruction: "Settle each box." };
  }

  return { primary: phase.replaceAll("_", " ") };
}

export function pokerPhaseCopy(input: {
  phase: string;
  waitingCopy?: string | null;
  isActor?: boolean;
  actorName?: string | null;
}): PhaseCopy {
  const phase = input.phase;
  if (phase === "POKER_SETUP" || phase === "TABLE_SETUP") {
    return { primary: "TABLE SETUP", instruction: "Waiting for Players" };
  }
  const primary =
    phase === "PRE_FLOP"
      ? "PRE-FLOP"
      : phase === "HAND_COMPLETE"
        ? "HAND COMPLETE"
        : phase.replaceAll("_", " ");
  if (phase === "SHOWDOWN" || phase === "HAND_COMPLETE") {
    return { primary };
  }
  if (input.isActor) return { primary, instruction: "YOUR TURN" };
  if (input.actorName) return { primary, instruction: `TURN · ${input.actorName}` };
  if (input.waitingCopy && !/pre-?flop|flop|turn|river|showdown|setup/i.test(input.waitingCopy)) {
    return { primary, instruction: input.waitingCopy };
  }
  return { primary };
}

/** Compact START HAND seat error — never the raw DomainError string on Create Table. */
export function pokerStartHandNotice(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/needs at least two|at least two players|POKER_SEATS/i.test(raw)) {
    return "Add at least two Players to start a Poker hand.";
  }
  return raw;
}
