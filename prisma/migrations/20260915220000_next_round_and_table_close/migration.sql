-- AlterTable
ALTER TABLE "Round" ADD COLUMN "nextRoundDeadlineAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Table" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "Table" ADD COLUMN "closedAt" TIMESTAMP(3);
