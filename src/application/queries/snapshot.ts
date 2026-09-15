import { prisma } from "@/application/db";
import {
  insuranceMaxMillis,
  ordinaryReturnMillis,
  type BoxOutcome,
} from "@/domain/blackjack/payouts";
import { formatJetons } from "@/domain/money";
import { ForbiddenError, NotFoundError } from "@/domain/errors";
import { GAME_CATALOG } from "@/domain/games";
import { publicOrigin } from "@/application/auth-urls";
import { ensureBettingClosedIfDue } from "@/application/services/blackjack-round";
import type {
  BankTableView,
  BoxView,
  ClientSnapshot,
  MoneyView,
  PlayerTableView,
  SetupTableView,
  WaitingTableView,
} from "./views";
import { PLAYER_COPY, playerTitleForPhase } from "./player-copy";

function money(millis: bigint | null | undefined): MoneyView {
  const value = millis ?? 0n;
  return { millis: value.toString(), label: formatJetons(value) };
}

function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email.split("@")[0] || "Player";
}

const BANK_COPY: Record<string, [string, string]> = {
  BETTING: ["Players are betting", "Add players or distribute jetons while bets are open"],
  PLAYING: ["Cards are in play", "Every active box remains visible"],
  PAYOUT: ["Settle every box", "Tap Won, Push, Lost or Blackjack for each box"],
  ROUND_COMPLETE: ["Round complete", "Start the next hand when you are ready"],
};

function payoutActions(
  stake: bigint,
  rule: "THREE_TWO" | "SIX_FIVE",
): BoxView["payoutActions"] {
  const outcomes: BoxOutcome[] = ["WON", "PUSH", "LOST", "BLACKJACK"];
  const names: Record<BoxOutcome, string> = {
    WON: "Won",
    PUSH: "Push",
    LOST: "Lost",
    BLACKJACK: "Blackjack",
  };
  return outcomes.map((outcome) => ({
    outcome,
    label: `${names[outcome]} · return ${formatJetons(ordinaryReturnMillis(stake, outcome, rule))}`,
  }));
}

function boxLabelForPlayer(box: { displayLabel: string; boxNumber: number; isSplitOffshoot: boolean }): string {
  if (box.isSplitOffshoot) return box.displayLabel;
  return `YOUR BOX ${box.boxNumber}`;
}

export async function loadSnapshot(tableId: string, viewerId: string): Promise<ClientSnapshot> {
  await ensureBettingClosedIfDue(tableId);
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      owner: true,
      bankDealer: true,
      members: { where: { leftAt: null }, include: { user: true } },
      invitations: { orderBy: { createdAt: "desc" } },
      currentRound: {
        include: {
          boxes: { where: { removedAt: null }, orderBy: { boxNumber: "asc" } },
          insuranceBets: true,
        },
      },
    },
  });
  if (!table) throw new NotFoundError("Table not found.");
  const viewer = table.members.find((member) => member.userId === viewerId);
  if (!viewer) throw new ForbiddenError("You are not a member of this table.");

  const isBank = table.bankDealerId === viewerId;
  const isOwner = table.ownerId === viewerId;
  const origin = publicOrigin();
  const qr = table.invitations.find((invite) => invite.kind === "QR" && !invite.revokedAt);
  const joinUrl = isOwner || isBank ? (qr ? `${origin}/join/${qr.token}` : null) : null;

  const boxes: BoxView[] = (table.currentRound?.boxes ?? []).map((box) => {
    const player = table.members.find((member) => member.userId === box.playerId)?.user;
    const insurance = table.currentRound?.insuranceBets.find((bet) => bet.boxId === box.id);
    return {
      id: box.id,
      playerId: box.playerId,
      playerName: player ? displayName(player) : "Player",
      label: isBank ? `${player ? displayName(player).toUpperCase() : "PLAYER"} · BOX ${box.boxNumber}` : boxLabelForPlayer(box),
      boxNumber: box.boxNumber,
      bet: money(box.lockedBetMillis || box.originalStakeMillis),
      originalStake: money(box.originalStakeMillis),
      isDoubled: box.isDoubled,
      isSplit: box.isSplitOffshoot,
      insurance: insurance ? money(insurance.amountMillis) : null,
      insuranceMax: money(insuranceMaxMillis(box.originalStakeMillis || box.lockedBetMillis)),
      insuranceResult: insurance?.settledAt
        ? insurance.resolution === "DEALER_BLACKJACK"
          ? `Insurance · return ${formatJetons(insurance.returnedMillis ?? 0n)}`
          : "Insurance lost"
        : null,
      outcome: box.outcome,
      returned: box.returnedMillis !== null ? money(box.returnedMillis) : null,
      payoutActions: payoutActions(box.lockedBetMillis, table.blackjackPayout),
    };
  });

  const setup: SetupTableView | null =
    table.currentPhase === "TABLE_SETUP" && (isOwner || isBank)
      ? {
          role: "SETUP",
          phase: "TABLE_SETUP",
          tableName: table.name,
          game: "Blackjack",
          gameOptions: GAME_CATALOG.map((game) => ({
            id: game.id,
            label: game.comingLater ? `${game.label} · ${game.comingLater}` : game.label,
            available: game.available,
          })),
          ownerName: displayName(table.owner),
          bankName: table.bankDealer ? displayName(table.bankDealer) : "Unassigned",
          startingJetonsPerPlayer: money(table.startingJetonsPerPlayerMillis),
          seats: [
            ...table.members
              .filter((member) => member.isBankDealer || member.userId === table.bankDealerId)
              .map((member) => ({
                id: member.userId,
                name: displayName(member.user),
                status: "Bank / Dealer" as const,
              })),
            ...table.members
              .filter((member) => !member.isBankDealer && member.userId !== table.bankDealerId)
              .map((member) => ({
                id: member.userId,
                name: displayName(member.user),
                status: member.startingJetonsCredited && member.availableMillis > 0n ? ("Ready" as const) : ("Joined" as const),
              })),
            ...table.invitations
              .filter(
                (invite) =>
                  invite.kind === "EMAIL" &&
                  !invite.usedAt &&
                  !invite.revokedAt &&
                  !table.members.some((member) => member.user.email.toLowerCase() === (invite.email ?? "").toLowerCase()),
              )
              .map((invite) => ({
                id: invite.id,
                name: invite.email ?? "Player",
                status: "Invited" as const,
              })),
          ],
          members: table.members.map((member) => ({
            userId: member.userId,
            name: displayName(member.user),
            email: member.user.email,
            isOwner: member.isOwner,
            isBankDealer: member.isBankDealer,
            available: money(member.availableMillis),
          })),
          invitations: table.invitations
            .filter((invite) => invite.kind === "EMAIL")
            .map((invite) => ({
              id: invite.id,
              kind: invite.kind,
              email: invite.email,
              pending: !invite.usedAt && !invite.revokedAt,
            })),
          joinUrl,
          minBet: table.minBetMillis !== null ? money(table.minBetMillis) : null,
          maxBet: table.maxBetMillis !== null ? money(table.maxBetMillis) : null,
          blackjackPayout: table.blackjackPayout,
          maxBoxesPerPlayer: table.maxBoxesPerPlayer,
          insuranceEnabled: table.insuranceEnabled,
          bankMayDistributeJetons: table.bankMayDistributeJetons,
          canStartBetting: Boolean(table.bankDealerId) && table.members.some((member) => member.userId !== table.bankDealerId),
          startBlockedReason: !table.bankDealerId
            ? "Assign a Bank/Dealer"
              : !table.members.some((member) => member.userId !== table.bankDealerId)
                ? "Waiting for a player to join"
                : null,
          isOwner,
          setupCompleted: table.setupCompletedAt !== null,
        }
      : null;

  const waiting: WaitingTableView | null =
    table.currentPhase === "TABLE_SETUP" && !isBank && !isOwner
      ? {
          role: "WAITING",
          phase: "TABLE_SETUP",
          tableName: table.name,
          game: "Blackjack",
          available: money(viewer.availableMillis),
          copy: "Waiting for the Bank to open betting",
        }
      : isOwner && table.currentPhase === "TABLE_SETUP"
        ? null
        : table.currentPhase === "TABLE_SETUP" && isBank
          ? null
          : null;

  const ownBoxes = boxes.filter((box) => box.playerId === viewerId);
  const insuranceOpen = table.currentRound?.insuranceWindow === "OPEN";
  const unresolvedInsurance =
    (table.currentRound?.insuranceBets.length ?? 0) > 0 && table.currentRound?.insuranceWindow !== "SETTLED";
  const canNextHand = table.currentPhase === "ROUND_COMPLETE";

  const player: PlayerTableView | null =
    !isBank && table.currentPhase !== "TABLE_SETUP"
      ? {
          role: "PLAYER",
          phase: table.currentPhase,
          tableName: table.name,
          title: playerTitleForPhase(table.currentPhase, ownBoxes),
          copy: PLAYER_COPY[table.currentPhase]?.[1] ?? "",
          available: money(viewer.availableMillis),
          boxes: ownBoxes,
          insuranceWindowOpen: insuranceOpen,
          bettingCloseDeadlineAt: table.currentRound?.bettingCloseDeadlineAt?.toISOString() ?? null,
          actions: {
            bet: table.currentPhase === "BETTING",
            retract: table.currentPhase === "BETTING",
            addBox:
              table.currentPhase === "BETTING" &&
              ownBoxes.filter((box) => !box.isSplit).length < table.maxBoxesPerPlayer,
            removeEmptyBox: table.currentPhase === "BETTING",
            double: table.currentPhase === "PLAYING",
            split: table.currentPhase === "PLAYING",
            insurance: table.currentPhase === "PLAYING" && insuranceOpen && table.insuranceEnabled,
          },
        }
      : table.currentPhase === "TABLE_SETUP" && !isOwner && !isBank
        ? null
        : null;

  const lockedOrdinary = boxes.reduce((sum, box) => sum + BigInt(box.bet.millis), 0n);
  const insuranceTotal =
    table.currentRound?.insuranceBets.reduce((sum, bet) => sum + bet.amountMillis, 0n) ?? 0n;

  const hasValidBet = boxes.some((box) => BigInt(box.bet.millis) > 0n);
  const deadline = table.currentRound?.bettingCloseDeadlineAt?.toISOString() ?? null;
  const countdownActive = Boolean(
    table.currentPhase === "BETTING" &&
      table.currentRound?.bettingCloseDeadlineAt &&
      table.currentRound.bettingCloseDeadlineAt.getTime() > Date.now(),
  );

  const bank: BankTableView | null = isBank && table.currentPhase !== "TABLE_SETUP"
    ? {
        role: "BANK",
        phase: table.currentPhase,
        tableName: table.name,
        title: BANK_COPY[table.currentPhase]?.[0] ?? "Bank",
        copy: BANK_COPY[table.currentPhase]?.[1] ?? "",
        phaseLabel: table.currentPhase.replace("_", " "),
        primaryAction:
          table.currentPhase === "BETTING"
            ? { id: "dealCards", label: "DEAL CARDS NOW", enabled: hasValidBet }
            : table.currentPhase === "PLAYING"
              ? { id: "payoutPhase", label: "Payout phase", enabled: true }
              : table.currentPhase === "PAYOUT"
                ? { id: "nextHand", label: "Start next hand", enabled: false }
                : { id: "nextHand", label: "Start next hand", enabled: canNextHand },
        boxes,
        playerCount: new Set(boxes.map((box) => box.playerId)).size,
        boxCount: boxes.length,
        lockedOrdinary: money(lockedOrdinary),
        insurance: {
          window: table.currentRound?.insuranceWindow ?? "CLOSED",
          total: money(insuranceTotal),
          count: table.currentRound?.insuranceBets.length ?? 0,
          resolution: table.currentRound?.insuranceResolution ?? null,
        },
        actions: {
          dealCards: table.currentPhase === "BETTING" && hasValidBet,
          scheduleDeal: table.currentPhase === "BETTING" && hasValidBet && !countdownActive,
          payoutPhase: table.currentPhase === "PLAYING",
          nextHand: canNextHand,
          openInsurance:
            table.currentPhase === "PLAYING" &&
            table.insuranceEnabled &&
            table.currentRound?.insuranceWindow !== "OPEN" &&
            table.currentRound?.insuranceWindow !== "SETTLED",
          closeInsurance: table.currentPhase === "PLAYING" && insuranceOpen,
          settleBoxes: table.currentPhase === "PAYOUT",
          settleInsurance: table.currentPhase === "PAYOUT" && unresolvedInsurance,
          addPlayer: table.currentPhase === "BETTING",
          giveJetons: table.currentPhase === "BETTING" && table.bankMayDistributeJetons,
          changeBank: table.currentPhase === "BETTING" && isOwner,
        },
        insuranceSettleActions: [
          { id: "DEALER_BLACKJACK", label: "Dealer Blackjack" },
          { id: "NO_DEALER_BLACKJACK", label: "No Blackjack" },
        ],
        bettingCloseDeadlineAt: deadline,
        hasValidBet,
      }
    : null;

  if (isBank && table.currentPhase === "ROUND_COMPLETE" && bank) {
    bank.primaryAction = { id: "nextHand", label: "Start next hand", enabled: true };
  }

  return {
    tableId: table.id,
    viewerId,
    viewerName: displayName(viewer.user),
    isOwner,
    isBank,
    phase: table.currentPhase,
    members: table.members.map((member) => ({
      userId: member.userId,
      name: displayName(member.user),
      email: isOwner || isBank ? member.user.email : "",
      isOwner: member.isOwner,
      isBankDealer: member.isBankDealer,
      available: isOwner || isBank || member.userId === viewerId ? money(member.availableMillis) : null,
    })),
    setup,
    waiting: waiting ?? (table.currentPhase === "TABLE_SETUP" && !isOwner && !isBank
      ? {
          role: "WAITING",
          phase: "TABLE_SETUP",
          tableName: table.name,
          game: "Blackjack",
          available: money(viewer.availableMillis),
          copy: "Waiting for the Bank to open betting",
        }
      : null),
    player,
    bank,
  };
}

export function assertPlayerPrivacy(snapshot: ClientSnapshot): void {
  if (!snapshot.player) return;
  for (const box of snapshot.player.boxes) {
    if (box.playerId !== snapshot.viewerId) {
      throw new Error("Player snapshot leaked another player's box.");
    }
  }
}
