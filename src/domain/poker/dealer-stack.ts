import { DomainError } from "../errors";

export const POKER_DEALER_UNFUNDED = "Poker Dealer must be a seated participant with a starting stack.";

export function assertFundedPokerDealer(input: {
  dealerPlayerId: string;
  seats: { playerId: string; availableMillis: bigint }[];
  sessionStarting: boolean;
}): void {
  const dealer = input.seats.find((seat) => seat.playerId === input.dealerPlayerId);
  if (!dealer) {
    throw new DomainError("POKER_DEALER_UNFUNDED", POKER_DEALER_UNFUNDED);
  }
  if (input.sessionStarting && dealer.availableMillis <= 0n) {
    throw new DomainError("POKER_DEALER_UNFUNDED", POKER_DEALER_UNFUNDED);
  }
}
