-- AlterEnum
ALTER TYPE "GameId" ADD VALUE 'POKER';

-- CreateEnum
CREATE TYPE "PokerHandPhase" AS ENUM ('POKER_SETUP', 'PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'HAND_COMPLETE');

-- CreateEnum
CREATE TYPE "PokerParticipantStatus" AS ENUM ('ACTIVE', 'FOLDED', 'ALL_IN');

-- CreateEnum
CREATE TYPE "PokerActionType" AS ENUM ('BLIND', 'FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN');

-- AlterEnum
ALTER TYPE "LedgerTransactionType" ADD VALUE 'POKER_BLIND_LOCKED';
ALTER TYPE "LedgerTransactionType" ADD VALUE 'POKER_WAGER_LOCKED';
ALTER TYPE "LedgerTransactionType" ADD VALUE 'POKER_UNCALLED_RETURN';
ALTER TYPE "LedgerTransactionType" ADD VALUE 'POKER_POT_AWARD';

-- AlterTable
ALTER TABLE "Table" ADD COLUMN "currentPokerHandId" TEXT;
ALTER TABLE "Table" ADD COLUMN "pokerSmallBlindMillis" BIGINT NOT NULL DEFAULT 5000;
ALTER TABLE "Table" ADD COLUMN "pokerBigBlindMillis" BIGINT NOT NULL DEFAULT 10000;

-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN "pokerHandId" TEXT;

-- CreateTable
CREATE TABLE "PokerSeat" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "sittingOut" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PokerSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokerHand" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "phase" "PokerHandPhase" NOT NULL,
    "dealerPlayerId" TEXT NOT NULL,
    "smallBlindPlayerId" TEXT NOT NULL,
    "bigBlindPlayerId" TEXT NOT NULL,
    "currentActorPlayerId" TEXT,
    "streetWagerMillis" BIGINT NOT NULL DEFAULT 0,
    "lastRaiseSizeMillis" BIGINT NOT NULL DEFAULT 0,
    "lastAggressorPlayerId" TEXT,
    "actionCount" INTEGER NOT NULL DEFAULT 0,
    "settledKey" TEXT,
    "nextHandDeadlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "awardSummary" JSONB,

    CONSTRAINT "PokerHand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokerParticipant" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seatOrder" INTEGER NOT NULL,
    "status" "PokerParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "streetContributionMillis" BIGINT NOT NULL DEFAULT 0,
    "totalContributionMillis" BIGINT NOT NULL DEFAULT 0,
    "lockedMillis" BIGINT NOT NULL DEFAULT 0,
    "hasActedThisStreet" BOOLEAN NOT NULL DEFAULT false,
    "isDealer" BOOLEAN NOT NULL DEFAULT false,
    "isSmallBlind" BOOLEAN NOT NULL DEFAULT false,
    "isBigBlind" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PokerParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokerPot" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "capMillis" BIGINT NOT NULL,
    "amountMillis" BIGINT NOT NULL,
    "eligiblePlayerIds" JSONB NOT NULL,
    "winnerPlayerIds" JSONB,
    "awarded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PokerPot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokerAction" (
    "id" TEXT NOT NULL,
    "handId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "street" "PokerHandPhase" NOT NULL,
    "type" "PokerActionType" NOT NULL,
    "amountMillis" BIGINT NOT NULL DEFAULT 0,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "PokerAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PokerSeat_tableId_playerId_key" ON "PokerSeat"("tableId", "playerId");
CREATE UNIQUE INDEX "PokerSeat_tableId_orderIndex_key" ON "PokerSeat"("tableId", "orderIndex");
CREATE UNIQUE INDEX "PokerHand_settledKey_key" ON "PokerHand"("settledKey");
CREATE UNIQUE INDEX "PokerHand_tableId_number_key" ON "PokerHand"("tableId", "number");
CREATE UNIQUE INDEX "Table_currentPokerHandId_key" ON "Table"("currentPokerHandId");
CREATE UNIQUE INDEX "PokerParticipant_handId_playerId_key" ON "PokerParticipant"("handId", "playerId");
CREATE UNIQUE INDEX "PokerPot_handId_index_key" ON "PokerPot"("handId", "index");
CREATE UNIQUE INDEX "PokerAction_idempotencyKey_key" ON "PokerAction"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_currentPokerHandId_fkey" FOREIGN KEY ("currentPokerHandId") REFERENCES "PokerHand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PokerSeat" ADD CONSTRAINT "PokerSeat_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PokerSeat" ADD CONSTRAINT "PokerSeat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PokerHand" ADD CONSTRAINT "PokerHand_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PokerParticipant" ADD CONSTRAINT "PokerParticipant_handId_fkey" FOREIGN KEY ("handId") REFERENCES "PokerHand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PokerParticipant" ADD CONSTRAINT "PokerParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PokerPot" ADD CONSTRAINT "PokerPot_handId_fkey" FOREIGN KEY ("handId") REFERENCES "PokerHand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PokerAction" ADD CONSTRAINT "PokerAction_handId_fkey" FOREIGN KEY ("handId") REFERENCES "PokerHand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PokerAction" ADD CONSTRAINT "PokerAction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_pokerHandId_fkey" FOREIGN KEY ("pokerHandId") REFERENCES "PokerHand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
