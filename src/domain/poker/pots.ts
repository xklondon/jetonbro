import type { JetonMillis } from "../money";
import { playersLeftOfDealer, type PokerSeat } from "./seats";

export type PotContribution = {
  playerId: string;
  total: JetonMillis;
  folded: boolean;
  /** True when the player is all-in; required for genuine side-pot layers. */
  allIn?: boolean;
};

export type BuiltPot = {
  index: number;
  capMillis: JetonMillis;
  amountMillis: JetonMillis;
  eligiblePlayerIds: string[];
};

/**
 * Side pots exist only when an all-in player is covered by a larger contribution.
 * Unequal totals from normal betting / blinds / folds alone stay one MAIN pot.
 */
export function hasGenuineSidePot(contributions: PotContribution[]): boolean {
  const allIns = contributions.filter((item) => item.allIn);
  if (allIns.length === 0) return false;
  return allIns.some((allIn) => contributions.some((item) => item.total > allIn.total));
}

function buildContributionLayers(contributions: PotContribution[]): BuiltPot[] {
  const positive = contributions.filter((item) => item.total > 0n);
  if (positive.length === 0) return [];
  const caps = [...new Set(positive.map((item) => item.total))].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  const pots: BuiltPot[] = [];
  let previous = 0n;
  for (const cap of caps) {
    const layer = cap - previous;
    const inLayer = positive.filter((item) => item.total >= cap);
    if (inLayer.length === 0 || layer <= 0n) {
      previous = cap;
      continue;
    }
    const eligible = inLayer.filter((item) => !item.folded).map((item) => item.playerId);
    pots.push({
      index: pots.length,
      capMillis: cap,
      amountMillis: layer * BigInt(inLayer.length),
      eligiblePlayerIds: eligible,
    });
    previous = cap;
  }
  return pots.filter((pot) => pot.amountMillis > 0n);
}

function buildSingleMainPot(contributions: PotContribution[]): BuiltPot[] {
  const amount = contributions.reduce((sum, item) => sum + item.total, 0n);
  if (amount <= 0n) return [];
  const eligible = contributions.filter((item) => !item.folded).map((item) => item.playerId);
  const cap = contributions.reduce((max, item) => (item.total > max ? item.total : max), 0n);
  return [
    {
      index: 0,
      capMillis: cap,
      amountMillis: amount,
      eligiblePlayerIds: eligible,
    },
  ];
}

export function buildSidePots(contributions: PotContribution[]): BuiltPot[] {
  if (!hasGenuineSidePot(contributions)) {
    return buildSingleMainPot(contributions);
  }
  return buildContributionLayers(contributions);
}

export function splitPotEqually(
  amount: JetonMillis,
  winnerIds: string[],
  dealerPlayerId: string,
  seats: PokerSeat[],
): Map<string, JetonMillis> {
  const awards = new Map<string, JetonMillis>();
  if (winnerIds.length === 0 || amount <= 0n) return awards;
  const unique = [...new Set(winnerIds)];
  const share = amount / BigInt(unique.length);
  const remainder = amount % BigInt(unique.length);
  for (const id of unique) awards.set(id, share);
  if (remainder === 0n) return awards;
  const left = playersLeftOfDealer(seats, dealerPlayerId).filter((id) => unique.includes(id));
  const order = left.length > 0 ? left : unique;
  for (let i = 0; i < Number(remainder); i += 1) {
    const id = order[i % order.length]!;
    awards.set(id, (awards.get(id) ?? 0n) + 1n);
  }
  return awards;
}

export function uncalledReturn(contributions: PotContribution[]): { playerId: string; amount: JetonMillis } | null {
  const live = contributions.filter((item) => !item.folded && item.total > 0n);
  if (live.length !== 1) return null;
  const winner = live[0]!;
  const othersMax = contributions
    .filter((item) => item.playerId !== winner.playerId)
    .reduce((max, item) => (item.total > max ? item.total : max), 0n);
  const extra = winner.total - othersMax;
  if (extra <= 0n) return null;
  return { playerId: winner.playerId, amount: extra };
}
