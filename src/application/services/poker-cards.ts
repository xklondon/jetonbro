import { prisma } from "@/application/db";
import { withIdempotency } from "@/application/idempotency";
import { publishTable } from "@/application/realtime/bus";
import { ForbiddenError, NotFoundError, PhaseConflictError } from "@/domain/errors";
import { assertCommunityCards, assertHoleCards, parsePokerCards } from "@/domain/poker/cards";
import { pokerHandIsOpen } from "@/domain/tables/active-game";

function holeAssistPhases(phase: string | null | undefined): boolean {
  if (!phase) return true; // POKER_SETUP before first hand
  return (
    phase === "POKER_SETUP" ||
    phase === "HAND_COMPLETE" ||
    pokerHandIsOpen(phase)
  );
}

export async function setPokerCommunityCards(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  cards: unknown;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "setPokerCommunityCards", input.tableId, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await tx.table.findUnique({
        where: { id: input.tableId },
        include: { currentPokerHand: true },
      });
      if (!table) throw new NotFoundError("Table not found.");
      if (table.ownerId !== input.actorId) throw new ForbiddenError("Only the table owner can enter community cards.");
      if (table.game !== "POKER" || !table.currentPokerHand) {
        throw new PhaseConflictError("Enter community cards", "none", "an active Hold’em street");
      }
      const cards = parsePokerCards(input.cards);
      assertCommunityCards(table.currentPokerHand.phase, cards);
      await tx.pokerHand.update({
        where: { id: table.currentPokerHand.id },
        data: { communityCards: cards },
      });
      await tx.table.update({ where: { id: table.id }, data: { updatedAt: new Date() } });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}

export async function setPokerHoleCards(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  cards: unknown;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "setPokerHoleCards", input.tableId, async () => {
    await prisma.$transaction(async (tx) => {
      const table = await tx.table.findUnique({
        where: { id: input.tableId },
        include: {
          currentPokerHand: { include: { participants: true } },
          pokerSeats: true,
        },
      });
      if (!table) throw new NotFoundError("Table not found.");
      if (table.game !== "POKER") {
        throw new PhaseConflictError("Enter hole cards", "none", "Poker");
      }
      const phase = table.currentPokerHand?.phase ?? "POKER_SETUP";
      if (!holeAssistPhases(phase) || table.status === "ARCHIVED") {
        throw new PhaseConflictError("Enter hole cards", phase, "an eligible Hold’em stage");
      }
      const seat = table.pokerSeats.find((item) => item.playerId === input.actorId);
      if (!seat) throw new ForbiddenError("Only seated Players can enter hole cards.");
      const cards = parsePokerCards(input.cards);
      assertHoleCards(cards);
      const participant = table.currentPokerHand?.participants.find((item) => item.playerId === input.actorId);
      if (participant && pokerHandIsOpen(phase)) {
        await tx.pokerParticipant.update({
          where: { id: participant.id },
          data: { holeCards: cards },
        });
      } else if (participant && phase === "HAND_COMPLETE") {
        await tx.pokerParticipant.update({
          where: { id: participant.id },
          data: { holeCards: cards },
        });
      }
      await tx.pokerSeat.update({
        where: { id: seat.id },
        data: { assistCards: cards },
      });
      await tx.table.update({ where: { id: table.id }, data: { updatedAt: new Date() } });
    });
    publishTable(input.tableId);
    return { ok: true };
  });
}
