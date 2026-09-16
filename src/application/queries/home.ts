import { prisma } from "@/application/db";
import { formatJetons } from "@/domain/money";

export type HomeMoney = {
  millis: string;
  label: string;
};

export type HomePlayerLine = {
  userId: string;
  name: string;
  available: HomeMoney | null;
  locked: HomeMoney | null;
  isBankDealer: boolean;
};

export type HomeClosePreview = {
  kind: "delete-draft" | "archive";
  confirmation: string;
  players: { name: string; available: string; locked: string }[];
};

export type HomeTableCard = {
  id: string;
  name: string;
  game: string;
  phase: string;
  playerCount: number;
  boxCount: number;
  bankName: string;
  role: string;
  updatedAt: string;
  saved: boolean;
  closed: boolean;
  isOwner: boolean;
  players: HomePlayerLine[];
  canSave: boolean;
  canClose: boolean;
  canDeleteDraft: boolean;
  closeBlockedReason: string | null;
  closePreview: HomeClosePreview | null;
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

function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email.split("@")[0] || "Player";
}

function money(millis: bigint): HomeMoney {
  return { millis: millis.toString(), label: formatJetons(millis) };
}

export async function listHomeTables(userId: string): Promise<HomeTableCard[]> {
  const memberships = await prisma.tableMember.findMany({
    where: { userId, leftAt: null, table: { status: { not: "ARCHIVED" } } },
    include: {
      table: {
        include: {
          bankDealer: { select: { name: true, email: true } },
          members: { where: { leftAt: null }, include: { user: { select: { name: true, email: true } } } },
          currentRound: { include: { boxes: true, insuranceBets: true } },
          rounds: { select: { boxes: { select: { lockedBetMillis: true, originalStakeMillis: true } } } },
          _count: { select: { ledgerEntries: true } },
        },
      },
    },
  });

  const cards = memberships.map((membership) => {
      const table = membership.table;
      const isOwner = table.ownerId === userId;
      const isBank = table.bankDealerId === userId;
      const playerMembers = table.members.filter(
        (member) => !member.isBankDealer && member.userId !== table.bankDealerId,
      );
      const boxes = (table.currentRound?.boxes ?? []).filter((box) => !box.removedAt);
      const lockedByPlayer = new Map<string, bigint>();
      for (const box of boxes) {
        lockedByPlayer.set(box.playerId, (lockedByPlayer.get(box.playerId) ?? 0n) + box.lockedBetMillis);
      }
      for (const bet of table.currentRound?.insuranceBets ?? []) {
        if (bet.settledKey) continue;
        lockedByPlayer.set(bet.playerId, (lockedByPlayer.get(bet.playerId) ?? 0n) + bet.amountMillis);
      }
      const anyLocked = [...lockedByPlayer.values()].some((value) => value > 0n);
      const emptyDraft =
        table.currentPhase === "TABLE_SETUP" &&
        playerMembers.length === 0 &&
        table._count.ledgerEntries === 0 &&
        !table.rounds.some((round) =>
          round.boxes.some((box) => box.lockedBetMillis > 0n || box.originalStakeMillis > 0n),
        );
      const canClose =
        isOwner &&
        !anyLocked &&
        (table.currentPhase === "TABLE_SETUP" || table.currentPhase === "ROUND_COMPLETE");
      const players: HomePlayerLine[] = playerMembers.map((member) => {
        const showBalance = isOwner || member.userId === userId;
        return {
          userId: member.userId,
          name: displayName(member.user),
          available: showBalance ? money(member.availableMillis) : null,
          locked: isOwner ? money(lockedByPlayer.get(member.userId) ?? 0n) : null,
          isBankDealer: false,
        };
      });
      const closePreview: HomeClosePreview | null = isOwner
        ? {
            kind: emptyDraft ? "delete-draft" : "archive",
            confirmation: emptyDraft
              ? "Permanently delete this unused draft? Invitations and join codes will be removed. There are no Player balances to save."
              : "Save each Player’s remaining jetons to their personal ledger, archive this table, and remove it from Open Tables? Round and ledger history is kept.",
            players: playerMembers.map((member) => ({
              name: displayName(member.user),
              available: formatJetons(member.availableMillis),
              locked: formatJetons(lockedByPlayer.get(member.userId) ?? 0n),
            })),
          }
        : null;

      return {
        id: table.id,
        name: table.name,
        game: gameLabel(table.game),
        phase: table.pausedAt ? "SAVED" : table.currentPhase,
        playerCount: playerMembers.length,
        boxCount: boxes.length,
        bankName: table.bankDealer ? displayName(table.bankDealer) : "Unassigned",
        role: roleLabel(isBank, isOwner),
        updatedAt: table.updatedAt.toISOString(),
        saved: table.pausedAt !== null,
        closed: false,
        isOwner,
        players,
        canSave: isOwner && !emptyDraft,
        canClose,
        canDeleteDraft: isOwner && emptyDraft,
        closeBlockedReason: isOwner
          ? anyLocked
            ? "This table still has locked bets or Insurance. Settle every locked position before closing."
            : table.currentPhase !== "TABLE_SETUP" && table.currentPhase !== "ROUND_COMPLETE"
              ? "Close the table only during TABLE SETUP or after the round is complete."
              : null
          : null,
        closePreview,
      };
    });

  return cards.sort((a, b) => {
    const rank = (PHASE_RANK[a.phase] ?? 9) - (PHASE_RANK[b.phase] ?? 9);
    if (rank !== 0) return rank;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
