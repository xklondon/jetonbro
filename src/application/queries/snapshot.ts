import { prisma } from "@/application/db";
import { insuranceMaxMillis, suggestedPayouts } from "@/domain/blackjack/payouts";
import { formatJetons } from "@/domain/money";
import { ForbiddenError, NotFoundError } from "@/domain/errors";
import { GAME_CATALOG } from "@/domain/games";
import { publicOrigin } from "@/application/auth-urls";
import { guestJoinUrl, verifiedJoinUrl } from "@/application/invite-urls";
import { isEmailDeliveryConfigured } from "@/application/mail";
import { alignTablePhase, ensureBettingClosedIfDue, ensureNextRoundIfDue } from "@/application/services/blackjack-round";
import { ensureNextPokerHandIfDue } from "@/application/services/poker-hand";
import { buildPokerView } from "./poker-snapshot";
import { boxCoverageOk, FUNDING_LOCKED, insuranceCoverageOk, roundHasLockedStake } from "@/application/services/bankroll";
import { handView, ranksFromJson, suggestedBoxOutcome, suggestedInsuranceResolution } from "@/application/services/card-hands";
import { pokerHandIsOpen, projectActiveGame } from "@/domain/tables/active-game";
import { stakeExample, stakeFromSession } from "@/domain/stakes";
import type {
  BankPlayerGroupView,
  BankTableView,
  BoxView,
  ClientSnapshot,
  CloseTablePreview,
  GameSessionView,
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
  PAYOUT: ["Settle every box", "Win, Push, Lose or Blackjack for each box"],
  ROUND_COMPLETE: ["Round complete", "Start the next round when every position is settled"],
};

function payoutActions(
  stake: bigint,
  rule: "THREE_TWO" | "SIX_FIVE",
): BoxView["payoutActions"] {
  return suggestedPayouts(stake, rule).map((item) => ({
    outcome: item.outcome,
    label: item.buttonLabel,
    title: item.railTitle,
    returnLine: item.railReturn,
    swipeLabel: item.swipeLabel,
  }));
}

function boxLabelForPlayer(box: { displayLabel: string; boxNumber: number; isSplitOffshoot: boolean }): string {
  if (box.isSplitOffshoot) return box.displayLabel;
  return `YOUR BOX ${box.boxNumber}`;
}

export async function loadSnapshot(tableId: string, viewerId: string): Promise<ClientSnapshot> {
  await alignTablePhase(tableId);
  await ensureBettingClosedIfDue(tableId);
  await ensureNextRoundIfDue(tableId);
  await ensureNextPokerHandIfDue(tableId);
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      owner: true,
      bankDealer: true,
      members: { where: { leftAt: null }, include: { user: true } },
      invitations: { orderBy: { createdAt: "desc" } },
      currentPokerHand: {
        include: {
          participants: { include: { player: true } },
          pots: { orderBy: { index: "asc" } },
          actions: { orderBy: { sequence: "asc" } },
        },
      },
      pokerSeats: { orderBy: { orderIndex: "asc" } },
      _count: { select: { pokerHands: true } },
      currentRound: {
        include: {
          boxes: { where: { removedAt: null }, orderBy: { boxNumber: "asc" } },
          insuranceBets: true,
        },
      },
      currentGameSession: { include: { participants: true } },
    },
  });
  if (!table) throw new NotFoundError("Table not found.");
  const viewer = table.members.find((member) => member.userId === viewerId);
  if (!viewer) throw new ForbiddenError("You are not a member of this table.");

  const isBank = table.bankDealerId === viewerId;
  const isOwner = table.ownerId === viewerId;
  const isSeatedPlayer = viewer.userId !== table.bankDealerId && !viewer.isBankDealer;
  const isGuest = Boolean(viewer.user.isGuest);
  const origin = publicOrigin();
  const qr = table.invitations.find((invite) => invite.kind === "QR" && !invite.revokedAt);
  const guestInvite = table.invitations.find((invite) => invite.kind === "GUEST" && !invite.revokedAt);
  const verifiedUrl = isOwner || isBank ? (qr ? verifiedJoinUrl(origin, qr.token) : null) : null;
  const guestUrl = isOwner || isBank ? (guestInvite ? guestJoinUrl(origin, guestInvite.token) : null) : null;
  const joinUrl = verifiedUrl;
  const hasReadyPlayer = table.members.some(
    (member) => member.userId !== table.bankDealerId && !member.isBankDealer,
  );

  const dealerRanks = ranksFromJson(table.currentRound?.dealerRanks);
  const dealerHand = handView(table.currentRound?.dealerRanks, false, table.currentRound?.dealerCompletedAt ?? null);
  const insuranceSuggestion = suggestedInsuranceResolution(dealerRanks);

  const boxes: BoxView[] = (table.currentRound?.boxes ?? []).map((box) => {
    const player = table.members.find((member) => member.userId === box.playerId)?.user;
    const insurance = table.currentRound?.insuranceBets.find((bet) => bet.boxId === box.id);
    const playerHand = handView(box.ranks, box.isSplitOffshoot, box.handCompletedAt);
    const showHand = isBank || box.playerId === viewerId;
    const bothComplete = playerHand.complete && dealerHand.complete;
    const suggested = bothComplete
      ? suggestedBoxOutcome(playerHand.ranks, dealerRanks, box.isSplitOffshoot)
      : null;
    const nextBet = (box.lockedBetMillis || 0n) + 5000n;
    return {
      id: box.id,
      playerId: box.playerId,
      playerName: player ? displayName(player) : "Player",
      label: isBank
        ? box.isSplitOffshoot
          ? box.displayLabel
          : `Box ${box.boxNumber}`
        : boxLabelForPlayer(box),
      boxNumber: box.boxNumber,
      bet: money(box.outcome ? box.originalStakeMillis : box.lockedBetMillis || box.originalStakeMillis),
      originalStake: money(box.originalStakeMillis),
      isDoubled: box.isDoubled,
      isSplit: box.isSplitOffshoot,
      insurance: insurance ? money(insurance.amountMillis) : null,
      insuranceMax: money(insuranceMaxMillis(box.originalStakeMillis || box.lockedBetMillis)),
      insuranceResult: insurance?.settledAt
        ? insurance.resolution === "DEALER_BLACKJACK"
          ? `INSURANCE WON · return ${formatJetons(insurance.returnedMillis ?? 0n)}`
          : "INSURANCE LOST"
        : null,
      outcome: box.outcome,
      returned: box.returnedMillis !== null ? money(box.returnedMillis) : null,
      settledKey: box.settledKey,
      payoutActions: payoutActions(box.lockedBetMillis || box.originalStakeMillis, table.blackjackPayout),
      hand: showHand
        ? {
            ranks: playerHand.ranks,
            complete: playerHand.complete,
            label: playerHand.label,
            suggestedOutcome: suggested,
            canEdit: table.currentPhase === "PLAYING" && !box.settledAt && (isBank || box.playerId === viewerId),
          }
        : undefined,
      coverage: {
        bet: boxCoverageOk(table, box.exposureReservedMillis, nextBet),
        double: boxCoverageOk(table, box.exposureReservedMillis, box.lockedBetMillis * 2n),
        split: boxCoverageOk(table, 0n, box.lockedBetMillis),
        insurance: insuranceCoverageOk(table, insuranceMaxMillis(box.originalStakeMillis || box.lockedBetMillis)),
      },
    };
  });

  const playerMembers = table.members.filter((member) => !member.isBankDealer && member.userId !== table.bankDealerId);
  const closePreview: CloseTablePreview = {
    confirmation: "Save each Player’s remaining jetons to their personal ledger and close this table?",
    players: playerMembers.map((member) => {
      const playerBoxes = (table.currentRound?.boxes ?? []).filter(
        (box) => box.playerId === member.userId && !box.removedAt,
      );
      const lockedBet = playerBoxes.reduce((sum, box) => sum + box.lockedBetMillis, 0n);
      const lockedIns =
        table.currentRound?.insuranceBets
          .filter((bet) => bet.playerId === member.userId && !bet.settledKey)
          .reduce((sum, bet) => sum + bet.amountMillis, 0n) ?? 0n;
      const lockedPoker =
        table.currentPokerHand?.participants
          .filter((item) => item.playerId === member.userId)
          .reduce((sum, item) => sum + item.lockedMillis, 0n) ?? 0n;
      return {
        userId: member.userId,
        name: displayName(member.user),
        available: money(member.availableMillis),
        locked: money(lockedBet + lockedIns + lockedPoker),
      };
    }),
  };

  const setup: SetupTableView | null =
    table.currentPhase === "TABLE_SETUP" && (isOwner || isBank)
      ? {
          role: "SETUP",
          phase: "TABLE_SETUP",
          tableName: table.name,
          game: table.game === "POKER" ? "Texas Hold’em" : "Blackjack",
          gameId: table.game === "POKER" ? "POKER" : "BLACKJACK",
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
            isGuest: Boolean(member.user.isGuest),
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
          guestJoinUrl: guestUrl,
          verifiedJoinUrl: verifiedUrl,
          minBet: table.minBetMillis !== null ? money(table.minBetMillis) : null,
          maxBet: table.maxBetMillis !== null ? money(table.maxBetMillis) : null,
          blackjackPayout: table.blackjackPayout,
          maxBoxesPerPlayer: table.maxBoxesPerPlayer,
          insuranceEnabled: table.insuranceEnabled,
          bankMayDistributeJetons: table.bankMayDistributeJetons,
          cardAssist: table.cardAssist,
          bankFundingMode: table.bankFundingMode,
          startingBank: table.startingBankMillis !== null ? money(table.startingBankMillis) : money(table.bankAvailableMillis),
          canStartBetting: Boolean(table.bankDealerId) && hasReadyPlayer,
          startBlockedReason: !table.bankDealerId
            ? "Assign a Bank/Dealer"
              : !hasReadyPlayer
                ? "Waiting for a player to join"
                : null,
          isOwner,
          isBank,
          setupCompleted: table.setupCompletedAt !== null,
          tableStatus: table.status,
          paused: table.pausedAt !== null,
          closePreview: isOwner ? closePreview : null,
          canSwitchGame: isOwner && table.status !== "ARCHIVED",
          emailConfigured: isEmailDeliveryConfigured(),
        }
      : null;

  const waiting: WaitingTableView | null =
    table.currentPhase === "TABLE_SETUP" && !isBank && !isOwner
      ? {
          role: "WAITING",
          phase: "TABLE_SETUP",
          tableName: table.name,
          game: table.game === "POKER" ? "Texas Hold’em" : "Blackjack",
          gameId: table.game === "POKER" ? "POKER" : "BLACKJACK",
          available: money(viewer.availableMillis),
          copy: "Waiting for the table to open betting.",
          bankName: table.bankDealer ? displayName(table.bankDealer) : "Dealer",
          ownerName: displayName(table.owner),
          startingJetons: money(table.startingJetonsPerPlayerMillis),
          members: table.members.map((member) => ({
            userId: member.userId,
            name: displayName(member.user),
            email: member.user.email,
            isOwner: member.isOwner,
            isBankDealer: member.isBankDealer,
            isGuest: Boolean(member.user.isGuest),
            available: money(member.availableMillis),
          })),
        }
      : isOwner && table.currentPhase === "TABLE_SETUP"
        ? null
        : table.currentPhase === "TABLE_SETUP" && isBank
          ? null
          : null;

  const ownBoxes = boxes.filter((box) => box.playerId === viewerId);
  const insuranceOpen = table.currentRound?.insuranceWindow === "OPEN";
  const unresolvedInsuranceBets =
    table.currentRound?.insuranceBets.filter((bet) => !bet.settledKey).length ?? 0;
  const unresolvedInsurance =
    unresolvedInsuranceBets > 0 ||
    ((table.currentRound?.insuranceBets.length ?? 0) > 0 && table.currentRound?.insuranceWindow !== "SETTLED");
  const unresolvedBoxes = boxes.filter((box) => !box.outcome).length;
  const readyForNextRound = unresolvedBoxes === 0 && !unresolvedInsurance;
  const canNextHand =
    readyForNextRound && (table.currentPhase === "ROUND_COMPLETE" || table.currentPhase === "PAYOUT");
  const nextRoundDeadline = table.currentRound?.nextRoundDeadlineAt?.toISOString() ?? null;
  const nextRoundCountdownActive = Boolean(
    table.currentPhase === "ROUND_COMPLETE" &&
      table.currentRound?.nextRoundDeadlineAt &&
      table.currentRound.nextRoundDeadlineAt.getTime() > Date.now(),
  );
  const tableClosed = table.status === "ARCHIVED";
  const anyLocked = closePreview.players.some((player) => BigInt(player.locked.millis) > 0n);
  const activeGame = projectActiveGame({
    game: table.game,
    blackjackPhase: table.currentPhase,
    pokerPhase: table.currentPokerHand?.phase ?? (table.game === "POKER" ? "POKER_SETUP" : null),
    pausedAt: table.pausedAt,
  });
  const pokerOpen = table.game === "POKER" && pokerHandIsOpen(table.currentPokerHand?.phase);
  const canCloseTable =
    isOwner &&
    !tableClosed &&
    !anyLocked &&
    table.bankLockedExposureMillis === 0n &&
    !pokerOpen &&
    (table.game === "POKER"
      ? activeGame.phase === "POKER_SETUP" || activeGame.phase === "HAND_COMPLETE"
      : table.currentPhase === "TABLE_SETUP" || table.currentPhase === "ROUND_COMPLETE");
  const fundingLocked = roundHasLockedStake(table.currentRound) || table.bankLockedExposureMillis > 0n;
  const bankroll = {
    mode: table.bankFundingMode,
    available: money(table.bankAvailableMillis),
    reserved: money(table.bankLockedExposureMillis),
    total: money(table.bankAvailableMillis + table.bankLockedExposureMillis),
    canToggle: isBank && table.currentPhase === "BETTING" && !fundingLocked,
    lockedReason: fundingLocked ? FUNDING_LOCKED : null,
    canCoverMore: table.bankFundingMode !== "LIMITED" || table.bankAvailableMillis > 0n,
  };
  const dealerHandView = {
    ranks: dealerHand.ranks,
    complete: dealerHand.complete,
    label: dealerHand.label,
    suggestedOutcome: null,
    suggestedInsurance: insuranceSuggestion,
    canEdit: isBank && table.currentPhase === "PLAYING",
  };

  const players: BankPlayerGroupView[] = playerMembers.map((member) => {
    const playerBoxes = boxes.filter((box) => box.playerId === member.userId);
    const lockedBet = (table.currentRound?.boxes ?? [])
      .filter((box) => box.playerId === member.userId && !box.removedAt)
      .reduce((sum, box) => sum + box.lockedBetMillis, 0n);
    const lockedIns =
      table.currentRound?.insuranceBets
        .filter((bet) => bet.playerId === member.userId && !bet.settledKey)
        .reduce((sum, bet) => sum + bet.amountMillis, 0n) ?? 0n;
    const allSettled = playerBoxes.length > 0 && playerBoxes.every((box) => Boolean(box.outcome));
    const status =
      table.currentPhase === "BETTING"
        ? "Betting"
        : table.currentPhase === "PLAYING"
          ? "In play"
          : table.currentPhase === "PAYOUT"
            ? allSettled
              ? "Settled"
              : "Awaiting payout"
            : table.currentPhase === "ROUND_COMPLETE"
              ? "Round complete"
              : "At table";
    return {
      userId: member.userId,
      name: displayName(member.user),
      available: money(member.availableMillis),
      locked: money(lockedBet + lockedIns),
      status,
      boxes: playerBoxes,
    };
  });

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
          nextRoundDeadlineAt: nextRoundDeadline,
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
          cardAssist: table.cardAssist,
          bankroll,
          dealerHand: dealerHandView,
          bankLimitReached: table.bankFundingMode === "LIMITED" && !bankroll.canCoverMore,
          isOwner,
          canSwitchGame:
            isOwner &&
            !fundingLocked &&
            !pokerOpen &&
            !tableClosed &&
            (table.currentPhase === "BETTING" || table.currentPhase === "ROUND_COMPLETE"),
          closePreview: isOwner ? closePreview : null,
        }
      : table.currentPhase === "TABLE_SETUP" && !isOwner && !isBank
        ? null
        : null;

  const lockedOrdinary = (table.currentRound?.boxes ?? [])
    .filter((box) => !box.removedAt)
    .reduce((sum, box) => sum + box.lockedBetMillis, 0n);
  const insuranceTotal =
    table.currentRound?.insuranceBets.reduce((sum, bet) => sum + bet.amountMillis, 0n) ?? 0n;

  const hasValidBet = (table.currentRound?.boxes ?? []).some(
    (box) => !box.removedAt && box.lockedBetMillis > 0n,
  );
  const deadline = table.currentRound?.bettingCloseDeadlineAt?.toISOString() ?? null;
  const countdownActive = Boolean(
    table.currentPhase === "BETTING" &&
      table.currentRound?.bettingCloseDeadlineAt &&
      table.currentRound.bettingCloseDeadlineAt.getTime() > Date.now(),
  );

  const bank: BankTableView | null =
    table.game === "BLACKJACK" && (isBank || (isOwner && table.currentPhase === "TABLE_SETUP"))
      ? table.currentPhase === "TABLE_SETUP"
        ? {
            role: "BANK",
            phase: "TABLE_SETUP",
            tableName: table.name,
            title: "Table setup",
            copy: "Waiting for Players",
            phaseLabel: "TABLE SETUP",
            primaryAction: {
              id: "nextHand",
              label: "START BETTING",
              enabled: Boolean(table.bankDealerId) && hasReadyPlayer && isBank && !tableClosed,
            },
            boxes: [],
            players: table.members
              .filter((member) => !member.isBankDealer)
              .map((member) => ({
                userId: member.userId,
                name: displayName(member.user),
                available: money(member.availableMillis),
                locked: money(0n),
                status: "Waiting",
                boxes: [],
              })),
            playerCount: table.members.filter((member) => !member.isBankDealer).length,
            boxCount: 0,
            lockedOrdinary: money(0n),
            insurance: { window: "CLOSED", total: money(0n), count: 0, resolution: null },
            actions: {
              dealCards: false,
              scheduleDeal: false,
              payoutPhase: false,
              nextHand: Boolean(table.bankDealerId) && hasReadyPlayer && isBank && !tableClosed,
              scheduleNextRound: false,
              openInsurance: false,
              closeInsurance: false,
              settleBoxes: false,
              settleDealerWon: false,
              settleInsurance: false,
              addPlayer: (isOwner || isBank) && !tableClosed,
              giveJetons: false,
              changeBank: isOwner && !tableClosed,
              saveTable: isOwner && !tableClosed,
              closeTable: isOwner && !tableClosed,
              switchGame: isOwner && !tableClosed,
            },
            insuranceSettleActions: [],
            bettingCloseDeadlineAt: null,
            nextRoundDeadlineAt: null,
            hasValidBet: false,
            isOwner,
            tableStatus: table.status,
            paused: table.pausedAt !== null,
            closePreview: isOwner ? closePreview : null,
            cardAssist: table.cardAssist,
            dealerName: table.bankDealer ? displayName(table.bankDealer) : displayName(table.owner),
            canSwitchGame: isOwner && !tableClosed,
            guestJoinUrl: guestUrl,
            verifiedJoinUrl: verifiedUrl,
            invitations: table.invitations
              .filter((invite) => invite.kind === "EMAIL")
              .map((invite) => ({
                id: invite.id,
                kind: invite.kind,
                email: invite.email,
                pending: !invite.usedAt && !invite.revokedAt,
              })),
            emailConfigured: isEmailDeliveryConfigured(),
            startingJetons: money(table.startingJetonsPerPlayerMillis),
            canStartBetting: Boolean(table.bankDealerId) && hasReadyPlayer && isBank && !tableClosed,
          }
        : isBank
          ? {
        role: "BANK",
        phase: table.currentPhase,
        tableName: table.name,
        title: BANK_COPY[table.currentPhase]?.[0] ?? "Bank",
        copy: BANK_COPY[table.currentPhase]?.[1] ?? "",
        phaseLabel: table.currentPhase.replace("_", " "),
        primaryAction:
          table.currentPhase === "BETTING"
            ? { id: "dealCards", label: "CLOSE BETTING", enabled: hasValidBet && !tableClosed }
            : table.currentPhase === "PLAYING"
              ? { id: "payoutPhase", label: "ENTER PAYOUT", enabled: !tableClosed }
              : { id: "nextHand", label: "START NEXT ROUND", enabled: canNextHand && !tableClosed },
        boxes,
        players,
        playerCount: players.length,
        boxCount: boxes.length,
        lockedOrdinary: money(lockedOrdinary),
        insurance: {
          window: table.currentRound?.insuranceWindow ?? "CLOSED",
          total: money(insuranceTotal),
          count: table.currentRound?.insuranceBets.length ?? 0,
          resolution: table.currentRound?.insuranceResolution ?? null,
        },
        actions: {
          dealCards: table.currentPhase === "BETTING" && hasValidBet && !tableClosed,
          scheduleDeal: table.currentPhase === "BETTING" && hasValidBet && !countdownActive && !tableClosed,
          payoutPhase: table.currentPhase === "PLAYING" && !tableClosed,
          nextHand: canNextHand && !tableClosed,
          scheduleNextRound: canNextHand && !nextRoundCountdownActive && !tableClosed,
          openInsurance:
            table.currentPhase === "PLAYING" &&
            table.insuranceEnabled &&
            table.currentRound?.insuranceWindow !== "OPEN" &&
            table.currentRound?.insuranceWindow !== "SETTLED" &&
            !tableClosed,
          closeInsurance: table.currentPhase === "PLAYING" && insuranceOpen && !tableClosed,
          settleBoxes: table.currentPhase === "PAYOUT" && !tableClosed,
          settleDealerWon:
            isOwner &&
            table.currentPhase === "PAYOUT" &&
            !tableClosed &&
            boxes.some((box) => !box.outcome),
          settleInsurance: table.currentPhase === "PAYOUT" && unresolvedInsurance && !tableClosed,
          addPlayer: (isOwner || isBank) && table.currentPhase === "BETTING" && !tableClosed,
          giveJetons: table.currentPhase === "BETTING" && table.bankMayDistributeJetons && !tableClosed,
          changeBank:
            isOwner &&
            !tableClosed &&
            (table.currentPhase === "BETTING" ||
              table.currentPhase === "ROUND_COMPLETE" ||
              (table.currentPhase === "PAYOUT" && canNextHand)),
          saveTable: isOwner && !tableClosed && !pokerOpen && !anyLocked,
          closeTable: canCloseTable,
          switchGame:
            isOwner &&
            !fundingLocked &&
            !pokerOpen &&
            !tableClosed &&
            (table.currentPhase === "BETTING" ||
              table.currentPhase === "ROUND_COMPLETE" ||
              (table.currentPhase === "PAYOUT" && canNextHand)),
        },
        insuranceSettleActions: [
          { id: "DEALER_BLACKJACK", label: "INSURANCE WON" },
          { id: "NO_DEALER_BLACKJACK", label: "INSURANCE LOST" },
        ],
        bettingCloseDeadlineAt: deadline,
        nextRoundDeadlineAt: nextRoundDeadline,
        hasValidBet,
        isOwner,
        tableStatus: table.status,
        paused: table.pausedAt !== null,
        closePreview: isOwner ? closePreview : null,
        cardAssist: table.cardAssist,
        bankroll,
        dealerHand: dealerHandView,
        dealerName: table.bankDealer ? displayName(table.bankDealer) : "Dealer",
        insuranceSuggestion,
        canSwitchGame:
          isOwner &&
          !fundingLocked &&
          !pokerOpen &&
          !tableClosed &&
          (table.currentPhase === "BETTING" ||
            table.currentPhase === "ROUND_COMPLETE" ||
            (table.currentPhase === "PAYOUT" && canNextHand)),
        switchBlockedReason: fundingLocked || pokerOpen || table.currentPhase === "PLAYING" || table.currentPhase === "PAYOUT"
          ? "Finish or clear the current hand before switching games"
          : null,
        waitingForFirstBet: table.currentPhase === "BETTING" && !hasValidBet,
        guestJoinUrl: guestUrl,
        verifiedJoinUrl: verifiedUrl,
        invitations: table.invitations
          .filter((invite) => invite.kind === "EMAIL")
          .map((invite) => ({
            id: invite.id,
            kind: invite.kind,
            email: invite.email,
            pending: !invite.usedAt && !invite.revokedAt,
          })),
        emailConfigured: isEmailDeliveryConfigured(),
        startingJetons: money(table.startingJetonsPerPlayerMillis),
      }
          : null
      : null;

  if (isBank && table.currentPhase === "ROUND_COMPLETE" && bank) {
    bank.primaryAction = { id: "nextHand", label: "START NEXT ROUND", enabled: canNextHand && !tableClosed };
  }

  const poker =
    table.game === "POKER"
      ? buildPokerView({
          tableName: table.name,
          isOwner,
          viewerId,
          smallBlind: table.pokerSmallBlindMillis,
          bigBlind: table.pokerBigBlindMillis,
          members: table.members,
          seats: table.pokerSeats,
          hand: table.currentPokerHand,
          tableClosed,
          handsStarted: table._count.pokerHands,
        })
      : null;
  const blackjack = table.game === "BLACKJACK";
  const gameSession: GameSessionView | null = table.currentGameSession
    ? {
        id: table.currentGameSession.id,
        gameType: table.currentGameSession.gameType,
        status: table.currentGameSession.status,
        startedAt: table.currentGameSession.startedAt.toISOString(),
        startingJetons: money(table.currentGameSession.startingJetonsMillis),
        stakeType: table.currentGameSession.stakeType,
        stakeExample: stakeExample(stakeFromSession(table.currentGameSession)),
        players: table.members.map((member) => ({
          userId: member.userId,
          name: displayName(member.user),
          available: money(member.availableMillis),
          isOwner: member.isOwner,
          isDealer: member.isBankDealer,
        })),
      }
    : null;

  if (bank) bank.gameSession = gameSession;
  if (setup) setup.gameSession = gameSession;
  if (player) player.gameSession = gameSession;
  if (poker) poker.gameSession = gameSession;

  return {
    tableId: table.id,
    viewerId,
    viewerName: displayName(viewer.user),
    isOwner,
    isBank,
    isDealer: isBank,
    isSeatedPlayer,
    isGuest,
    game: activeGame.game,
    gameLabel: activeGame.gameLabel,
    phase: activeGame.phase,
    phaseLabel: activeGame.phaseLabel,
    headline: activeGame.headline,
    revision: table.updatedAt.getTime(),
    seatedPlayerCount: playerMembers.length,
    canStartBetting: Boolean(table.bankDealerId) && hasReadyPlayer,
    roundNumber: poker ? poker.handNumber : table.currentRound?.number ?? 0,
    turnNumber: poker?.turnNumber ?? 0,
    roundId: table.currentRound?.id ?? null,
    tableClosed,
    members: table.members.map((member) => ({
      userId: member.userId,
      name: displayName(member.user),
      email: isOwner || isBank ? member.user.email : "",
      isOwner: member.isOwner,
      isBankDealer: member.isBankDealer,
      isGuest: Boolean(member.user.isGuest),
      available: isOwner || isBank || member.userId === viewerId ? money(member.availableMillis) : null,
    })),
    setup,
    waiting:
      waiting ??
      (blackjack && table.currentPhase === "TABLE_SETUP" && !isOwner && !isBank
        ? {
            role: "WAITING",
            phase: "TABLE_SETUP",
            tableName: table.name,
            game: "Blackjack",
            available: money(viewer.availableMillis),
            copy: "Waiting for the Bank to start",
            bankName: table.bankDealer ? displayName(table.bankDealer) : "Dealer",
            ownerName: displayName(table.owner),
            startingJetons: money(table.startingJetonsPerPlayerMillis),
          }
        : null),
    player: blackjack ? player : null,
    bank: blackjack ? bank : null,
    poker,
    gameSession,
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
