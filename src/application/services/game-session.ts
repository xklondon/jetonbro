import { prisma } from "@/application/db";
import { withIdempotency } from "@/application/idempotency";
import { publishTable } from "@/application/realtime/bus";
import { roundHasLockedStake } from "@/application/services/bankroll";
import { appendLedger, creditTableAvailable } from "@/application/services/ledger";
import { replacePokerSeats } from "@/application/services/poker-seats";
import { assertCanSwitchGame, SWITCH_BLOCKED } from "@/domain/tables/switch-game";
import { isPlayableGame } from "@/domain/games";
import { DomainError, ForbiddenError, NotFoundError } from "@/domain/errors";
import { formatJetons, parseWholeJetons } from "@/domain/money";
import { parseStakeSpec, personalResultCopy, stakeFromSession } from "@/domain/stakes";
import { assertFundedPokerDealer } from "@/domain/poker/dealer-stack";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email.split("@")[0] || "Player";
}

export { personalResultCopy };

export async function openInitialGameSession(
  tx: Tx,
  table: { id: string; name: string; game: "BLACKJACK" | "POKER"; startingJetonsPerPlayerMillis: bigint },
): Promise<string> {
  const session = await tx.gameSession.create({
    data: {
      tableId: table.id,
      tableName: table.name,
      gameType: table.game,
      status: "SETUP",
      startingJetonsMillis: table.startingJetonsPerPlayerMillis,
      stakeType: "MONEY",
      currencyCode: "GBP",
      minorUnitsPerJeton: 100n,
    },
  });
  await tx.table.update({
    where: { id: table.id },
    data: { currentGameSessionId: session.id },
  });
  return session.id;
}

export async function recordSessionStarter(
  tx: Tx,
  input: {
    tableId: string;
    memberId: string;
    userId: string;
    amount: bigint;
    playedAsDealer: boolean;
  },
): Promise<void> {
  const table = await tx.table.findUnique({
    where: { id: input.tableId },
    select: { currentGameSessionId: true },
  });
  if (!table?.currentGameSessionId) return;
  const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId } });
  await tx.gameSessionParticipant.upsert({
    where: {
      gameSessionId_memberId: { gameSessionId: table.currentGameSessionId, memberId: input.memberId },
    },
    update: {
      startingBalanceMillis: input.amount,
      playedAsDealer: input.playedAsDealer,
      verifiedUserId: user.isGuest ? null : user.id,
      displayName: displayName(user),
    },
    create: {
      gameSessionId: table.currentGameSessionId,
      memberId: input.memberId,
      verifiedUserId: user.isGuest ? null : user.id,
      displayName: displayName(user),
      playedAsDealer: input.playedAsDealer,
      startingBalanceMillis: input.amount,
    },
  });
}

async function requireOwnerTable(tx: Tx, tableId: string, actorId: string) {
  await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${tableId} FOR UPDATE`;
  const table = await tx.table.findUnique({
    where: { id: tableId },
    include: {
      members: { where: { leftAt: null }, include: { user: true } },
      currentRound: { include: { boxes: true, insuranceBets: true } },
      currentPokerHand: { include: { participants: true } },
      currentGameSession: { include: { participants: true } },
      pokerSeats: true,
    },
  });
  if (!table) throw new NotFoundError("Table not found.");
  if (table.status === "ARCHIVED") throw new DomainError("TABLE_CLOSED", "This table is closed.");
  if (table.ownerId !== actorId) throw new ForbiddenError("Only the table owner can switch games.");
  return table;
}

function assertUnlocked(table: Awaited<ReturnType<typeof requireOwnerTable>>): void {
  const hasLockedBlackjack = roundHasLockedStake(table.currentRound);
  const hasLockedPoker =
    (table.currentPokerHand?.participants.some((item) => item.lockedMillis > 0n) ?? false) &&
    table.currentPokerHand?.phase !== "HAND_COMPLETE";
  assertCanSwitchGame({
    isOwner: true,
    game: table.game,
    blackjackPhase: table.currentPhase,
    pokerPhase: table.currentPokerHand?.phase ?? (table.game === "POKER" ? "POKER_SETUP" : null),
    hasLockedBlackjack,
    hasBankExposure: table.bankLockedExposureMillis > 0n,
    hasLockedPoker,
  });
}

async function closeCurrentSession(
  tx: Tx,
  table: Awaited<ReturnType<typeof requireOwnerTable>>,
  actorId: string,
  publishPersonal: boolean,
): Promise<void> {
  const session = table.currentGameSession;
  if (!session) return;
  for (const member of table.members) {
    const ending = member.availableMillis;
    const participant = session.participants.find((row) => row.memberId === member.id);
    const starting = participant?.startingBalanceMillis ?? 0n;
    const net = ending - starting;
    if (ending !== 0n) {
      const { before, after } = await creditTableAvailable(tx, member.id, -ending);
      await appendLedger(tx, {
        playerId: member.userId,
        actorId,
        tableId: table.id,
        gameSessionId: session.id,
        transactionType: "GAME_SESSION_CLOSE",
        amountMillis: ending,
        balanceBeforeMillis: before,
        balanceAfterMillis: after,
        idempotencyKey: `game-session-close:${session.id}:${member.userId}`,
        description: `GAME_SESSION_CLOSE · ${formatJetons(ending)} remaining`,
      });
      member.availableMillis = 0n;
    }
    const verifiedUserId = member.user.isGuest ? null : member.userId;
    const recorded = publishPersonal && Boolean(verifiedUserId);
    await tx.gameSessionParticipant.upsert({
      where: { gameSessionId_memberId: { gameSessionId: session.id, memberId: member.id } },
      update: {
        endingBalanceMillis: ending,
        netMillis: net,
        playedAsDealer: member.isBankDealer,
        displayName: displayName(member.user),
        verifiedUserId,
        resultRecordedAt: recorded ? new Date() : participant?.resultRecordedAt ?? null,
      },
      create: {
        gameSessionId: session.id,
        memberId: member.id,
        verifiedUserId,
        displayName: displayName(member.user),
        playedAsDealer: member.isBankDealer,
        startingBalanceMillis: starting,
        endingBalanceMillis: ending,
        netMillis: net,
        resultRecordedAt: recorded ? new Date() : null,
      },
    });
  }
  await tx.gameSession.update({
    where: { id: session.id },
    data: {
      status: table.currentPhase === "TABLE_SETUP" && !table.currentPokerHand ? "ABANDONED" : "COMPLETED",
      completedAt: new Date(),
      savedToPersonalLedgerAt: publishPersonal ? new Date() : session.savedToPersonalLedgerAt,
    },
  });
}

async function allocateSession(
  tx: Tx,
  input: {
    tableId: string;
    sessionId: string;
    actorId: string;
    amount: bigint;
    members: { id: string; userId: string }[];
    dealerId: string | null;
  },
): Promise<void> {
  for (const member of input.members) {
    if (input.amount > 0n) {
      const { before, after } = await creditTableAvailable(tx, member.id, input.amount);
      await appendLedger(tx, {
        playerId: member.userId,
        actorId: input.actorId,
        tableId: input.tableId,
        gameSessionId: input.sessionId,
        transactionType: "GAME_SESSION_OPEN",
        amountMillis: input.amount,
        balanceBeforeMillis: before,
        balanceAfterMillis: after,
        idempotencyKey: `game-session-open:${input.sessionId}:${member.userId}`,
        description: `GAME_SESSION_OPEN · ${formatJetons(input.amount)}`,
      });
    }
    await tx.tableMember.update({
      where: { id: member.id },
      data: { startingJetonsCredited: true },
    });
    const user = await tx.user.findUniqueOrThrow({ where: { id: member.userId } });
    await tx.gameSessionParticipant.create({
      data: {
        gameSessionId: input.sessionId,
        memberId: member.id,
        verifiedUserId: user.isGuest ? null : user.id,
        displayName: displayName(user),
        playedAsDealer: member.userId === input.dealerId,
        startingBalanceMillis: input.amount,
      },
    });
  }
}

export async function startNewGame(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  game: string;
  participantUserIds?: string[];
  startingJetonsPerPlayer?: string;
  savePersonalLedger?: boolean | string;
  stakeType?: string;
  currencyCode?: string;
  moneyPerJeton?: string;
  customUnitLabel?: string;
  jetonsPerCustomUnit?: string;
  smallBlind?: string;
  bigBlind?: string;
  dealerUserId?: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "startNewGame", input, async () => {
    if (input.game === "ZILCH" || !isPlayableGame(input.game)) {
      throw new DomainError("GAME_UNAVAILABLE", "That game is coming later.");
    }
    const stake = parseStakeSpec(input);
    const publishPersonal = input.savePersonalLedger === true || input.savePersonalLedger === "true";
    await prisma.$transaction(async (tx) => {
      const table = await requireOwnerTable(tx, input.tableId, input.actorId);
      assertUnlocked(table);
      const requestedStart = input.startingJetonsPerPlayer
        ? parseWholeJetons(input.startingJetonsPerPlayer)
        : table.startingJetonsPerPlayerMillis;
      if (input.startingJetonsPerPlayer && requestedStart <= 0n) {
        throw new DomainError("INVALID_AMOUNT", "Starting jetons must be greater than zero.");
      }
      const starting = requestedStart > 0n ? requestedStart : 100000n;
      const requested = input.participantUserIds?.filter(Boolean) ?? [];
      const selected =
        requested.length > 0
          ? table.members.filter((member) => requested.includes(member.userId))
          : table.game === "POKER" || input.game === "POKER"
            ? table.members
            : table.members.filter((member) => !member.isBankDealer || member.userId === input.actorId);
      if (selected.length === 0) {
        throw new DomainError("NO_PLAYERS", "Select at least one participant.");
      }
      await closeCurrentSession(tx, table, input.actorId, publishPersonal);

      const session = await tx.gameSession.create({
        data: {
          tableId: table.id,
          tableName: table.name,
          gameType: input.game === "POKER" ? "POKER" : "BLACKJACK",
          status: "SETUP",
          startingJetonsMillis: starting,
          stakeType: stake.type,
          currencyCode: stake.type === "MONEY" ? stake.currencyCode : null,
          minorUnitsPerJeton: stake.type === "MONEY" ? stake.minorUnitsPerJeton : null,
          customUnitLabel: stake.type === "CUSTOM" ? stake.customUnitLabel : null,
          jetonsPerCustomUnit: stake.type === "CUSTOM" ? stake.jetonsPerCustomUnit : null,
        },
      });

      const dealerUserId =
        input.dealerUserId && selected.some((member) => member.userId === input.dealerUserId)
          ? input.dealerUserId
          : input.game === "POKER"
            ? selected[0]!.userId
            : table.bankDealerId;

      if (input.game === "POKER") {
        if (selected.length < 2) {
          throw new DomainError("POKER_SEATS", "Texas Hold’em needs at least two Players.");
        }
        await replacePokerSeats(
          tx,
          table.id,
          selected.map((member) => member.userId),
        );
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
            currentPhase: "TABLE_SETUP",
            currentRoundId: null,
            currentGameSessionId: session.id,
            startingJetonsPerPlayerMillis: starting,
            pokerSmallBlindMillis: small,
            pokerBigBlindMillis: big,
            updatedAt: new Date(),
          },
        });
        await allocateSession(tx, {
          tableId: table.id,
          sessionId: session.id,
          actorId: input.actorId,
          amount: starting,
          members: selected,
          dealerId: dealerUserId,
        });
        const funded = selected.map((member) => ({ playerId: member.userId, availableMillis: starting }));
        assertFundedPokerDealer({ dealerPlayerId: dealerUserId!, seats: funded, sessionStarting: true });
        return;
      }

      await tx.pokerSeat.deleteMany({ where: { tableId: table.id } });
      await tx.table.update({
        where: { id: table.id },
        data: {
          game: "BLACKJACK",
          currentPokerHandId: null,
          currentPhase: "TABLE_SETUP",
          currentRoundId: null,
          currentGameSessionId: session.id,
          startingJetonsPerPlayerMillis: starting,
          updatedAt: new Date(),
        },
      });
      await allocateSession(tx, {
        tableId: table.id,
        sessionId: session.id,
        actorId: input.actorId,
        amount: starting,
        members: selected,
        dealerId: dealerUserId,
      });
    });
    publishTable(input.tableId);
    return { ok: true, game: input.game, blocked: SWITCH_BLOCKED };
  });
}

export async function saveGameSessionResults(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  sessionId?: string;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "saveGameSessionResults", input, async () => {
    const table = await prisma.table.findUnique({
      where: { id: input.tableId },
      include: { currentGameSession: { include: { participants: true } }, members: { include: { user: true } } },
    });
    if (!table) throw new NotFoundError("Table not found.");
    if (table.ownerId !== input.actorId) throw new ForbiddenError("Only the table owner can save results.");
    const session = table.currentGameSession;
    if (!session) return { ok: true, saved: false };
    if (session.savedToPersonalLedgerAt) return { ok: true, saved: true, idempotent: true };
    await prisma.$transaction(async (tx) => {
      for (const member of table.members.filter((row) => !row.leftAt)) {
        if (member.user.isGuest) continue;
        const participant = session.participants.find((row) => row.memberId === member.id);
        const ending = participant?.endingBalanceMillis ?? member.availableMillis;
        const starting = participant?.startingBalanceMillis ?? 0n;
        await tx.gameSessionParticipant.upsert({
          where: { gameSessionId_memberId: { gameSessionId: session.id, memberId: member.id } },
          update: {
            verifiedUserId: member.userId,
            endingBalanceMillis: ending,
            netMillis: ending - starting,
            resultRecordedAt: new Date(),
          },
          create: {
            gameSessionId: session.id,
            memberId: member.id,
            verifiedUserId: member.userId,
            displayName: displayName(member.user),
            playedAsDealer: member.isBankDealer,
            startingBalanceMillis: starting,
            endingBalanceMillis: ending,
            netMillis: ending - starting,
            resultRecordedAt: new Date(),
          },
        });
      }
      await tx.gameSession.update({
        where: { id: session.id },
        data: { savedToPersonalLedgerAt: new Date() },
      });
    });
    return { ok: true, saved: true };
  });
}

export async function listPersonalLedger(userId: string) {
  const rows = await prisma.gameSessionParticipant.findMany({
    where: { verifiedUserId: userId, resultRecordedAt: { not: null } },
    include: { gameSession: true },
    orderBy: { resultRecordedAt: "desc" },
  });
  return rows.map((row) => {
    const stake = stakeFromSession(row.gameSession);
    const net = row.netMillis ?? 0n;
    return {
      id: row.id,
      sessionId: row.gameSessionId,
      date: (row.resultRecordedAt ?? row.gameSession.startedAt).toISOString(),
      tableName: row.gameSession.tableName,
      game: row.gameSession.gameType === "POKER" ? "Poker" : "Blackjack",
      stakeType: row.gameSession.stakeType,
      stakeExample: stake.type === "MONEY"
        ? `1 jeton = ${stake.currencyCode === "GBP" ? "£" : stake.currencyCode === "EUR" ? "€" : "$"}${(stake.minorUnitsPerJeton / 100n).toString()}`
        : `${stake.jetonsPerCustomUnit.toString()} jetons = 1 ${stake.customUnitLabel}`,
      startingJetons: formatJetons(row.startingBalanceMillis),
      endingJetons: formatJetons(row.endingBalanceMillis ?? row.startingBalanceMillis),
      netJetons: formatJetons(net < 0n ? -net : net),
      netSign: net > 0n ? "plus" : net < 0n ? "minus" : "even",
      result: personalResultCopy({ netMillis: net, stake }),
      role: row.playedAsDealer ? "Dealer" : "Player",
      status: row.gameSession.status,
    };
  });
}
