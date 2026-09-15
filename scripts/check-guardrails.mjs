#!/usr/bin/env node
/**
 * JetonBro architectural guardrails.
 * Fails closed. Do not weaken these checks to make CI pass.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function fail(message) {
  errors.push(message);
}

function exists(relPath) {
  return existsSync(join(root, relPath));
}

function read(relPath) {
  return readFileSync(join(root, relPath), "utf8");
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") {
        continue;
      }
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

if (!exists(".cursorfile")) {
  fail(".cursorfile is missing from the repository root.");
} else if (read(".cursorfile").trim().length === 0) {
  fail(".cursorfile exists but is empty.");
}

if (!exists("design/reference/classic")) {
  fail("Classic reference directory design/reference/classic/ is missing.");
} else {
  const classicFiles = walk(join(root, "design/reference/classic"));
  if (classicFiles.length === 0) {
    fail("Classic reference directory exists but contains no files.");
  }
  const hasHtml = classicFiles.some((file) => file.endsWith("jetonbro-player-bank-insurance.html"));
  if (!hasHtml) {
    fail("design/reference/classic/jetonbro-player-bank-insurance.html is missing.");
  }
}

const requiredPaths = [
  "CHANGELOG.md",
  "docs/architecture/CURSOR_GUARDRAILS.md",
  "src/domain/blackjack",
  "src/domain/ledger",
  "src/domain/tables",
  "src/domain/invitations",
  "src/ui/core",
  "src/ui/skins/classic",
  "src/ui/skins/registry.ts",
  "scripts/check-guardrails.mjs",
];

for (const relPath of requiredPaths) {
  if (!exists(relPath)) {
    fail(`Required path is missing: ${relPath}`);
  }
}

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"]);
const domainFiles = walk(join(root, "src/domain")).filter((file) =>
  sourceExtensions.has(extname(file)),
);
const skinFiles = walk(join(root, "src/ui/skins")).filter((file) =>
  sourceExtensions.has(extname(file)),
);

const skinImport = /from\s+['"][^'"]*ui\/skins(?:\/|['"])|require\(\s*['"][^'"]*ui\/skins/;
for (const file of domainFiles) {
  const source = readFileSync(file, "utf8");
  if (skinImport.test(source) || source.includes("ui/skins/classic") || source.includes("skins/classic/")) {
    fail(`Domain file imports a skin: ${relative(root, file)}`);
  }
}

const dbImport =
  /from\s+['"][^'"]*(?:@prisma\/client|prisma\/client|node:pg|['"]pg['"])|require\(\s*['"](?:@prisma\/client|prisma|pg)['"]/;
const prismaUsage = /\bprisma\.(user|table|round|ledgerEntry|bettingBox|insuranceBet)\b/;
for (const file of skinFiles) {
  const source = readFileSync(file, "utf8");
  if (dbImport.test(source) || prismaUsage.test(source)) {
    fail(`Skin file imports or uses database access: ${relative(root, file)}`);
  }
}

const bannedDependencyPattern =
  /\b(stripe|paypal|braintree|square-nodejs|coinbase|bitcoin|ethereum|web3|ethers|solana|viem|wagmi|crypto-js|card-deck|playing-cards|poker-evaluator|pokersolver|blackjack-strategy|chance|random-js|seedrandom)\b/i;

if (exists("package.json")) {
  const pkg = JSON.parse(read("package.json"));
  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  };
  for (const name of Object.keys(deps)) {
    if (bannedDependencyPattern.test(name)) {
      fail(`Prohibited dependency introduced: ${name}`);
    }
  }
}

const lockCandidates = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];
for (const lockfile of lockCandidates) {
  if (!exists(lockfile)) continue;
  const lock = read(lockfile);
  if (bannedDependencyPattern.test(lock)) {
    fail(`Prohibited dependency appears in ${lockfile}.`);
  }
}

const enabledGameFiles = [
  "src/domain/games.ts",
  "src/domain/tables/games.ts",
  "src/domain/blackjack/games.ts",
];
let sawEnabledGames = false;
for (const relPath of enabledGameFiles) {
  if (!exists(relPath)) continue;
  sawEnabledGames = true;
  const source = read(relPath);
  const enabledMatch = source.match(/ENABLED_GAMES\s*=\s*\[([^\]]*)\]/s);
  if (!enabledMatch) {
    fail(`${relPath} must export ENABLED_GAMES as an array.`);
    continue;
  }
  const enabled = enabledMatch[1]
    .split(",")
    .map((part) => part.replace(/['"`]/g, "").trim())
    .filter(Boolean);
  const disallowed = enabled.filter((game) => game !== "BLACKJACK");
  if (disallowed.length > 0) {
    fail(`Games other than Blackjack are enabled: ${disallowed.join(", ")}`);
  }
  if (!enabled.includes("BLACKJACK")) {
    fail("ENABLED_GAMES must include BLACKJACK.");
  }
}

const srcFiles = walk(join(root, "src")).filter((file) => sourceExtensions.has(extname(file)));
for (const file of srcFiles) {
  const rel = relative(root, file).replaceAll("\\", "/");
  if (rel.startsWith("src/domain/") || rel.startsWith("src/application/")) {
    const source = readFileSync(file, "utf8");
    if (
      /id:\s*["'](POKER|ZILCH)["'][\s\S]{0,120}available:\s*true/.test(source) ||
      /playable:\s*true[\s\S]{0,80}(POKER|ZILCH)|(POKER|ZILCH)[\s\S]{0,80}playable:\s*true/.test(source)
    ) {
      fail(`A game other than Blackjack appears enabled in ${rel}`);
    }
  }
}

if (errors.length > 0) {
  console.error("JetonBro guardrails failed:\n");
  for (const error of errors) {
    console.error(` - ${error}`);
  }
  process.exit(1);
}

console.log("JetonBro guardrails passed.");
