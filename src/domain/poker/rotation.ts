import { assignBlinds, nextDealer, orderedSeats, type BlindAssignment, type PokerSeat } from "./seats";

/** Funded seats eligible for the next hand (skip broke / missing stacks). */
export function eligiblePokerSeats(
  seats: PokerSeat[],
  availableMillis: (playerId: string) => bigint,
): PokerSeat[] {
  return orderedSeats(seats).filter((seat) => availableMillis(seat.playerId) > 0n);
}

/**
 * Next-hand dealer + blinds from the completed hand's dealer and current seat order.
 * Used for HAND_COMPLETE preview and START HAND authorization — createHand must still
 * rotate from the completed hand's dealerPlayerId (not this preview) to avoid a double rotate.
 */
export function nextHandRotation(
  seats: PokerSeat[],
  previousDealerId: string | null,
  availableMillis: (playerId: string) => bigint,
): BlindAssignment {
  const eligible = eligiblePokerSeats(seats, availableMillis);
  const dealer = nextDealer(eligible, previousDealerId);
  return assignBlinds(eligible, dealer.playerId);
}
