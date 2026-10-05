/**
 * Final Blackjack polish screenshot matrix (390×844) + overflow checks.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3011";
const out = path.join(process.cwd(), "docs/screenshots/tabletop/blackjack-final-polish");
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
    if (!ok) {
      const metrics = await page.evaluate(() => ({
        sh: document.documentElement.scrollHeight,
        ih: window.innerHeight,
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      throw new Error(`overflow at ${w}x${h}: ${JSON.stringify(metrics)}`);
    }
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
  await page.waitForTimeout(200);
}

async function settle(page, boxIndex, label) {
  const row = page.locator("[data-blackjack-box-row=true]").nth(boxIndex);
  await row.locator(`[data-payout-action=true]`).filter({ hasText: new RegExp(`^${label}$`) }).click();
  await page.waitForTimeout(350);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await openAs(context, page, `polish-${randomUUID()}@jetonbro.test`, "Dee");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/`);
  await page.getByRole("button", { name: /CREATE/i }).first().waitFor();
  await page.getByRole("button", { name: /CREATE/i }).first().click();
  await page.waitForURL(/\/tables\//);
  await page.getByRole("button", { name: /START TABLE/i }).waitFor({ timeout: 20000 });
  await shot(page, "11-create-table-collapsed");
  await noOverflow(page);

  await page.getByRole("tab", { name: "GUEST QR" }).click();
  await page.getByAltText("Guest QR — no email").waitFor({ timeout: 10000 });
  await shot(page, "12-create-table-guest-qr");

  await page.getByRole("tab", { name: "VERIFIED QR" }).click();
  await page.getByAltText("Verified QR — email confirmation").waitFor({ timeout: 10000 });
  await shot(page, "13-create-table-verified-qr");

  await page.getByRole("tab", { name: "EMAIL" }).click();
  await page.getByLabel("Player email").waitFor();
  await shot(page, "14-create-table-email");

  const nameInput = page.getByLabel("Table name");
  await nameInput.fill("Polish Table");
  await nameInput.blur();
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
  await page.reload();
  await page.getByRole("button", { name: "START BETTING" }).click();
  await page.locator("[data-phase-heading]").filter({ hasText: /Betting/i }).waitFor({ timeout: 15000 });
  await guestPage.reload();
  await guestPage.locator("[data-phase-heading]").filter({ hasText: /Betting/i }).waitFor({ timeout: 15000 });
  await guestPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await guestPage.waitForTimeout(300);
  await guestPage.getByRole("button", { name: /ADD BOX/i }).click();
  await guestPage.waitForTimeout(300);
  await guestPage.locator("[data-box-id]").nth(1).click();
  await guestPage.getByRole("button", { name: "Add 10 jetons" }).click();
  await guestPage.waitForTimeout(400);

  await page.getByRole("button", { name: "DEAL CARDS" }).click({ timeout: 20000 });
  await page.locator("[data-phase-heading]").filter({ hasText: /PLAYING/i }).waitFor({ timeout: 15000 });
  await guestPage.reload();
  await guestPage.getByRole("button", { name: "2×" }).waitFor({ timeout: 15000 });
  await guestPage.locator("[data-box-id]").first().click();
  await addCard(guestPage, "10");
  await addCard(guestPage, "3");
  await shot(guestPage, "10-playing-hard-13");
  await noOverflow(guestPage);

  await page.reload();
  await page.getByRole("button", { name: "+ CARD" }).first().click();
  await page.getByRole("button", { name: "K", exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "+ CARD" }).first().click();
  await page.getByRole("button", { name: "7", exact: true }).click();
  await page.waitForTimeout(200);

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await page.locator("[data-phase-heading]").filter({ hasText: /PAYOUT/i }).waitFor({ timeout: 15000 });
  await shot(page, "01-dealer-payout-unresolved");
  await noOverflow(page);

  await settle(page, 0, "WON");
  await shot(page, "02-dealer-payout-partial");

  await settle(page, 1, "LOST");
  await shot(page, "03-dealer-payout-won-lost");
  await guestPage.reload();
  await shot(guestPage, "06-player-won");
  // second box lost — capture player with both if possible
  await shot(guestPage, "07-player-lost");

  // Fresh round for STAND OFF + BLACKJACK samples via static settle on new table flow is heavy;
  // use second guest round from START BETTING.
  await page.getByRole("button", { name: "START BETTING" }).click({ timeout: 15000 });
  await page.locator("[data-phase-heading]").filter({ hasText: /Betting/i }).waitFor({ timeout: 15000 });
  await guestPage.reload();
  await guestPage.locator("[data-phase-heading]").filter({ hasText: /Betting/i }).waitFor({ timeout: 15000 });
  await guestPage.locator("[data-box-id]").first().click();
  await guestPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await guestPage.waitForTimeout(300);
  if (await guestPage.getByRole("button", { name: /ADD BOX/i }).count()) {
    await guestPage.getByRole("button", { name: /ADD BOX/i }).click();
    await guestPage.waitForTimeout(250);
    await guestPage.locator("[data-box-id]").nth(1).click();
    await guestPage.getByRole("button", { name: "Add 25 jetons" }).click();
    await guestPage.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "DEAL CARDS" }).click({ timeout: 20000 });
  await page.locator("[data-phase-heading]").filter({ hasText: /PLAYING/i }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await page.locator("[data-phase-heading]").filter({ hasText: /PAYOUT/i }).waitFor({ timeout: 15000 });
  await settle(page, 0, "STAND OFF");
  await shot(page, "04-dealer-payout-stand-off");
  await guestPage.reload();
  await shot(guestPage, "08-player-stand-off");

  const rows = page.locator("[data-blackjack-box-row=true]");
  if ((await rows.count()) > 1) await settle(page, 1, "BLACKJACK");
  else await settle(page, 0, "BLACKJACK");
  await shot(page, "05-dealer-payout-blackjack");
  await guestPage.reload();
  await shot(guestPage, "09-player-blackjack");

  await guestContext.close();
  await browser.close();
  console.log(JSON.stringify({ ok: true, out }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
