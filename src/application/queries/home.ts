import { prisma } from "@/application/db";

export type HomeTableCard = {
  id: string;
  name: string;
  game: string;
  phase: string;
  playerCount: number;
  role: string;
  updatedAt: string;
  saved: boolean;
  closed: boolean;
};

const PHASE_RANK: Record<string, number> = {
  PLAYING: 0,
  PAYOUT: 1,
  BETTING: 2,
  ROUND_COMPLETE: 3,
  TABLE_SETUP: 4,
};

function roleLabel(isBankDealer: boolean, isOwner: boolean): string {
  if (isBankDealer) return "Bank / Dealer";
  if (isOwner) return "Owner";
  return "Player";
}

function gameLabel(game: string): string {
  if (game === "BLACKJACK") return "Blackjack";
  if (game === "POKER") return "Poker";
  if (game === "ZILCH") return "Zilch";
  return game;
}

export async function listHomeTables(userId: string): Promise<HomeTableCard[]> {
  const memberships = await prisma.tableMember.findMany({
    where: { userId, leftAt: null },
    include: {
      table: {
        include: {
          members: { where: { leftAt: null }, select: { id: true } },
        },
      },
    },
  });

  return memberships
    .map((membership) => ({
      id: membership.table.id,
      name: membership.table.name,
      game: gameLabel(membership.table.game),
      phase: membership.table.status === "ARCHIVED" ? "CLOSED" : membership.table.pausedAt ? "SAVED" : membership.table.currentPhase,
      playerCount: membership.table.members.length,
      role: roleLabel(membership.table.bankDealerId === userId, membership.table.ownerId === userId),
      updatedAt: membership.table.updatedAt.toISOString(),
      saved: membership.table.pausedAt !== null && membership.table.status !== "ARCHIVED",
      closed: membership.table.status === "ARCHIVED",
    }))
    .sort((a, b) => {
      const rank = (PHASE_RANK[a.phase] ?? 9) - (PHASE_RANK[b.phase] ?? 9);
      if (rank !== 0) return rank;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}
