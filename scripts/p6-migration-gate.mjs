import { execFileSync, execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = "postgresql://jetonbro:jetonbro@127.0.0.1:55433";

function sh(command, env = {}) {
  console.log(`$ ${command}`);
  try {
    return execSync(command, {
      cwd: root,
      env: { ...process.env, ...env },
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    const err = error;
    throw new Error(`${command}\n${err.stdout ?? ""}${err.stderr ?? err.message}`);
  }
}

function psql(db, statements) {
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "jetonbro", "-d", db, "-v", "ON_ERROR_STOP=1"], {
    cwd: root,
    input: statements,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function query(db, statement) {
  return execFileSync(
    "docker",
    ["compose", "exec", "-T", "postgres", "psql", "-U", "jetonbro", "-d", db, "-At", "-c", statement],
    { cwd: root, encoding: "utf8" },
  ).trim();
}

function recreate(name) {
  try {
    psql("postgres", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${name}' AND pid <> pg_backend_pid();`);
  } catch {
    /* ignore */
  }
  psql("postgres", `DROP DATABASE IF EXISTS ${name}; CREATE DATABASE ${name};`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

sh("docker compose up -d postgres");

recreate("p6_clean");
sh("npx prisma migrate deploy", { DATABASE_URL: `${baseUrl}/p6_clean` });
psql(
  "p6_clean",
  `INSERT INTO "User" (id, email, name, "isGuest", "createdAt", "updatedAt")
   VALUES ('u-owner', 'p6-clean-owner@jetonbro.test', 'Alex', false, NOW(), NOW());`,
);
mkdirSync(join(root, "tmp"), { recursive: true });
writeFileSync(
  join(root, "tmp", "p6-create-table.mjs"),
  `
import { createTable } from "../src/application/services/tables.ts";
import { prisma } from "../src/application/db.ts";
const created = await createTable({
  actorId: "u-owner",
  idempotencyKey: "p6-clean-create",
  name: "Clean session table",
  game: "BLACKJACK",
  startingJetonsPerPlayer: "100",
  emails: [],
});
const sessions = await prisma.gameSession.count({ where: { tableId: created.tableId } });
const table = await prisma.table.findUniqueOrThrow({ where: { id: created.tableId } });
if (sessions !== 1 || !table.currentGameSessionId) {
  throw new Error("initial GameSession missing");
}
await prisma.$disconnect();
console.log("created", created.tableId, table.currentGameSessionId);
`,
);
sh("npx tsx tmp/p6-create-table.mjs", { DATABASE_URL: `${baseUrl}/p6_clean` });
console.log("clean migrate + initial GameSession: ok");

const preDir = join(root, "tmp", "p6-pre-migrate");
rmSync(preDir, { recursive: true, force: true });
mkdirSync(join(preDir, "prisma", "migrations"), { recursive: true });
writeFileSync(join(preDir, "prisma", "schema.prisma"), sh("git show 9ff89cb:prisma/schema.prisma"));
for (const name of [
  "20260915124100_init",
  "20260915130000_player_account",
  "20260915180000_blackjack_table_settings",
  "20260915190000_starting_jetons_per_player",
  "20260915193000_betting_close_deadline",
  "20260915210000_table_setup_completed",
  "20260915220000_next_round_and_table_close",
  "20260916140000_cards_and_limited_bank",
  "20260916180000_poker_and_game_switch",
  "20260918010000_poker_optional_cards",
  "20261001120000_guest_identity",
  "20261001120100_guest_invites",
]) {
  cpSync(join(root, "prisma", "migrations", name), join(preDir, "prisma", "migrations", name), { recursive: true });
}
cpSync(join(root, "prisma", "migrations", "migration_lock.toml"), join(preDir, "prisma", "migrations", "migration_lock.toml"));

recreate("p6_legacy");
sh(`npx prisma migrate deploy --schema "${join(preDir, "prisma", "schema.prisma")}"`, { DATABASE_URL: `${baseUrl}/p6_legacy` });

psql(
  "p6_legacy",
  `
INSERT INTO "User" (id, email, name, "emailVerified", "isGuest", "createdAt", "updatedAt") VALUES
  ('u-alex', 'p6-alex@jetonbro.test', 'Alex', NOW(), false, NOW(), NOW()),
  ('u-blair', 'p6-blair@jetonbro.test', 'Blair', NOW(), false, NOW(), NOW()),
  ('u-casey', 'p6-casey-guest@guest.invalid', 'Casey', NULL, true, NOW(), NOW()),
  ('u-other', 'p6-other-owner@jetonbro.test', 'Drew', NOW(), false, NOW(), NOW());

INSERT INTO "Table" (id, name, game, status, "ownerId", "bankDealerId", "startingJetonsPerPlayerMillis", "currentPhase", "joinEnabled", "setupCompletedAt", "createdAt", "updatedAt") VALUES
  ('t-draft', 'Draft BJ', 'BLACKJACK', 'SETUP', 'u-alex', 'u-alex', 100000, 'TABLE_SETUP', true, NULL, NOW(), NOW()),
  ('t-bet', 'Active BJ', 'BLACKJACK', 'ACTIVE', 'u-alex', 'u-blair', 100000, 'BETTING', true, NOW(), NOW(), NOW()),
  ('t-done', 'Completed BJ', 'BLACKJACK', 'ACTIVE', 'u-alex', 'u-alex', 100000, 'ROUND_COMPLETE', true, NOW(), NOW(), NOW()),
  ('t-poker', 'Saved Poker', 'POKER', 'ARCHIVED', 'u-alex', 'u-alex', 100000, 'TABLE_SETUP', false, NOW(), NOW(), NOW()),
  ('t-other', 'Other Owner', 'BLACKJACK', 'SETUP', 'u-other', 'u-other', 100000, 'TABLE_SETUP', true, NOW(), NOW(), NOW());

INSERT INTO "TableMember" (id, "tableId", "userId", "isOwner", "isBankDealer", "availableMillis", "startingJetonsCredited") VALUES
  ('m-draft-alex', 't-draft', 'u-alex', true, true, 0, true),
  ('m-bet-alex', 't-bet', 'u-alex', true, false, 80000, true),
  ('m-bet-blair', 't-bet', 'u-blair', false, true, 0, true),
  ('m-bet-casey', 't-bet', 'u-casey', false, false, 75000, true),
  ('m-done-alex', 't-done', 'u-alex', true, true, 0, true),
  ('m-done-casey', 't-done', 'u-casey', false, false, 125000, true),
  ('m-poker-alex', 't-poker', 'u-alex', true, true, 90000, true),
  ('m-poker-blair', 't-poker', 'u-blair', false, false, 110000, true),
  ('m-other-drew', 't-other', 'u-other', true, true, 0, true);

INSERT INTO "Invitation" (id, "tableId", kind, token, "expiresAt", "createdById") VALUES
  ('i-bet-guest', 't-bet', 'GUEST', 'p6-guest-token', NOW() + INTERVAL '7 days', 'u-alex'),
  ('i-bet-qr', 't-bet', 'QR', 'p6-verified-token', NOW() + INTERVAL '7 days', 'u-alex');

INSERT INTO "Round" (id, "tableId", number, phase) VALUES
  ('r-bet', 't-bet', 1, 'BETTING'),
  ('r-done', 't-done', 1, 'ROUND_COMPLETE');
UPDATE "Table" SET "currentRoundId" = 'r-bet' WHERE id = 't-bet';
UPDATE "Table" SET "currentRoundId" = 'r-done' WHERE id = 't-done';

INSERT INTO "BettingBox" (id, "roundId", "playerId", "boxNumber", "displayLabel", "originalStakeMillis", "lockedBetMillis", outcome, "returnedMillis") VALUES
  ('b-bet', 'r-bet', 'u-casey', 1, 'YOUR BOX 1', 25000, 25000, NULL, NULL),
  ('b-done', 'r-done', 'u-casey', 1, 'YOUR BOX 1', 25000, 0, 'WON', 50000);

INSERT INTO "PokerSeat" (id, "tableId", "playerId", "orderIndex") VALUES
  ('s-alex', 't-poker', 'u-alex', 0),
  ('s-blair', 't-poker', 'u-blair', 1);

INSERT INTO "PokerHand" (id, "tableId", number, phase, "dealerPlayerId", "smallBlindPlayerId", "bigBlindPlayerId", "completedAt") VALUES
  ('h-poker', 't-poker', 1, 'HAND_COMPLETE', 'u-alex', 'u-blair', 'u-alex', NOW());

INSERT INTO "PokerParticipant" (id, "handId", "playerId", "seatOrder", status, "isDealer", "isSmallBlind", "isBigBlind") VALUES
  ('pp-alex', 'h-poker', 'u-alex', 0, 'ACTIVE', true, false, true),
  ('pp-blair', 'h-poker', 'u-blair', 1, 'ACTIVE', false, true, false);

INSERT INTO "LedgerEntry" (id, "playerId", "tableId", "roundId", "boxId", "pokerHandId", "transactionType", "amountMillis", "balanceBeforeMillis", "balanceAfterMillis", "actorId", "idempotencyKey", description) VALUES
  ('l-init-casey', 'u-casey', 't-bet', NULL, NULL, NULL, 'INITIAL_ALLOCATION', 100000, 0, 100000, 'u-alex', 'p6-init-casey', 'start'),
  ('l-bet', 'u-casey', 't-bet', 'r-bet', 'b-bet', NULL, 'BET_LOCKED', 25000, 100000, 75000, 'u-casey', 'p6-lock-casey', 'bet'),
  ('l-win', 'u-casey', 't-done', 'r-done', 'b-done', NULL, 'BET_WIN_RETURN', 50000, 75000, 125000, 'u-alex', 'p6-win-casey', 'win'),
  ('l-poker', 'u-blair', 't-poker', NULL, NULL, 'h-poker', 'POKER_POT_AWARD', 20000, 90000, 110000, 'u-alex', 'p6-poker-award', 'award');
`,
);

const before =
  query("p6_legacy", `SELECT COUNT(*) FROM "Table";`) +
  "|" +
  query("p6_legacy", `SELECT SUM("availableMillis") FROM "TableMember";`) +
  "|" +
  query("p6_legacy", `SELECT COUNT(*) FROM "LedgerEntry";`) +
  "|" +
  query("p6_legacy", `SELECT COUNT(*) FROM "Invitation" WHERE "revokedAt" IS NULL;`);

sh(`npx prisma migrate deploy --schema "${join(root, "prisma", "schema.prisma")}"`, { DATABASE_URL: `${baseUrl}/p6_legacy` });
sh(`npx prisma migrate deploy --schema "${join(root, "prisma", "schema.prisma")}"`, { DATABASE_URL: `${baseUrl}/p6_legacy` });

assert(query("p6_legacy", `SELECT COUNT(*) FROM "Table";`) === "5", "table count");
assert(query("p6_legacy", `SELECT COUNT(*) FROM "GameSession";`) === "5", "session count");
assert(query("p6_legacy", `SELECT COUNT(*) FROM "Table" WHERE "currentGameSessionId" = id;`) === "5", "currentGameSessionId");
assert(query("p6_legacy", `SELECT COUNT(*) FROM "GameSession" WHERE id <> "tableId";`) === "0", "id collision");
assert(query("p6_legacy", `SELECT COUNT(*) FROM "Round" WHERE "gameSessionId" IS NULL;`) === "0", "round FK");
assert(query("p6_legacy", `SELECT COUNT(*) FROM "PokerHand" WHERE "gameSessionId" IS NULL;`) === "0", "hand FK");
assert(query("p6_legacy", `SELECT COUNT(*) FROM "LedgerEntry" WHERE "tableId" IS NOT NULL AND "gameSessionId" IS NULL;`) === "0", "ledger FK");
const after =
  query("p6_legacy", `SELECT COUNT(*) FROM "Table";`) +
  "|" +
  query("p6_legacy", `SELECT SUM("availableMillis") FROM "TableMember";`) +
  "|" +
  query("p6_legacy", `SELECT COUNT(*) FROM "LedgerEntry";`) +
  "|" +
  query("p6_legacy", `SELECT COUNT(*) FROM "Invitation" WHERE "revokedAt" IS NULL;`);
assert(before === after, `balances changed ${before} vs ${after}`);
assert(query("p6_legacy", `SELECT COUNT(*) FROM "LedgerEntry" WHERE "transactionType"::text IN ('GAME_SESSION_OPEN','GAME_SESSION_CLOSE');`) === "0", "duplicate allocations");
assert(query("p6_legacy", `SELECT COUNT(*) FROM "Invitation" WHERE token = 'p6-guest-token' AND "revokedAt" IS NULL;`) === "1", "invite");
assert(query("p6_legacy", `SELECT COUNT(*) FROM "Table" WHERE id = 't-other';`) === "1", "other owner");

psql(
  "p6_legacy",
  `
UPDATE "LedgerEntry" SET "tableId" = NULL, "roundId" = NULL, "boxId" = NULL, "pokerHandId" = NULL WHERE id = 'l-init-casey';
UPDATE "GameSession" SET "tableId" = NULL WHERE id = 't-draft';
`,
);
assert(query("p6_legacy", `SELECT COUNT(*) FROM "LedgerEntry" WHERE id = 'l-init-casey' AND "tableId" IS NULL;`) === "1", "wipe ledger");
assert(query("p6_legacy", `SELECT COUNT(*) FROM "GameSession" WHERE id = 't-draft' AND "tableId" IS NULL;`) === "1", "wipe session");

console.log("pre-Prompt-5 migrate deploy: ok");
console.log("P6_MIGRATION_GATE_OK");
