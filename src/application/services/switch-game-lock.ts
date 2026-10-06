import { prisma } from "@/application/db";
import { roundHasLockedStake } from "@/application/services/bankroll";

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
  return Boolean(
    table.currentPokerHand?.participants.some((item) => item.lockedMillis > 0n) &&
      table.currentPokerHand.phase !== "HAND_COMPLETE",
  );
}
