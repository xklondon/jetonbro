import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  decodeQrDataUrl,
  expectNoPageScroll,
  noHorizontalOverflow,
  openAs,
  openInviteMask,
  openSetupSheet,
  setupJoinUrl,
  uniqueEmail,
} from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "prompt-10");

async function shot(page: Page, name: string) {
  await mkdir(out, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => undefined);
  await page.screenshot({ path: join(out, name) });
}

async function joinAsGuestOnPage(page: Page, url: string, playName: string) {
  await page.goto(new URL(url).pathname);
  await expect(page.getByText("Join without email")).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toHaveCount(0);
  await page.getByLabel("Play name").fill(playName);
  await page.getByRole("button", { name: "Join table" }).click();
  await expect(page).toHaveURL(/\/tables\//, { timeout: 20_000 });
}

function localAppUrl(url: string) {
  const base = (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  return url.replace(/^https?:\/\/[^/]+/, base);
}

function expectPublicVerifiedInvite(url: string) {
  const decoded = decodeURIComponent(url);
  expect(decoded).toMatch(/\/join\/verified\//);
  expect(url).not.toMatch(/railway\.internal/i);
}

async function expectJoinedName(page: Page, name: string) {
  await expect(page.locator("[data-player-row]").filter({ hasText: name }).first()).toBeVisible({ timeout: 20_000 });
}

test("guest QR: second device joins by play name and enables OPEN BETTING", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("guest-owner");
  await openAs(context, page, ownerEmail, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await openSetupSheet(page);
  await page.getByLabel("Table name").fill("Two Phone Guest");
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();
  await expect(page.getByRole("tab", { name: "GUEST QR" })).toBeVisible();
  await expect(page.getByAltText("Guest QR — no email")).toHaveCount(0);
  await expect(page.getByAltText("Verified QR — email confirmation")).toHaveCount(0);
  await expect(page.locator(".setup-mask")).toHaveCount(0);
  await expectNoPageScroll(page);
  const guestUrl = await setupJoinUrl(page, "guest");
  const verifiedUrl = await setupJoinUrl(page, "verified");
  expect(guestUrl).toContain("/join/guest/");
  expect(verifiedUrl).toContain("/join/verified/");
  expect(guestUrl).not.toBe(verifiedUrl);
  expect(guestUrl).not.toMatch(/localhost|railway\.internal/i);
  expect(verifiedUrl).not.toMatch(/localhost|railway\.internal/i);
  await shot(page, "01-create-table-invites-390x844.png");
  await openInviteMask(page);
  await page.getByRole("tab", { name: "GUEST QR" }).click();
  await expect(page.getByAltText("Guest QR — no email")).toBeVisible();
  await expect(page.getByAltText("Verified QR — email confirmation")).toHaveCount(0);
  const guestSrc = await page.getByAltText("Guest QR — no email").getAttribute("src");
  expect(decodeQrDataUrl(guestSrc!)).toBe(guestUrl);
  await shot(page, "02-guest-qr-390x844.png");
  await page.getByRole("tab", { name: "VERIFIED QR" }).click();
  await expect(page.getByAltText("Verified QR — email confirmation")).toBeVisible();
  await expect(page.getByAltText("Guest QR — no email")).toHaveCount(0);
  const verifiedSrc = await page.getByAltText("Verified QR — email confirmation").getAttribute("src");
  expect(decodeQrDataUrl(verifiedSrc!)).toBe(verifiedUrl);
  await shot(page, "03-verified-qr-390x844.png");
  const closeInvite = page.locator(".invite-mask, .sheet.open").getByRole("button", { name: "Close" });
  if (await closeInvite.count()) {
    await closeInvite.first().click();
    await expect(page.locator(".sheet.open")).toHaveCount(0);
  }

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await guestPage.goto(new URL(guestUrl).pathname);
  await expect(guestPage.getByText("Join without email")).toBeVisible();
  await shot(guestPage, "05-guest-play-name-join-390x844.png");
  await guestPage.getByLabel("Play name").fill("Casey");
  await guestPage.getByRole("button", { name: "Join table" }).click();
  await expect(guestPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await expect(guestPage.getByText(/Waiting for the (Dealer|table) to open betting|WAITING FOR PLAYERS|Waiting for the Bank/i).first()).toBeVisible({ timeout: 20_000 });
  await expectJoinedName(page, "Casey");

  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByText("Waiting for Players to join.")).toHaveCount(0);
  await page.locator("main.tt-felt, main.felt").evaluate((node) => node.scrollTo(0, 0));
  await shot(page, "06-phase0-owner-joined-390x844.png");
  await guestPage.reload();
  await shot(guestPage, "07-phase0-guest-player-390x844.png");
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await guestPage.reload();
  await expect(guestPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await guestPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect(guestPage.locator("[data-player-wallet]")).toContainText("75", { timeout: 20_000 });
  await expect(guestPage.locator(".player-box, .box, [data-box-stage], .tt-box, .tt-pbox").first()).toContainText("25");
  await expect(page.locator("[data-box-stage=true] [data-box-id]").first()).toContainText("25", {
    timeout: 20_000,
  });
  await shot(page, "08-bj-dealer-betting-390x844.png");
  await shot(guestPage, "09-bj-player-betting-390x844.png");
  await page.reload();
  await guestPage.reload();
  await expect(guestPage.locator("[data-player-wallet]")).toContainText("75");
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await expect(guestPage.getByRole("button", { name: "DEAL CARDS" })).toHaveCount(0);
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await guestPage.reload();
  await expect(guestPage.getByRole("button", { name: "2×" })).toBeVisible();
  await shot(page, "10-bj-dealer-playing-390x844.png");
  await shot(guestPage, "11-bj-player-playing-390x844.png");
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.locator(".payout-reveal")).toHaveCount(0);
  await page.locator('[data-payout-action="true"]').filter({ hasText: /^WIN$/ }).click();
  await guestPage.reload();
  await expect(guestPage.getByRole("button", { name: "2×" })).toHaveCount(0);
  await shot(page, "12-bj-dealer-payout-390x844.png");
  await shot(guestPage, "13-bj-player-payout-390x844.png");
  await noHorizontalOverflow(page);
  await noHorizontalOverflow(guestPage);
  await guestContext.close();
});

test("verified QR uses magic link and joins the intended table once", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("ver-owner");
  const playerEmail = uniqueEmail("ver-player");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Verified QR table", { starting: "100" });
  const verifiedUrl = await setupJoinUrl(page, "verified");
  expect(verifiedUrl).toContain("/join/verified/");

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await playerPage.goto(new URL(verifiedUrl).pathname);
  await expect(playerPage.getByText("Verified player")).toBeVisible();
  await playerPage.getByPlaceholder("Email").fill(playerEmail);
  await playerPage.getByRole("button", { name: "Email me a link" }).click();
  await expect(playerPage.getByText(/link is on its way/i)).toBeVisible();
  const mailbox = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(playerEmail)}`);
  const mail = (await mailbox.json()) as { messages: { url?: string }[] };
  const magic = mail.messages.find((item) => item.url)?.url;
  expect(magic).toBeTruthy();
  expectPublicVerifiedInvite(magic!);
  await playerPage.goto(localAppUrl(magic!));
  await expect(playerPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await expectJoinedName(page, playerEmail.split("@")[0]!);
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await playerPage.reload();
  await expect(playerPage).toHaveURL(/\/tables\//);
  await expect(playerPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await playerContext.close();
});

test("email invitation uses the verified path and joins the intended table", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("mail-owner");
  const playerEmail = uniqueEmail("mail-player");
  await openAs(context, page, ownerEmail, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await openSetupSheet(page);
  await page.getByLabel("Table name").fill("Email invite table");
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();
  await openInviteMask(page);
  await page.getByRole("tab", { name: /EMAIL/i }).click();
  await page.getByLabel("Player email").fill(playerEmail);
  await page.getByRole("button", { name: "SEND INVITE" }).click();
  await expect(page.getByText("Pending").first()).toBeVisible();
  await page.getByText("Pending").first().scrollIntoViewIfNeeded();
  await shot(page, "04-email-invite-rows-390x844.png");
  const mailbox = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(playerEmail)}`);
  const mail = (await mailbox.json()) as { messages: { url?: string }[] };
  const inviteUrl = mail.messages.find((item) => item.url)?.url;
  expect(inviteUrl).toBeTruthy();
  expect(inviteUrl).toContain("/join/verified/");
  expect(inviteUrl).not.toMatch(/localhost|railway\.internal/i);

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await playerPage.goto(new URL(inviteUrl!).pathname);
  await expect(playerPage.getByText("Verified player")).toBeVisible();
  await playerPage.getByRole("button", { name: "Email me a link" }).click();
  await expect(playerPage.getByText(/link is on its way/i)).toBeVisible();
  const magicBox = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(playerEmail)}`);
  const magicMail = (await magicBox.json()) as { messages: { url?: string }[] };
  const magic = magicMail.messages.find((item) => item.url?.includes("/api/auth/callback/"))?.url
    ?? magicMail.messages.find((item) => item.url?.includes("/join/verified/"))?.url;
  expect(magic).toBeTruthy();
  expectPublicVerifiedInvite(magic!);
  await playerPage.goto(localAppUrl(magic!));
  await expect(playerPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await expectJoinedName(page, playerEmail.split("@")[0]!);
  await playerContext.close();
});

test("three roles keep Owner, Dealer, and Player controls separate", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("role-owner");
  const dealerEmail = uniqueEmail("role-dealer");
  await openAs(context, page, ownerEmail, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await openSetupSheet(page);
  await page.getByLabel("Table name").fill("Three role table");
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();
  const guestUrl = await setupJoinUrl(page, "guest");
  const verifiedUrl = await setupJoinUrl(page, "verified");

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await joinAsGuestOnPage(guestPage, guestUrl, "Casey");

  const dealerContext = await browser.newContext();
  const dealerPage = await dealerContext.newPage();
  await dealerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(dealerContext, dealerPage, dealerEmail, "Blair");
  await dealerPage.goto(new URL(verifiedUrl).pathname);
  await expect(dealerPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await expectJoinedName(page, "Blair");
  await page.getByLabel("Dealer").selectOption({ label: "Blair" });
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText(/TABLE SETUP|Table setup/i, { timeout: 20_000 });
  // Owner still mounts BLACKJACK_DEALER at TABLE_SETUP (selectTableBoard); assigned Dealer can start.
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeVisible();
  await dealerPage.reload();
  await expect(dealerPage.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await expect(guestPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await dealerPage.getByRole("button", { name: "START BETTING" }).click();
  await expect(dealerPage.locator("[data-phase-heading]")).toHaveText("BETTING");
  await page.reload();
  await guestPage.reload();
  await expect(page.getByText("YOUR JETONS")).toBeVisible();
  await expect(guestPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(dealerPage.getByRole("button", { name: "DEAL CARDS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toHaveCount(0);
  await expect(guestPage.getByRole("button", { name: "DEAL CARDS" })).toHaveCount(0);
  await guestContext.close();
  await dealerContext.close();
});
