-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GameId" AS ENUM ('BLACKJACK');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('SETUP', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RoundPhase" AS ENUM ('TABLE_SETUP', 'BETTING', 'PLAYING', 'PAYOUT', 'ROUND_COMPLETE');

-- CreateEnum
CREATE TYPE "BlackjackPayoutRule" AS ENUM ('THREE_TWO', 'SIX_FIVE');

-- CreateEnum
CREATE TYPE "InvitationKind" AS ENUM ('EMAIL', 'QR');

-- CreateEnum
CREATE TYPE "BoxOutcome" AS ENUM ('WON', 'PUSH', 'LOST', 'BLACKJACK');

-- CreateEnum
CREATE TYPE "InsuranceWindowState" AS ENUM ('CLOSED', 'OPEN', 'SETTLED');

-- CreateEnum
CREATE TYPE "InsuranceResolution" AS ENUM ('DEALER_BLACKJACK', 'NO_DEALER_BLACKJACK');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('INITIAL_ALLOCATION', 'BANK_DISTRIBUTION', 'BANK_ADJUSTMENT', 'BET_LOCKED', 'BET_RETRACTED', 'DOUBLE_LOCKED', 'SPLIT_LOCKED', 'INSURANCE_LOCKED', 'BET_WIN_RETURN', 'BET_PUSH_RETURN', 'BET_LOSS', 'BLACKJACK_RETURN', 'INSURANCE_WIN_RETURN', 'INSURANCE_LOSS', 'TABLE_TRANSFER_IN', 'TABLE_TRANSFER_OUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "globalAvailableMillis" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "game" "GameId" NOT NULL DEFAULT 'BLACKJACK',
    "status" "TableStatus" NOT NULL DEFAULT 'SETUP',
    "ownerId" TEXT NOT NULL,
    "bankDealerId" TEXT,
    "minBetMillis" BIGINT,
    "maxBetMillis" BIGINT,
    "blackjackPayout" "BlackjackPayoutRule" NOT NULL DEFAULT 'THREE_TWO',
    "bankMayDistributeJetons" BOOLEAN NOT NULL DEFAULT true,
    "currentPhase" "RoundPhase" NOT NULL DEFAULT 'TABLE_SETUP',
    "currentRoundId" TEXT,
    "joinEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableMember" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isBankDealer" BOOLEAN NOT NULL DEFAULT false,
    "availableMillis" BIGINT NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "TableMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "kind" "InvitationKind" NOT NULL,
    "email" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "phase" "RoundPhase" NOT NULL,
    "insuranceWindow" "InsuranceWindowState" NOT NULL DEFAULT 'CLOSED',
    "insuranceResolution" "InsuranceResolution",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bettingClosedAt" TIMESTAMP(3),
    "payoutEnteredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BettingBox" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "boxNumber" INTEGER NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "parentBoxId" TEXT,
    "originalStakeMillis" BIGINT NOT NULL DEFAULT 0,
    "lockedBetMillis" BIGINT NOT NULL DEFAULT 0,
    "isDoubled" BOOLEAN NOT NULL DEFAULT false,
    "isSplitOffshoot" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "outcome" "BoxOutcome",
    "returnedMillis" BIGINT,
    "settledAt" TIMESTAMP(3),
    "settledKey" TEXT,

    CONSTRAINT "BettingBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceBet" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "amountMillis" BIGINT NOT NULL,
    "resolution" "InsuranceResolution",
    "returnedMillis" BIGINT,
    "settledAt" TIMESTAMP(3),
    "settledKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tableId" TEXT,
    "roundId" TEXT,
    "boxId" TEXT,
    "insuranceBetId" TEXT,
    "transactionType" "LedgerTransactionType" NOT NULL,
    "amountMillis" BIGINT NOT NULL,
    "balanceBeforeMillis" BIGINT NOT NULL,
    "balanceAfterMillis" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Table_currentRoundId_key" ON "Table"("currentRoundId");

-- CreateIndex
CREATE UNIQUE INDEX "TableMember_tableId_userId_key" ON "TableMember"("tableId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_tableId_kind_idx" ON "Invitation"("tableId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Round_tableId_number_key" ON "Round"("tableId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "BettingBox_settledKey_key" ON "BettingBox"("settledKey");

-- CreateIndex
CREATE UNIQUE INDEX "BettingBox_roundId_playerId_boxNumber_key" ON "BettingBox"("roundId", "playerId", "boxNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceBet_settledKey_key" ON "InsuranceBet"("settledKey");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceBet_roundId_boxId_key" ON "InsuranceBet"("roundId", "boxId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerEntry_playerId_timestamp_idx" ON "LedgerEntry"("playerId", "timestamp");

-- CreateIndex
CREATE INDEX "LedgerEntry_tableId_timestamp_idx" ON "LedgerEntry"("tableId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_actorId_key_key" ON "IdempotencyRecord"("actorId", "key");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_bankDealerId_fkey" FOREIGN KEY ("bankDealerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_currentRoundId_fkey" FOREIGN KEY ("currentRoundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableMember" ADD CONSTRAINT "TableMember_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableMember" ADD CONSTRAINT "TableMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BettingBox" ADD CONSTRAINT "BettingBox_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BettingBox" ADD CONSTRAINT "BettingBox_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BettingBox" ADD CONSTRAINT "BettingBox_parentBoxId_fkey" FOREIGN KEY ("parentBoxId") REFERENCES "BettingBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceBet" ADD CONSTRAINT "InsuranceBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceBet" ADD CONSTRAINT "InsuranceBet_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceBet" ADD CONSTRAINT "InsuranceBet_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "BettingBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "BettingBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_insuranceBetId_fkey" FOREIGN KEY ("insuranceBetId") REFERENCES "InsuranceBet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableMember" ADD CONSTRAINT "TableMember_available_nonnegative" CHECK ("availableMillis" >= 0);
ALTER TABLE "BettingBox" ADD CONSTRAINT "BettingBox_locked_nonnegative" CHECK ("lockedBetMillis" >= 0);
ALTER TABLE "InsuranceBet" ADD CONSTRAINT "InsuranceBet_amount_nonnegative" CHECK ("amountMillis" >= 0);
