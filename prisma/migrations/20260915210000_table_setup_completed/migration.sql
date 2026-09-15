-- AlterTable
ALTER TABLE "Table" ADD COLUMN "setupCompletedAt" TIMESTAMP(3);

-- Existing tables already completed the previous create/start flow.
UPDATE "Table" SET "setupCompletedAt" = "createdAt" WHERE "setupCompletedAt" IS NULL;

-- One open TABLE_SETUP draft per owner
CREATE UNIQUE INDEX "Table_one_open_draft_per_owner" ON "Table" ("ownerId")
WHERE "setupCompletedAt" IS NULL AND "currentPhase" = 'TABLE_SETUP' AND "status" = 'SETUP';
