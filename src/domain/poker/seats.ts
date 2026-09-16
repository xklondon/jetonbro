import { DomainError } from "../errors";

export type PokerSeat = {
  playerId: string;
  orderIndex: number;
};

export function orderedSeats(seats: PokerSeat[]): PokerSeat[] {
  return [...seats].sort((left, right) => left.orderIndex - right.orderIndex);
}

export function nextSeat(seats: PokerSeat[], fromPlayerId: string): PokerSeat {
  const ordered = orderedSeats(seats);
  if (ordered.length === 0) {
    throw new DomainError("POKER_SEATS", "At least two Players are required.");
  }
  const index = ordered.findIndex((seat) => seat.playerId === fromPlayerId);
  const start = index < 0 ? 0 : index;
  return ordered[(start + 1) % ordered.length]!;
}

export function nextDealer(seats: PokerSeat[], previousDealerId: string | null): PokerSeat {
  const ordered = orderedSeats(seats);
  if (ordered.length < 2) {
    throw new DomainError("POKER_SEATS", "Texas Hold’em needs at least two Players.");
  }
  if (!previousDealerId) return ordered[0]!;
  return nextSeat(ordered, previousDealerId);
}

export type BlindAssignment = {
  headsUp: boolean;
  dealerPlayerId: string;
  smallBlindPlayerId: string;
  bigBlindPlayerId: string;
  preflopFirstPlayerId: string;
  postflopFirstPlayerId: string;
};

export function assignBlinds(seats: PokerSeat[], dealerPlayerId: string): BlindAssignment {
  const ordered = orderedSeats(seats);
  if (ordered.length < 2) {
    throw new DomainError("POKER_SEATS", "Texas Hold’em needs at least two Players.");
  }
  const dealer = ordered.find((seat) => seat.playerId === dealerPlayerId) ?? ordered[0]!;
  const headsUp = ordered.length === 2;
  if (headsUp) {
    const other = nextSeat(ordered, dealer.playerId);
    return {
      headsUp: true,
      dealerPlayerId: dealer.playerId,
      smallBlindPlayerId: dealer.playerId,
      bigBlindPlayerId: other.playerId,
      preflopFirstPlayerId: dealer.playerId,
      postflopFirstPlayerId: other.playerId,
    };
  }
  const small = nextSeat(ordered, dealer.playerId);
  const big = nextSeat(ordered, small.playerId);
  const preflopFirst = nextSeat(ordered, big.playerId);
  return {
    headsUp: false,
    dealerPlayerId: dealer.playerId,
    smallBlindPlayerId: small.playerId,
    bigBlindPlayerId: big.playerId,
    preflopFirstPlayerId: preflopFirst.playerId,
    postflopFirstPlayerId: small.playerId,
  };
}

export function nextActorFrom(
  seats: PokerSeat[],
  fromPlayerId: string,
  canAct: (playerId: string) => boolean,
): string | null {
  const ordered = orderedSeats(seats);
  const index = ordered.findIndex((seat) => seat.playerId === fromPlayerId);
  const start = index < 0 ? 0 : index;
  for (let step = 1; step <= ordered.length; step += 1) {
    const seat = ordered[(start + step) % ordered.length]!;
    if (canAct(seat.playerId)) return seat.playerId;
  }
  return null;
}

export function playersLeftOfDealer(seats: PokerSeat[], dealerPlayerId: string): string[] {
  const ordered = orderedSeats(seats);
  const index = ordered.findIndex((seat) => seat.playerId === dealerPlayerId);
  if (index < 0) return ordered.map((seat) => seat.playerId);
  return [...ordered.slice(index + 1), ...ordered.slice(0, index + 1)].map((seat) => seat.playerId);
}
