-- AlterEnum
ALTER TYPE "InvitationKind" ADD VALUE 'GUEST';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "guestTableId" TEXT;

CREATE INDEX "User_guestTableId_idx" ON "User"("guestTableId");
