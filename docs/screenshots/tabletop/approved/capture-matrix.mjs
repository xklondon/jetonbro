/**
 * Acceptance-matrix capture for approved Tabletop visuals. Audit/capture only.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3011";
const out = path.join(process.cwd(), "docs/screenshots/tabletop/approved");
const compareDir = path.join(process.cwd(), "docs/screenshots/tabletop/compare-approved");
const crops = path.join(process.cwd(), "docs/screenshots/tabletop/approved-crops");
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(compareDir, { recursive: true });

async function openAs(context, page, email, name) {
  const response = await page.request.post(`${baseURL}/api/dev/session`, { data: { email, name } });
  const data = await response.json();
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: data.sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function noOverflow(page) {
  for (const [w, h] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    const ok = await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= window.innerHeight + 2 &&
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
    );
    if (!ok) throw new Error(`overflow at ${w}x${h}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

async function shot(page, name) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, `${name}-390x844.png`) });
}

async function compare(name, targetCrop) {
  const current = path.join(out, `${name}-390x844.png`);
  const target = path.join(crops, targetCrop);
  if (!fs.existsSync(current) || !fs.existsSync(target)) return null;
  const [tBuf, cBuf] = await Promise.all([
    sharp(target).resize(390, 844, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(current).resize(390, 844, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const n = Math.min(tBuf.data.length, cBuf.data.length);
  let sumSq = 0;
  const diff = Buffer.alloc(n);
  const overlay = Buffer.alloc(n);
  for (let i = 0; i < n; i += 4) {
    const dr = Math.abs(tBuf.data[i] - cBuf.data[i]);
    const dg = Math.abs(tBuf.data[i + 1] - cBuf.data[i + 1]);
    const db = Math.abs(tBuf.data[i + 2] - cBuf.data[i + 2]);
    const mag = Math.min(255, dr + dg + db);
    diff[i] = mag;
    diff[i + 1] = mag;
    diff[i + 2] = mag;
    diff[i + 3] = 255;
    overlay[i] = Math.round((tBuf.data[i] + cBuf.data[i]) / 2);
    overlay[i + 1] = Math.round((tBuf.data[i + 1] + cBuf.data[i + 1]) / 2);
    overlay[i + 2] = Math.round((tBuf.data[i + 2] + cBuf.data[i + 2]) / 2);
    overlay[i + 3] = 255;
    sumSq += dr * dr + dg * dg + db * db;
  }
  const rmse = Math.sqrt(sumSq / ((n / 4) * 3));
  await sharp(diff, { raw: { width: 390, height: 844, channels: 4 } })
    .png()
    .toFile(path.join(compareDir, `${name}-diff.png`));
  await sharp(overlay, { raw: { width: 390, height: 844, channels: 4 } })
    .png()
    .toFile(path.join(compareDir, `${name}-overlay.png`));
  await sharp({ create: { width: 796, height: 844, channels: 3, background: "#04110d" } })
    .composite([
      { input: await sharp(target).resize(390, 844).png().toBuffer(), top: 0, left: 0 },
      { input: await sharp(current).resize(390, 844).png().toBuffer(), top: 0, left: 406 },
    ])
    .png()
    .toFile(path.join(compareDir, `${name}-side-by-side.png`));
  return { name, rmse: Number(rmse.toFixed(2)) };
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await openAs(context, page, `viz-${randomUUID()}@jetonbro.test`, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/`);
  await page.getByRole("button", { name: /CREATE/i }).first().waitFor();
  await shot(page, "01-home");
  await noOverflow(page);

  await page.getByRole("button", { name: /CREATE/i }).first().click();
  await page.waitForURL(/\/tables\//);
  await shot(page, "02-create-table");

  // Start table
  const nameInput = page.locator('input[name="name"], input[aria-label*="name" i], input[placeholder*="name" i]').first();
  if (await nameInput.count()) await nameInput.fill("Approved Table");
  await page.getByRole("button", { name: /START TABLE/i }).click();
  await page.getByRole("button", { name: "START BETTING" }).waitFor({ timeout: 20000 });
  await shot(page, "03-dealer-phase0-empty");

  const guestUrl = await page.locator("main").getAttribute("data-guest-join-url");
  if (!guestUrl) throw new Error("missing guest join url");
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await guestPage.goto(`${baseURL}${new URL(guestUrl, baseURL).pathname}`);
  await guestPage.getByLabel("Play name").fill("Casey");
  await guestPage.getByRole("button", { name: "Join table" }).click();
  await guestPage.waitForURL(/\/tables\//);
  await page.waitForTimeout(800);
  await page.reload();
  await expectEnabled(page, "START BETTING");
  await shot(page, "04-dealer-phase0-joined");
  await guestPage.reload();
  await shot(guestPage, "05-player-phase0");

  await page.getByRole("button", { name: "START BETTING" }).click();
  await page.locator("[data-phase-heading]").filter({ hasText: /Betting/i }).waitFor({ timeout: 15000 });
  await shot(page, "06-dealer-betting");
  await guestPage.reload();
  await guestPage.locator("[data-phase-heading]").filter({ hasText: /Betting/i }).waitFor({ timeout: 15000 });
  await shot(guestPage, "07-player-betting-empty");
  await guestPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await guestPage.waitForFunction(() => {
    const el = document.querySelector("[data-box-id] .tt-pbox-stake, [data-box-id] .tt-amount, [data-wallet-available]");
    return el && /25|75/.test(el.textContent || "");
  }, null, { timeout: 10000 }).catch(() => {});
  await guestPage.waitForTimeout(400);
  await shot(guestPage, "08-player-betting-25");

  await page.getByRole("button", { name: "DEAL CARDS" }).click({ timeout: 20000 });
  await page.locator("[data-phase-heading]").filter({ hasText: /PLAYING/i }).waitFor({ timeout: 15000 });
  await shot(page, "09-dealer-playing");
  await guestPage.reload();
  await guestPage.getByRole("button", { name: "2×" }).waitFor({ timeout: 15000 });
  await shot(guestPage, "10-player-playing");

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await page.locator("[data-phase-heading], .tt-phase-display").filter({ hasText: /INSURANCE/i }).first().waitFor({ timeout: 10000 });
  await shot(page, "11-dealer-insurance");
  await guestPage.reload();
  await shot(guestPage, "12-player-insurance");

  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click().catch(() => {});
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await page.locator("[data-phase-heading]").filter({ hasText: /PAYOUT/i }).waitFor({ timeout: 15000 });
  await shot(page, "13-dealer-payout-unresolved");
  const won = page.getByRole("button", { name: "WON" }).first();
  await won.click();
  await page.getByRole("button", { name: "START BETTING" }).waitFor({ state: "visible" });
  await expectEnabled(page, "START BETTING");
  await shot(page, "14-dealer-payout-resolved");
  await guestPage.reload();
  await shot(guestPage, "15-player-payout");

  // Poker smoke via switch if available
  try {
    await page.getByRole("button", { name: "Menu" }).click();
    const switchGame = page.getByRole("button", { name: /SWITCH GAME|Texas|POKER/i }).first();
    if (await switchGame.count()) {
      await switchGame.click();
      await page.getByRole("button", { name: /Texas|POKER|Hold/i }).first().click().catch(() => {});
      await page.waitForTimeout(1000);
      await shot(page, "16-poker-dealer-smoke");
      await guestPage.reload();
      await shot(guestPage, "17-poker-player-smoke");
    } else {
      await page.keyboard.press("Escape").catch(() => {});
      await shot(page, "16-poker-dealer-smoke");
      await shot(guestPage, "17-poker-player-smoke");
    }
  } catch {
    await shot(page, "16-poker-dealer-smoke");
    await shot(guestPage, "17-poker-player-smoke");
  }

  const metrics = [];
  for (const [name, crop] of [
    ["06-dealer-betting", "dealer-betting-390x844.png"],
    ["09-dealer-playing", "dealer-playing-390x844.png"],
    ["11-dealer-insurance", "dealer-insurance-390x844.png"],
    ["13-dealer-payout-unresolved", "dealer-payout-390x844.png"],
    ["07-player-betting-empty", "player-betting-390x844.png"],
    ["10-player-playing", "player-playing-390x844.png"],
    ["12-player-insurance", "player-insurance-390x844.png"],
    ["15-player-payout", "player-payout-390x844.png"],
    ["01-home", "setup-home-390x844.png"],
    ["02-create-table", "setup-create-390x844.png"],
  ]) {
    metrics.push(await compare(name, crop));
  }
  fs.writeFileSync(path.join(compareDir, "metrics.json"), JSON.stringify(metrics.filter(Boolean), null, 2));
  await guestContext.close();
  await browser.close();
  console.log(JSON.stringify({ ok: true, metrics: metrics.filter(Boolean) }, null, 2));
}

async function expectEnabled(page, name) {
  await page.getByRole("button", { name }).waitFor({ state: "visible", timeout: 20000 });
  // may still be enabling via poll
  for (let i = 0; i < 20; i++) {
    if (await page.getByRole("button", { name }).isEnabled()) return;
    await page.waitForTimeout(400);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
