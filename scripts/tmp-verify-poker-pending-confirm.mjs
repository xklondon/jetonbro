/**
 * Gate: Premium Poker pending chip stack → CONFIRM (raise-to), pot chip sum, ME seat.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { randomUUID } from "node:crypto";

const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3010";
const out = pathJoin(process.cwd(), "docs/screenshots/premium/poker-pending-confirm");
mkdirSync(out, { recursive: true });

async function openAs(ctx, page, email, name) {
  const r = await page.request.post(`${base}/api/dev/session`, { data: { email, name } });
  if (!r.ok()) throw new Error(`session ${r.status()} ${await r.text()}`);
  const data = await r.json();
  await ctx.addCookies([
    {
      name: "authjs.session-token",
      value: data.sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return data;
}

async function cmd(page, tableId, command, extra = {}) {
  const r = await page.request.post(`${base}/api/tables/${tableId}/commands`, {
    data: { command, idempotencyKey: randomUUID(), ...extra },
  });
  return { status: r.status(), body: await r.json().catch(() => ({})) };
}

async function snapshot(page, tableId) {
  const r = await page.request.get(`${base}/api/tables/${tableId}/snapshot`);
  if (!r.ok()) throw new Error(`snapshot ${r.status()}`);
  return r.json();
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const consoles = document.querySelectorAll('[data-casino-console="true"]');
    const potAmount = document.querySelector("[data-pot-amount]")?.getAttribute("data-pot-amount") ?? null;
    const potChipSum = document.querySelector("[data-pot-chip-sum]")?.getAttribute("data-pot-chip-sum") ?? null;
    const pending = document.querySelector('[data-pending-stack="true"]');
    const confirm = document.querySelector('button[data-poker-confirm="true"]');
    const chip10 = document.querySelector('button[aria-label="Add 10 jetons"]');
    const actions = document.querySelector("[data-console-actions]");
    return {
      consoleCount: consoles.length,
      potAmount,
      potChipSum,
      hasPending: Boolean(pending),
      pendingTotal: pending?.querySelector("[data-pending-total]")?.getAttribute("data-pending-total") ?? null,
      hasConfirm: Boolean(confirm),
      confirmLabel: (confirm?.textContent || "").replace(/\s+/g, " ").trim(),
      confirmDisabled: confirm?.disabled ?? null,
      chip10Disabled: chip10?.disabled ?? null,
      actionsText: (actions?.textContent || "").replace(/\s+/g, " ").trim(),
      hasSeatMe: Boolean(document.querySelector('[data-seat-me="true"]')),
    };
  });
}

const failures = [];
const check = (ok, msg) => {
  if (!ok) failures.push(msg);
};

const browser = await chromium.launch();
const stamp = Date.now();
const report = { base, ok: true, steps: [], shots: [] };

try {
  const ownerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await ownerCtx.newPage();
  const ownerUser = await openAs(ownerCtx, owner, `pend-own-${stamp}@t.test`, "Bank");
  await owner.goto(`${base}/tables/new`);
  await owner.waitForURL(/\/tables\/(?!new)/);
  const tableId = owner.url().split("/tables/")[1].split("?")[0];

  await cmd(owner, tableId, "updateSettings", {
    name: "Pending Confirm",
    startingJetonsPerPlayer: "100",
    game: "POKER",
    smallBlind: "5",
    bigBlind: "10",
  });
  await cmd(owner, tableId, "finalizeSetup", {
    name: "Pending Confirm",
    startingJetonsPerPlayer: "100",
    game: "POKER",
    bankFundingMode: "OPEN",
    startingBank: "",
    smallBlind: "5",
    bigBlind: "10",
    hostName: "Bank",
    seatOrder: ownerUser.userId,
  });
  await owner.goto(`${base}/tables/${tableId}`, { waitUntil: "domcontentloaded" });
  const setupSnap = await snapshot(owner, tableId);
  const guestToken = new URL(setupSnap.setup.guestJoinUrl).pathname.split("/").pop();

  const playerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const player = await playerCtx.newPage();
  const join = await (
    await player.request.post(`${base}/api/join/guest/${guestToken}`, { data: { playName: "Vi" } })
  ).json();
  await player.goto(`${base}/tables/${join.tableId}`, { waitUntil: "domcontentloaded" });
  const pSnap = await snapshot(player, tableId);
  await cmd(owner, tableId, "giveJetons", { userId: setupSnap.viewerId, amount: "100" });
  await cmd(owner, tableId, "giveJetons", { userId: pSnap.viewerId, amount: "100" });
  await cmd(owner, tableId, "startTexasHoldem");
  await owner.goto(`${base}/tables/${tableId}`, { waitUntil: "domcontentloaded" });
  await player.goto(`${base}/tables/${tableId}`, { waitUntil: "domcontentloaded" });
  await owner.waitForTimeout(600);

  const hand = await snapshot(owner, tableId);
  const actorIsOwner = hand.poker?.currentActorId === hand.viewerId;
  const actorPage = actorIsOwner ? owner : player;
  const waiterPage = actorIsOwner ? player : owner;
  const actorBefore = hand.poker?.currentActorId;

  const acting0 = await pageMetrics(actorPage);
  check(acting0.consoleCount === 1, `acting console count ${acting0.consoleCount}`);
  check(acting0.hasSeatMe, "acting missing data-seat-me");
  check(acting0.potAmount != null && acting0.potChipSum === acting0.potAmount, `pot sum ${acting0.potChipSum} vs amount ${acting0.potAmount}`);
  await actorPage.screenshot({ path: pathJoin(out, "01-acting-390.png"), fullPage: false });
  report.shots.push("01-acting-390.png");

  const chip10 = actorPage.locator('button[aria-label="Add 10 jetons"]');
  check(!(await chip10.isDisabled()), "acting chip10 disabled before clicks");
  await chip10.click();
  await chip10.click();
  await actorPage.waitForTimeout(300);

  const actingPending = await pageMetrics(actorPage);
  check(actingPending.hasPending, "acting missing pending stack after chip clicks");
  check(actingPending.hasConfirm, "acting missing CONFIRM after chip clicks");
  check(/CONFIRM/i.test(actingPending.confirmLabel), `confirm label ${actingPending.confirmLabel}`);
  check(!actingPending.confirmDisabled, "CONFIRM disabled with legal pending total");
  await actorPage.screenshot({ path: pathJoin(out, "02-acting-pending-390.png"), fullPage: false });
  report.shots.push("02-acting-pending-390.png");

  await actorPage.locator('button[data-poker-confirm="true"]').click();
  await owner.waitForTimeout(800);

  let actorAfter = actorBefore;
  for (let i = 0; i < 12; i++) {
    const snap = await snapshot(owner, tableId);
    actorAfter = snap.poker?.currentActorId;
    if (actorAfter && actorAfter !== actorBefore) break;
    await owner.waitForTimeout(400);
  }
  check(actorAfter !== actorBefore, `turn did not advance (${actorBefore} → ${actorAfter})`);

  const nowActorPage = actorAfter === setupSnap.viewerId ? owner : player;
  const nowWaiterPage = nowActorPage === owner ? player : owner;

  const waiting = await pageMetrics(nowWaiterPage);
  check(waiting.chip10Disabled === true, "waiting chip10 not disabled");
  check(!waiting.hasConfirm, "waiting shows CONFIRM");
  await nowWaiterPage.screenshot({ path: pathJoin(out, "03-waiting-390.png"), fullPage: false });
  report.shots.push("03-waiting-390.png");

  await nowActorPage.setViewportSize({ width: 1280, height: 800 });
  await nowActorPage.goto(`${base}/tables/${tableId}`, { waitUntil: "domcontentloaded" });
  await nowActorPage.waitForTimeout(500);
  await nowActorPage.screenshot({ path: pathJoin(out, "04-acting-desktop.png"), fullPage: false });
  report.shots.push("04-acting-desktop.png");

  await nowWaiterPage.setViewportSize({ width: 1280, height: 800 });
  await nowWaiterPage.goto(`${base}/tables/${tableId}`, { waitUntil: "domcontentloaded" });
  await nowWaiterPage.waitForTimeout(500);
  await nowWaiterPage.screenshot({ path: pathJoin(out, "05-waiting-desktop.png"), fullPage: false });
  report.shots.push("05-waiting-desktop.png");

  await owner.setViewportSize({ width: 390, height: 844 });
  await player.setViewportSize({ width: 390, height: 844 });

  for (const [label, page, file] of [
    ["dealer", owner, "06-dealer-hole-entry-390.png"],
    ["player", player, "07-player-hole-entry-390.png"],
  ]) {
    await page.bringToFront();
    const menu = page.getByRole("button", { name: "Menu" });
    check(!(await menu.isDisabled()), `${label} menu disabled`);
    await menu.click({ timeout: 8000 });
    await page.waitForSelector('[data-poker-card-tools="true"]', { timeout: 8000 });
    await page.locator('[data-edit-hole="true"]').click({ timeout: 5000 });
    await page.waitForSelector('[data-poker-card-sheet="Hole cards"]', { timeout: 8000 });
    await page.screenshot({ path: pathJoin(out, file), fullPage: false });
    report.shots.push(file);
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.locator('[data-poker-card-sheet="Hole cards"]').waitFor({ state: "hidden", timeout: 3000 }).catch(() => undefined);
  }

  report.steps.push({
    actorIsOwner,
    actorBefore,
    actorAfter,
    acting0,
    actingPending,
    waiting,
  });
  report.ok = failures.length === 0;
  report.failures = failures;
  writeFileSync(pathJoin(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, failures, out }, null, 2));
  if (!report.ok) process.exit(1);
} catch (e) {
  report.ok = false;
  report.error = String(e);
  report.failures = failures;
  writeFileSync(pathJoin(out, "report.json"), JSON.stringify(report, null, 2));
  console.error(e);
  process.exit(1);
} finally {
  await browser.close();
}
