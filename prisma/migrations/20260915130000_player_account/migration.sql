ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_global_nonnegative";
ALTER TABLE "User" DROP COLUMN IF EXISTS "globalAvailableMillis";

CREATE TABLE "PlayerAccount" (
    "userId" TEXT NOT NULL,
    "globalAvailableMillis" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerAccount_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "PlayerAccount" ADD CONSTRAINT "PlayerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerAccount" ADD CONSTRAINT "PlayerAccount_global_nonnegative" CHECK ("globalAvailableMillis" >= 0);
