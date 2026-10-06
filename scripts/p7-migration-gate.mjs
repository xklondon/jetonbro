import { execFileSync, execSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

// --- Clean database ---
recreate("p7_clean");
sh("npx prisma migrate deploy", { DATABASE_URL: `${baseUrl}/p7_clean` });
assert(query("p7_clean", `SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'StakeType' AND e.enumlabel = 'FUN_ONLY';`) === "1", "FUN_ONLY enum");
assert(query("p7_clean", `SELECT column_default FROM information_schema.columns WHERE table_name = 'GameSession' AND column_name = 'stakeType';`).includes("FUN_ONLY"), "default FUN_ONLY");
assert(query("p7_clean", `SELECT 1 FROM information_schema.columns WHERE table_name = 'GameSession' AND column_name = 'moneyBuyInMinorUnits';`) === "1", "buy-in column");
psql(
  "p7_clean",
  `INSERT INTO "User" (id, email, name, "isGuest", "createdAt", "updatedAt")
   VALUES ('u-owner', 'p7-clean-owner@jetonbro.test', 'Alex', false, NOW(), NOW());`,
);
mkdirSync(join(root, "tmp"), { recursive: true });
writeFileSync(
  join(root, "tmp", "p7-create-table.mjs"),
  `
import { createTable } from "../src/application/services/tables.ts";
import { prisma } from "../src/application/db.ts";
const created = await createTable({
  actorId: "u-owner",
  idempotencyKey: "p7-clean-create",
  name: "Clean fun table",
  game: "BLACKJACK",
  startingJetonsPerPlayer: "100",
  emails: [],
});
const session = await prisma.gameSession.findFirstOrThrow({ where: { tableId: created.tableId } });
if (session.stakeType !== "FUN_ONLY") throw new Error("expected FUN_ONLY default, got " + session.stakeType);
await prisma.$disconnect();
console.log("created", created.tableId, session.stakeType);
`,
);
sh("npx tsx tmp/p7-create-table.mjs", { DATABASE_URL: `${baseUrl}/p7_clean` });
console.log("clean migrate + FUN_ONLY default: ok");

// --- Production-schema database (through Prompt 6) then forward ---
const p6Dir = join(root, "tmp", "p7-p6-schema");
rmSync(p6Dir, { recursive: true, force: true });
mkdirSync(join(p6Dir, "prisma", "migrations"), { recursive: true });
cpSync(join(root, "prisma", "schema.prisma"), join(p6Dir, "prisma", "schema.prisma"));
// Temporary schema without FUN_ONLY / moneyBuyIn for apply-through-p6 validation uses SQL-only folder
for (const name of readdirSync(join(root, "prisma", "migrations"))) {
  if (name === "migration_lock.toml") {
    cpSync(join(root, "prisma", "migrations", name), join(p6Dir, "prisma", "migrations", name));
    continue;
  }
  if (name.startsWith("20261006180000") || name.startsWith("20261006180100")) continue;
  cpSync(join(root, "prisma", "migrations", name), join(p6Dir, "prisma", "migrations", name), { recursive: true });
}
// Use Prompt 6 schema snapshot from git if available; else strip enum from current schema for migrate
writeFileSync(
  join(p6Dir, "prisma", "schema.prisma"),
  sh("git show aef48671433a6bde379faebeadddb4d309dd0978:prisma/schema.prisma"),
);

recreate("p7_prod");
sh(`npx prisma migrate deploy --schema "${join(p6Dir, "prisma", "schema.prisma")}"`, { DATABASE_URL: `${baseUrl}/p7_prod` });
assert(query("p7_prod", `SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'StakeType' AND e.enumlabel = 'FUN_ONLY';`) === "", "no FUN_ONLY yet");

psql(
  "p7_prod",
  `
INSERT INTO "User" (id, email, name, "isGuest", "createdAt", "updatedAt")
VALUES ('u-alex', 'p7-alex@jetonbro.test', 'Alex', false, NOW(), NOW());
INSERT INTO "Table" (id, name, game, status, "ownerId", "bankDealerId", "startingJetonsPerPlayerMillis", "currentPhase", "joinEnabled", "createdAt", "updatedAt")
VALUES ('t-money', 'Money table', 'BLACKJACK', 'SETUP', 'u-alex', 'u-alex', 100000, 'TABLE_SETUP', true, NOW(), NOW());
INSERT INTO "GameSession" (id, "tableId", "tableName", "gameType", status, "startedAt", "startingJetonsMillis", "stakeType", "currencyCode", "minorUnitsPerJeton")
VALUES ('s-money', 't-money', 'Money table', 'BLACKJACK', 'SETUP', NOW(), 100000, 'MONEY', 'GBP', 100);
UPDATE "Table" SET "currentGameSessionId" = 's-money' WHERE id = 't-money';
INSERT INTO "GameSession" (id, "tableId", "tableName", "gameType", status, "startedAt", "startingJetonsMillis", "stakeType", "customUnitLabel", "jetonsPerCustomUnit")
VALUES ('s-custom', 't-money', 'Custom table', 'BLACKJACK', 'COMPLETED', NOW(), 100000, 'CUSTOM', 'Dinner', 50);
`,
);
const moneyBefore = query("p7_prod", `SELECT "stakeType" || '|' || COALESCE("currencyCode",'') || '|' || COALESCE("minorUnitsPerJeton"::text,'') FROM "GameSession" WHERE id = 's-money';`);
assert(moneyBefore === "MONEY|GBP|100", `money fixture ${moneyBefore}`);

sh(`npx prisma migrate deploy --schema "${join(root, "prisma", "schema.prisma")}"`, { DATABASE_URL: `${baseUrl}/p7_prod` });
sh(`npx prisma migrate deploy --schema "${join(root, "prisma", "schema.prisma")}"`, { DATABASE_URL: `${baseUrl}/p7_prod` });

assert(query("p7_prod", `SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'StakeType' AND e.enumlabel = 'FUN_ONLY';`) === "1", "FUN_ONLY after forward");
assert(query("p7_prod", `SELECT 1 FROM information_schema.columns WHERE table_name = 'GameSession' AND column_name = 'moneyBuyInMinorUnits';`) === "1", "buy-in after forward");
const moneyAfter = query("p7_prod", `SELECT "stakeType" || '|' || COALESCE("currencyCode",'') || '|' || COALESCE("minorUnitsPerJeton"::text,'') || '|' || COALESCE("moneyBuyInMinorUnits"::text,'') FROM "GameSession" WHERE id = 's-money';`);
assert(moneyAfter === "MONEY|GBP|100|", `money unchanged ${moneyAfter}`);
const customAfter = query("p7_prod", `SELECT "stakeType" || '|' || COALESCE("customUnitLabel",'') || '|' || COALESCE("jetonsPerCustomUnit"::text,'') FROM "GameSession" WHERE id = 's-custom';`);
assert(customAfter === "CUSTOM|Dinner|50", `custom unchanged ${customAfter}`);

console.log("P7_MIGRATION_GATE_OK");
