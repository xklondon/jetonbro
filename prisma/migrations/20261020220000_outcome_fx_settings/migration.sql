-- Additive table-owned result animation prefs (defaults: on / occasional).
CREATE TYPE "OutcomeFxFrequency" AS ENUM ('OFF', 'OCCASIONAL', 'OFTEN', 'ALWAYS');

ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS "outcomeFxEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Table" ADD COLUMN IF NOT EXISTS "outcomeFxFrequency" "OutcomeFxFrequency" NOT NULL DEFAULT 'OCCASIONAL';
