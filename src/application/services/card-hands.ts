import { ConflictError, DomainError, ForbiddenError } from "@/domain/errors";
import { CARD_RANKS, evaluateHand, parseCardRank, suggestedBoxOutcome, suggestedInsuranceResolution } from "@/domain/blackjack/cards";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

const MAX_HAND_CARDS = 12;

export function ranksFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

export function handView(ranks: unknown, isSplitOffshoot = false, completedAt: Date | null = null) {
  const parsed = ranksFromJson(ranks);
  const evaluation = parsed.length ? evaluateHand(parsed, isSplitOffshoot) : null;
  return {
    ranks: parsed,
    complete: Boolean(completedAt) || Boolean(evaluation?.bust),
    label: evaluation?.label ?? "",
    total: evaluation?.total ?? 0,
    soft: evaluation?.soft ?? false,
    bust: evaluation?.bust ?? false,
    naturalBlackjack: evaluation?.naturalBlackjack ?? false,
  };
}

export async function mutateHand(
  tx: Tx,
  input: {
    actorId: string;
    table: {
      id: string;
      bankDealerId: string | null;
      currentPhase: string;
      currentRound: {
        id: string;
        dealerRanks: unknown;
        dealerCompletedAt: Date | null;
        boxes: {
          id: string;
          playerId: string;
          isSplitOffshoot: boolean;
          settledAt: Date | null;
          ranks: unknown;
          handCompletedAt: Date | null;
          removedAt: Date | null;
        }[];
      } | null;
    };
    boxId?: string;
    dealer?: boolean;
    action: "ADD" | "REMOVE" | "COMPLETE" | "REOPEN" | "CLEAR";
    rank?: string;
    index?: number;
  },
) {
  if (input.table.currentPhase !== "PLAYING") {
    throw new DomainError("CARDS_LOCKED", "Cards can only be entered during PLAYING.");
  }
  const round = input.table.currentRound;
  if (!round) throw new ConflictError("No open round.");
  const isBank = input.table.bankDealerId === input.actorId;
  if (input.dealer) {
    if (!isBank) throw new ForbiddenError("Only the Bank/Dealer can edit the Dealer hand.");
    const ranks = ranksFromJson(round.dealerRanks);
    const next = applyMutation(ranks, round.dealerCompletedAt, input, false);
    await tx.round.update({
      where: { id: round.id },
      data: { dealerRanks: next.ranks, dealerCompletedAt: next.completedAt },
    });
    return next;
  }
  const box = round.boxes.find((item) => item.id === input.boxId && !item.removedAt);
  if (!box) throw new DomainError("CHOOSE_BOX", "Choose a betting box first");
  if (box.settledAt) {
    throw new DomainError("CARDS_IMMUTABLE", "Settled cards cannot be changed.");
  }
  if (!isBank && box.playerId !== input.actorId) {
    throw new ForbiddenError("You can only edit your own box.");
  }
  if (input.action === "CLEAR" && !isBank) {
    throw new ForbiddenError("Only the Bank/Dealer can clear a hand.");
  }
  const ranks = ranksFromJson(box.ranks);
  const next = applyMutation(ranks, box.handCompletedAt, input, box.isSplitOffshoot);
  await tx.bettingBox.update({
    where: { id: box.id },
    data: { ranks: next.ranks, handCompletedAt: next.completedAt },
  });
  return next;
}

function applyMutation(
  ranks: string[],
  completedAt: Date | null,
  input: { action: "ADD" | "REMOVE" | "COMPLETE" | "REOPEN" | "CLEAR"; rank?: string; index?: number },
  isSplitOffshoot: boolean,
): { ranks: string[]; completedAt: Date | null } {
  if (input.action === "REOPEN") {
    return { ranks, completedAt: null };
  }
  if (input.action === "CLEAR") {
    return { ranks: [], completedAt: null };
  }
  if (input.action === "COMPLETE") {
    if (ranks.length === 0) {
      throw new DomainError("HAND_EMPTY", "Enter cards before marking the hand complete.");
    }
    return { ranks, completedAt: new Date() };
  }
  let next = [...ranks];
  if (input.action === "ADD") {
    if (!input.rank || !CARD_RANKS.includes(input.rank as (typeof CARD_RANKS)[number])) {
      parseCardRank(input.rank ?? "");
    }
    if (next.length >= MAX_HAND_CARDS) {
      throw new DomainError("HAND_FULL", "This hand cannot hold more cards.");
    }
    next.push(input.rank!);
  }
  if (input.action === "REMOVE") {
    const index = input.index ?? next.length - 1;
    if (index < 0 || index >= next.length) {
      throw new DomainError("CARD_MISSING", "That card is not on this hand.");
    }
    next.splice(index, 1);
  }
  const evaluation = next.length ? evaluateHand(next, isSplitOffshoot) : null;
  return {
    ranks: next,
    completedAt: evaluation?.bust ? new Date() : null,
  };
}

export { suggestedBoxOutcome, suggestedInsuranceResolution };
