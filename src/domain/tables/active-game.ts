export type ActiveGameProjection = {
  game: "BLACKJACK" | "POKER";
  gameLabel: string;
  phase: string;
  phaseLabel: string;
  headline: string;
};

export function formatPokerPhaseLabel(phase: string): string {
  if (phase === "PRE_FLOP") return "PRE-FLOP";
  return phase.replaceAll("_", " ");
}

export function projectActiveGame(input: {
  game: string;
  blackjackPhase: string;
  pokerPhase?: string | null;
  pausedAt?: Date | null;
}): ActiveGameProjection {
  if (input.game === "POKER") {
    const phase = input.pokerPhase && input.pokerPhase.length > 0 ? input.pokerPhase : "POKER_SETUP";
    const phaseLabel = input.pausedAt ? "SAVED" : formatPokerPhaseLabel(phase);
    return {
      game: "POKER",
      gameLabel: "Texas Hold’em",
      phase: input.pausedAt ? "SAVED" : phase,
      phaseLabel,
      headline: `Texas Hold’em · ${phaseLabel}`,
    };
  }
  const phase = input.pausedAt ? "SAVED" : input.blackjackPhase;
  const phaseLabel = input.pausedAt ? "SAVED" : input.blackjackPhase.replaceAll("_", " ");
  return {
    game: "BLACKJACK",
    gameLabel: "Blackjack",
    phase,
    phaseLabel,
    headline: `Blackjack · ${phaseLabel}`,
  };
}

export function pokerHandIsOpen(phase: string | null | undefined): boolean {
  return Boolean(phase && phase !== "POKER_SETUP" && phase !== "HAND_COMPLETE");
}
