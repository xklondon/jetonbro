import { DomainError } from "../errors";

export const POKER_RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export const POKER_SUITS = ["S", "H", "D", "C"] as const;
export const SUIT_GLYPH: Record<(typeof POKER_SUITS)[number], string> = {
  S: "♠",
  H: "♥",
  D: "♦",
  C: "♣",
};

export type PokerCard = {
  rank: (typeof POKER_RANKS)[number];
  suit: (typeof POKER_SUITS)[number];
};

export function communityCardLimit(phase: string): number {
  if (phase === "FLOP") return 3;
  if (phase === "TURN") return 4;
  if (phase === "RIVER" || phase === "SHOWDOWN" || phase === "HAND_COMPLETE") return 5;
  return 0;
}

export function parsePokerCard(rank: string, suit: string): PokerCard {
  const parsedRank = POKER_RANKS.find((item) => item === rank);
  const parsedSuit = POKER_SUITS.find((item) => item === suit);
  if (!parsedRank || !parsedSuit) {
    throw new DomainError("INVALID_CARD", "Choose a rank and a suit.");
  }
  return { rank: parsedRank, suit: parsedSuit };
}

export function parsePokerCards(value: unknown): PokerCard[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new DomainError("INVALID_CARD", "Choose a rank and a suit.");
    }
    const record = item as { rank?: unknown; suit?: unknown };
    return parsePokerCard(String(record.rank ?? ""), String(record.suit ?? ""));
  });
}

export function readPokerCards(value: unknown): PokerCard[] {
  try {
    return parsePokerCards(value);
  } catch {
    return [];
  }
}

export function cardLabel(card: PokerCard): string {
  return `${card.rank}${SUIT_GLYPH[card.suit]}`;
}

export function assertCommunityCards(phase: string, cards: PokerCard[]) {
  const limit = communityCardLimit(phase);
  if (cards.length > limit) {
    throw new DomainError("CARD_LIMIT", `This street can show at most ${limit} community cards.`);
  }
  if (phase === "FLOP" && cards.length !== 0 && cards.length !== 3) {
    throw new DomainError("CARD_LIMIT", "The flop is exactly 3 community cards.");
  }
  if (phase === "TURN" && cards.length !== 0 && cards.length !== 3 && cards.length !== 4) {
    throw new DomainError("CARD_LIMIT", "Add the flop first, then one turn card.");
  }
  if ((phase === "RIVER" || phase === "SHOWDOWN" || phase === "HAND_COMPLETE") && cards.length !== 0 && ![3, 4, 5].includes(cards.length)) {
    throw new DomainError("CARD_LIMIT", "Community cards stay 3, 4 or 5 after the flop.");
  }
}

export function assertHoleCards(cards: PokerCard[]) {
  if (cards.length > 2) {
    throw new DomainError("CARD_LIMIT", "Hole cards are at most 2 cards.");
  }
}
