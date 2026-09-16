import { DomainError } from "../errors";

export const SWITCH_BLOCKED = "Finish or clear the current hand before switching games";

export type SwitchableGame = "BLACKJACK" | "POKER";

export function assertCanSwitchGame(input: {
  isOwner: boolean;
  game: string;
  blackjackPhase: string;
  pokerPhase: string | null;
  hasLockedBlackjack: boolean;
  hasBankExposure: boolean;
  hasLockedPoker: boolean;
}): void {
  if (!input.isOwner) {
    throw new DomainError("FORBIDDEN", "Only the table owner can switch games.", 403);
  }
  if (input.game === "BLACKJACK") {
    const phaseOk =
      input.blackjackPhase === "TABLE_SETUP" ||
      input.blackjackPhase === "BETTING" ||
      input.blackjackPhase === "ROUND_COMPLETE";
    if (!phaseOk || input.hasLockedBlackjack || input.hasBankExposure) {
      throw new DomainError("SWITCH_BLOCKED", SWITCH_BLOCKED, 409);
    }
    return;
  }
  if (input.game === "POKER") {
    const phaseOk = input.pokerPhase === "POKER_SETUP" || input.pokerPhase === "HAND_COMPLETE" || input.pokerPhase === null;
    if (!phaseOk || input.hasLockedPoker) {
      throw new DomainError("SWITCH_BLOCKED", SWITCH_BLOCKED, 409);
    }
    return;
  }
  throw new DomainError("SWITCH_BLOCKED", SWITCH_BLOCKED, 409);
}
