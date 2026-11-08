import type { JetonMillis } from "../money";

/**
 * No-Limit hold’em minimum raise-to and last-full-raise tracking.
 *
 * Rules:
 * - minRaiseTo = current street wager + last full bet/raise increment
 * - Pre-flop starts with last increment = big blind (street wager already = BB)
 * - An opening bet (street wager 0) of size B sets last increment = B
 * - A full raise of size R (raise-to − previous wager) sets last increment = R
 * - A short all-in below a full raise does not change the increment and does not reopen
 */

export function raiseIncrement(raiseTo: JetonMillis, previousStreetWager: JetonMillis): JetonMillis {
  return raiseTo > previousStreetWager ? raiseTo - previousStreetWager : 0n;
}

/** Minimum legal raise-to (not raise-by). */
export function minRaiseTo(streetWager: JetonMillis, lastRaiseSize: JetonMillis): JetonMillis {
  const increment = lastRaiseSize > 0n ? lastRaiseSize : 0n;
  return streetWager + increment;
}

/** Minimum opening bet on a street with no wager yet. */
export function minBetSize(lastRaiseSize: JetonMillis, bigBlind: JetonMillis): JetonMillis {
  if (lastRaiseSize > 0n) return lastRaiseSize;
  return bigBlind > 0n ? bigBlind : 0n;
}

export function isFullRaise(
  raiseTo: JetonMillis,
  streetWager: JetonMillis,
  lastRaiseSize: JetonMillis,
): boolean {
  const needed = lastRaiseSize > 0n ? lastRaiseSize : 0n;
  return raiseTo > streetWager && raiseIncrement(raiseTo, streetWager) >= needed;
}

/**
 * Next last-full-raise increment after a wager that reaches `raiseTo`.
 * Short all-ins / sub-min raises keep the previous increment.
 */
export function nextLastRaiseSize(
  raiseTo: JetonMillis,
  previousStreetWager: JetonMillis,
  previousLastRaiseSize: JetonMillis,
): JetonMillis {
  if (!isFullRaise(raiseTo, previousStreetWager, previousLastRaiseSize)) {
    return previousLastRaiseSize;
  }
  return raiseIncrement(raiseTo, previousStreetWager);
}

export function initialStreetRaiseSize(bigBlind: JetonMillis): JetonMillis {
  return bigBlind > 0n ? bigBlind : 0n;
}
