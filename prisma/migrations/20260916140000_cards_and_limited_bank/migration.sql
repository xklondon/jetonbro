-- CreateEnum
CREATE TYPE "CardAssistMode" AS ENUM ('OFF', 'CONFIRM', 'AUTO');

-- CreateEnum
CREATE TYPE "BankFundingMode" AS ENUM ('OPEN', 'LIMITED');

-- AlterEnum
ALTER TYPE "LedgerTransactionType" ADD VALUE 'BANK_FUNDING';
ALTER TYPE "LedgerTransactionType" ADD VALUE 'BANK_FUNDING_ADJUSTMENT';
ALTER TYPE "LedgerTransactionType" ADD VALUE 'BANK_EXPOSURE_RESERVED';
ALTER TYPE "LedgerTransactionType" ADD VALUE 'BANK_EXPOSURE_RELEASED';
ALTER TYPE "LedgerTransactionType" ADD VALUE 'BANK_STAKE_TAKE';
ALTER TYPE "LedgerTransactionType" ADD VALUE 'BANK_PAYOUT';

-- AlterTable
ALTER TABLE "Table" ADD COLUMN "cardAssist" "CardAssistMode" NOT NULL DEFAULT 'OFF';
ALTER TABLE "Table" ADD COLUMN "bankFundingMode" "BankFundingMode" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Table" ADD COLUMN "bankAvailableMillis" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Table" ADD COLUMN "bankLockedExposureMillis" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Table" ADD COLUMN "startingBankMillis" BIGINT;

ALTER TABLE "Round" ADD COLUMN "dealerRanks" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Round" ADD COLUMN "dealerCompletedAt" TIMESTAMP(3);

ALTER TABLE "BettingBox" ADD COLUMN "ranks" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "BettingBox" ADD COLUMN "handCompletedAt" TIMESTAMP(3);
ALTER TABLE "BettingBox" ADD COLUMN "exposureReservedMillis" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "InsuranceBet" ADD COLUMN "exposureReservedMillis" BIGINT NOT NULL DEFAULT 0;

ALTER TABLE "LedgerEntry" ALTER COLUMN "playerId" DROP NOT NULL;
