CREATE TYPE "GameSessionStatus" AS ENUM ('SETUP', 'ACTIVE', 'COMPLETED', 'ABANDONED');

CREATE TYPE "StakeType" AS ENUM ('MONEY', 'CUSTOM');

ALTER TYPE "LedgerTransactionType" ADD VALUE 'GAME_SESSION_OPEN';
ALTER TYPE "LedgerTransactionType" ADD VALUE 'GAME_SESSION_CLOSE';

CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "tableId" TEXT,
    "tableName" TEXT NOT NULL,
    "gameType" "GameId" NOT NULL,
    "status" "GameSessionStatus" NOT NULL DEFAULT 'SETUP',
    "startingJetonsMillis" BIGINT NOT NULL,
    "stakeType" "StakeType" NOT NULL DEFAULT 'MONEY',
    "currencyCode" TEXT,
    "minorUnitsPerJeton" BIGINT,
    "customUnitLabel" TEXT,
    "jetonsPerCustomUnit" BIGINT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "savedToPersonalLedgerAt" TIMESTAMP(3),

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameSessionParticipant" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "verifiedUserId" TEXT,
    "displayName" TEXT NOT NULL,
    "playedAsDealer" BOOLEAN NOT NULL DEFAULT false,
    "startingBalanceMillis" BIGINT NOT NULL,
    "endingBalanceMillis" BIGINT,
    "netMillis" BIGINT,
    "resultRecordedAt" TIMESTAMP(3),

    CONSTRAINT "GameSessionParticipant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Table" ADD COLUMN "currentGameSessionId" TEXT;
ALTER TABLE "Round" ADD COLUMN "gameSessionId" TEXT;
ALTER TABLE "PokerHand" ADD COLUMN "gameSessionId" TEXT;
ALTER TABLE "LedgerEntry" ADD COLUMN "gameSessionId" TEXT;

CREATE UNIQUE INDEX "Table_currentGameSessionId_key" ON "Table"("currentGameSessionId");
CREATE UNIQUE INDEX "GameSessionParticipant_gameSessionId_memberId_key" ON "GameSessionParticipant"("gameSessionId", "memberId");
CREATE INDEX "GameSessionParticipant_verifiedUserId_resultRecordedAt_idx" ON "GameSessionParticipant"("verifiedUserId", "resultRecordedAt");

ALTER TABLE "Table" ADD CONSTRAINT "Table_currentGameSessionId_fkey" FOREIGN KEY ("currentGameSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameSessionParticipant" ADD CONSTRAINT "GameSessionParticipant_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameSessionParticipant" ADD CONSTRAINT "GameSessionParticipant_verifiedUserId_fkey" FOREIGN KEY ("verifiedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PokerHand" ADD CONSTRAINT "PokerHand_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "GameSession" (
  "id",
  "tableId",
  "tableName",
  "gameType",
  "status",
  "startingJetonsMillis",
  "stakeType",
  "currencyCode",
  "minorUnitsPerJeton",
  "startedAt"
)
SELECT
  "id",
  "id",
  "name",
  "game",
  CASE
    WHEN "status" = 'ARCHIVED' THEN 'COMPLETED'::"GameSessionStatus"
    WHEN "setupCompletedAt" IS NULL THEN 'SETUP'::"GameSessionStatus"
    ELSE 'ACTIVE'::"GameSessionStatus"
  END,
  "startingJetonsPerPlayerMillis",
  'MONEY'::"StakeType",
  'GBP',
  100,
  "createdAt"
FROM "Table";

UPDATE "Table"
SET "currentGameSessionId" = "id"
WHERE "currentGameSessionId" IS NULL;

INSERT INTO "GameSessionParticipant" (
  "id",
  "gameSessionId",
  "memberId",
  "verifiedUserId",
  "displayName",
  "playedAsDealer",
  "startingBalanceMillis"
)
SELECT
  "TableMember"."id",
  "TableMember"."tableId",
  "TableMember"."id",
  CASE WHEN "User"."isGuest" THEN NULL ELSE "User"."id" END,
  COALESCE(NULLIF("User"."name", ''), split_part("User"."email", '@', 1), 'Player'),
  "TableMember"."isBankDealer",
  "TableMember"."availableMillis"
FROM "TableMember"
JOIN "User" ON "User"."id" = "TableMember"."userId";

UPDATE "Round" SET "gameSessionId" = "tableId" WHERE "gameSessionId" IS NULL;
UPDATE "PokerHand" SET "gameSessionId" = "tableId" WHERE "gameSessionId" IS NULL;
UPDATE "LedgerEntry" SET "gameSessionId" = "tableId" WHERE "tableId" IS NOT NULL AND "gameSessionId" IS NULL;
