-- Next-round Blackjack stakes prepared during PAYOUT / ROUND_COMPLETE.
CREATE TABLE "StagedBlackjackBet" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "boxNumber" INTEGER NOT NULL,
    "amountMillis" BIGINT NOT NULL,
    "preparedFromRoundId" TEXT NOT NULL,
    "appliedToRoundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StagedBlackjackBet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StagedBlackjackBet_tableId_playerId_boxNumber_key" ON "StagedBlackjackBet"("tableId", "playerId", "boxNumber");

CREATE INDEX "StagedBlackjackBet_tableId_preparedFromRoundId_idx" ON "StagedBlackjackBet"("tableId", "preparedFromRoundId");

ALTER TABLE "StagedBlackjackBet" ADD CONSTRAINT "StagedBlackjackBet_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StagedBlackjackBet" ADD CONSTRAINT "StagedBlackjackBet_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
