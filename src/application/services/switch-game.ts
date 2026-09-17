import { prisma } from "@/application/db";
import { withIdempotency } from "@/application/idempotency";
import { publishTable } from "@/application/realtime/bus";
import { roundHasLockedStake } from "@/application/services/bankroll";
import { assertCanSwitchGame, SWITCH_BLOCKED } from "@/domain/tables/switch-game";
import { isPlayableGame } from "@/domain/games";
import { DomainError, NotFoundError } from "@/domain/errors";
import { parseWholeJetons } from "@/domain/money";

export async function switchGame(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  game: string;
  smallBlind?: string;
  bigBlind?: string;
  seatOrder?: string[];
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "switchGame", input, async () => {
    if (input.game === "ZILCH" || !isPlayableGame(input.game)) {
      throw new DomainError("GAME_UNAVAILABLE", "That game is coming later.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${input.tableId} FOR UPDATE`;
      const table = await tx.table.findUnique({
        where: { id: input.tableId },
        include: {
          members: { where: { leftAt: null } },
          currentRound: { include: { boxes: true, insuranceBets: true } },
          currentPokerHand: { include: { participants: true } },
          pokerSeats: true,
        },
      });
      if (!table) throw new NotFoundError("Table not found.");
      if (table.status === "ARCHIVED") throw new DomainError("TABLE_CLOSED", "This table is closed.");
      const hasLockedBlackjack = roundHasLockedStake(table.currentRound);
      const hasLockedPoker = (table.currentPokerHand?.participants.some((item) => item.lockedMillis > 0n) ?? false) &&
        table.currentPokerHand?.phase !== "HAND_COMPLETE";
      assertCanSwitchGame({
        isOwner: table.ownerId === input.actorId,
        game: table.game,
        blackjackPhase: table.currentPhase,
        pokerPhase: table.currentPokerHand?.phase ?? (table.game === "POKER" ? "POKER_SETUP" : null),
        hasLockedBlackjack,
        hasBankExposure: table.bankLockedExposureMillis > 0n,
        hasLockedPoker,
      });
      if (input.game === table.game && input.game === "BLACKJACK") return;
      if (input.game === "POKER") {
        await tx.pokerSeat.deleteMany({ where: { tableId: table.id } });
        const order = input.seatOrder?.filter((id) => table.members.some((member) => member.userId === id)) ??
          table.members.map((member) => member.userId);
        for (const [index, playerId] of order.entries()) {
          await tx.pokerSeat.create({ data: { tableId: table.id, playerId, orderIndex: index } });
        }
        const small = input.smallBlind ? parseWholeJetons(input.smallBlind, "Small blind") : table.pokerSmallBlindMillis;
        const big = input.bigBlind ? parseWholeJetons(input.bigBlind, "Big blind") : table.pokerBigBlindMillis;
        if (small <= 0n || big <= 0n || small > big) {
          throw new DomainError("INVALID_AMOUNT", "Big blind must be greater than small blind.");
        }
        await tx.table.update({
          where: { id: table.id },
          data: {
            game: "POKER",
            currentPokerHandId: null,
            pokerSmallBlindMillis: small,
            pokerBigBlindMillis: big,
            updatedAt: new Date(),
          },
        });
        return;
      }
      await tx.table.update({
        where: { id: table.id },
        data: {
          game: "BLACKJACK",
          currentPokerHandId: null,
          updatedAt: new Date(),
        },
      });
    });
    publishTable(input.tableId);
    return { ok: true, game: input.game, blocked: SWITCH_BLOCKED };
  });
}

export async function tableHasLockedValue(tableId: string): Promise<boolean> {
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      currentRound: { include: { boxes: true, insuranceBets: true } },
      currentPokerHand: { include: { participants: true } },
    },
  });
  if (!table) return false;
  if (table.bankLockedExposureMillis > 0n) return true;
  if (roundHasLockedStake(table.currentRound)) return true;
  return Boolean(table.currentPokerHand?.participants.some((item) => item.lockedMillis > 0n) && table.currentPokerHand.phase !== "HAND_COMPLETE");
}
