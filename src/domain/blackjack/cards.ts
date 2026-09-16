import { DomainError } from "../errors";
import type { BoxOutcome, InsuranceResolution } from "./payouts";

export const CARD_RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
export type CardRank = (typeof CARD_RANKS)[number];

export type HandTotal = {
  total: number;
  soft: boolean;
  bust: boolean;
  naturalBlackjack: boolean;
  label: string;
};

export function parseCardRank(value: string): CardRank {
  const rank = CARD_RANKS.find((item) => item === value);
  if (!rank) {
    throw new DomainError("INVALID_RANK", "Choose a Blackjack rank.");
  }
  return rank;
}

export function parseCardRanks(value: unknown): CardRank[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => parseCardRank(String(item)));
}

function rankValue(rank: CardRank): number {
  if (rank === "A") return 11;
  if (rank === "K" || rank === "Q" || rank === "J" || rank === "10") return 10;
  return Number.parseInt(rank, 10);
}

export function evaluateHand(ranks: readonly string[], isSplitOffshoot = false): HandTotal {
  const parsed = ranks.map((rank) => parseCardRank(rank));
  let total = 0;
  let aces = 0;
  for (const rank of parsed) {
    total += rankValue(rank);
    if (rank === "A") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const bust = total > 21;
  const soft = aces > 0 && !bust;
  const naturalBlackjack = !isSplitOffshoot && parsed.length === 2 && total === 21;
  let label = `Hard ${total}`;
  if (parsed.length === 0) label = "";
  else if (bust) label = "Bust";
  else if (naturalBlackjack) label = "Blackjack";
  else if (total === 21) label = "21";
  else if (soft) label = `Soft ${total}`;
  return { total, soft, bust, naturalBlackjack, label };
}

export function suggestedBoxOutcome(
  playerRanks: readonly string[],
  dealerRanks: readonly string[],
  isSplitOffshoot = false,
): BoxOutcome | null {
  if (playerRanks.length === 0 || dealerRanks.length === 0) return null;
  const player = evaluateHand(playerRanks, isSplitOffshoot);
  const dealer = evaluateHand(dealerRanks, false);
  if (player.bust) return "LOST";
  if (dealer.bust) return "WON";
  if (player.naturalBlackjack && !dealer.naturalBlackjack) return "BLACKJACK";
  if (dealer.naturalBlackjack && !player.naturalBlackjack) return "LOST";
  if (player.naturalBlackjack && dealer.naturalBlackjack) return "PUSH";
  if (player.total > dealer.total) return "WON";
  if (player.total < dealer.total) return "LOST";
  return "PUSH";
}

export function suggestedInsuranceResolution(dealerRanks: readonly string[]): InsuranceResolution | null {
  if (dealerRanks.length < 2) return null;
  const firstTwo = evaluateHand(dealerRanks.slice(0, 2), false);
  return firstTwo.naturalBlackjack ? "DEALER_BLACKJACK" : "NO_DEALER_BLACKJACK";
}
