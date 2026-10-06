export type TableBoardId =
  | "CREATE_TABLE"
  | "PHASE_ZERO_DEALER"
  | "PHASE_ZERO_PLAYER"
  | "BLACKJACK_DEALER"
  | "BLACKJACK_PLAYER"
  | "POKER_DEALER"
  | "POKER_PLAYER"
  | "WAITING";

export type TableBoardSnapshot = {
  isOwner: boolean;
  isDealer?: boolean;
  isSeatedPlayer?: boolean;
  game: string;
  phase: string;
  setup?: { setupCompleted?: boolean } | null;
  poker?: { phase?: string } | null;
};

/**
 * Canonical screen selection. Dealer board stays primary when the viewer is
 * both Dealer and a seated Player. Roles are never inferred from name or email.
 */
export function selectTableBoard(snapshot: TableBoardSnapshot): TableBoardId {
  const dealer = Boolean(snapshot.isDealer);
  const seated = Boolean(snapshot.isSeatedPlayer);
  const owner = Boolean(snapshot.isOwner);
  const pokerPhase = snapshot.poker?.phase ?? (snapshot.game === "POKER" ? snapshot.phase : null);

  if (owner && snapshot.setup && !snapshot.setup.setupCompleted) {
    return "CREATE_TABLE";
  }

  if (snapshot.game === "BLACKJACK" && snapshot.phase === "TABLE_SETUP") {
    if (owner || dealer) return "PHASE_ZERO_DEALER";
    if (seated) return "PHASE_ZERO_PLAYER";
    return "WAITING";
  }

  if (snapshot.game === "POKER" && (pokerPhase === "POKER_SETUP" || snapshot.phase === "TABLE_SETUP")) {
    // Poker Phase 0 uses the same oval PokerBoard as live phases (not the BJ PhaseZero ledger).
    if (owner) return "POKER_DEALER";
    if (seated || dealer) return "POKER_PLAYER";
    return "WAITING";
  }

  if (snapshot.game === "POKER") {
    if (owner) return "POKER_DEALER";
    if (seated || dealer) return "POKER_PLAYER";
    return "WAITING";
  }

  if (dealer) return "BLACKJACK_DEALER";
  if (seated) return "BLACKJACK_PLAYER";
  return "WAITING";
}
