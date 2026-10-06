-- Uses FUN_ONLY after the prior migration committed the enum value.
ALTER TABLE "GameSession" ADD COLUMN "moneyBuyInMinorUnits" BIGINT;

ALTER TABLE "GameSession" ALTER COLUMN "stakeType" SET DEFAULT 'FUN_ONLY'::"StakeType";
