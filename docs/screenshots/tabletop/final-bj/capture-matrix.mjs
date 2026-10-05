/**
 * Final Blackjack screenshot matrix (390×844). Capture only — no MATCH claim.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3011";
const out = path.join(process.cwd(), "docs/screenshots/tabletop/final-bj");
fs.mkdirSync(out, { recursive: true });

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

async function addCard(page, rank) {
  await page.getByRole("button", { name: "+ CARD" }).first().click();
  await page.getByRole("button", { name: rank, exact: true }).click();
  await page.waitForTimeout(250);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await openAs(context, page, `final-bj-${randomUUID()}@jetonbro.test`, "Dee");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/`);
  await page.getByRole("button", { name: /CREATE/i }).first().waitFor();

  await page.getByRole("button", { name: /CREATE/i }).first().click();
  await page.waitForURL(/\/tables\//);
  const nameInput = page.locator('input[name="name"], input[aria-label*="name" i], input[placeholder*="name" i]').first();
  if (await nameInput.count()) await nameInput.fill("Final BJ Table");
  await page.getByRole("button", { name: /START TABLE/i }).click();
  await page.getByRole("button", { name: "START BETTING" }).waitFor({ timeout: 20000 });

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
  await page.getByRole("button", { name: "START BETTING" }).click();
  await page.locator("[data-phase-heading]").filter({ hasText: /Betting/i }).waitFor({ timeout: 15000 });
  await guestPage.reload();
  await guestPage.locator("[data-phase-heading]").filter({ hasText: /Betting/i }).waitFor({ timeout: 15000 });

  // Two boxes for Casey
  await guestPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await guestPage.waitForTimeout(400);
  await guestPage.getByRole("button", { name: /ADD BOX/i }).click();
  await guestPage.waitForTimeout(400);
  await guestPage.locator("[data-box-id]").nth(1).click();
  await guestPage.getByRole("button", { name: "Add 10 jetons" }).click();
  await guestPage.waitForTimeout(500);
  await page.reload();
  await shot(page, "01-dealer-betting-two-boxes");
  await noOverflow(page);

  await page.getByRole("button", { name: "DEAL CARDS" }).click({ timeout: 20000 });
  await page.locator("[data-phase-heading]").filter({ hasText: /PLAYING/i }).waitFor({ timeout: 15000 });
  await guestPage.reload();
  await guestPage.getByRole("button", { name: "2×" }).waitFor({ timeout: 15000 });

  // Player cards on box 1
  await guestPage.locator("[data-box-id]").first().click();
  await addCard(guestPage, "A");
  await addCard(guestPage, "9");
  await shot(guestPage, "02-player-playing-cards");
  await noOverflow(guestPage);

  // Dealer hand + second box cards
  await page.reload();
  await page.getByRole("button", { name: "+ CARD" }).first().click();
  await page.getByRole("button", { name: "K", exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "+ CARD" }).first().click();
  await page.getByRole("button", { name: "7", exact: true }).click();
  await page.waitForTimeout(300);
  // Correct second box via CORRECT if present
  const correct = page.getByRole("button", { name: "CORRECT" }).nth(1);
  if (await correct.count()) {
    await correct.click();
    await page.getByRole("button", { name: "+ CARD" }).last().click();
    await page.getByRole("button", { name: "10", exact: true }).click();
    await page.getByRole("button", { name: "+ CARD" }).last().click();
    await page.getByRole("button", { name: "6", exact: true }).click();
  }
  await shot(page, "03-dealer-playing-hand-two-boxes");
  await noOverflow(page);

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await page.locator("[data-phase-heading], .tt-phase-display").filter({ hasText: /INSURANCE/i }).first().waitFor({ timeout: 10000 });
  await shot(page, "05-dealer-insurance");
  await guestPage.reload();
  await shot(guestPage, "04-player-insurance-cards");
  await noOverflow(guestPage);

  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click().catch(() => {});
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await page.locator("[data-phase-heading]").filter({ hasText: /PAYOUT/i }).waitFor({ timeout: 15000 });
  await shot(page, "06-dealer-payout-unresolved");
  await noOverflow(page);

  await page.getByRole("button", { name: "WON" }).first().click();
  await page.waitForTimeout(400);
  await shot(page, "07-dealer-payout-partial");

  const remaining = page.getByRole("button", { name: "LOST" });
  if (await remaining.count()) await remaining.first().click();
  else {
    const stand = page.getByRole("button", { name: "STAND OFF" });
    if (await stand.count()) await stand.first().click();
    else await page.getByRole("button", { name: "WON" }).first().click();
  }
  await page.getByRole("button", { name: "START BETTING" }).waitFor({ state: "visible", timeout: 15000 });
  await shot(page, "08-dealer-payout-resolved");
  await guestPage.reload();
  await shot(guestPage, "09-player-payout-two-boxes");
  await noOverflow(guestPage);

  await guestContext.close();
  await browser.close();
  console.log(JSON.stringify({ ok: true, out }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
