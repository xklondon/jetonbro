import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createPokerTable,
  expectNoPageScroll,
  noHorizontalOverflow,
  openAs,
  openSetupSheet,
  setupJoinUrl,
  uniqueEmail,
} from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "live-repair");

async function shot(page: Page, name: string) {
  await mkdir(out, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => undefined);
  await page.screenshot({ path: join(out, name) });
}

async function tableSnapshot(page: Page) {
  const response = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{
    viewerId: string;
    isOwner: boolean;
    isDealer: boolean;
    isSeatedPlayer: boolean;
    isGuest?: boolean;
    seatedPlayerCount: number;
    canStartBetting: boolean;
    phase: string;
    player?: { available: { label: string }; boxes: { id: string; bet: { label: string } }[] } | null;
    bank?: { players: { name: string; available: { label: string }; locked: { label: string } }[] } | null;
  }>;
}

test("isolated Guest cookie selects Player board and enables START BETTING", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await openAs(context, page, uniqueEmail("live-owner"), "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await openSetupSheet(page);
  await page.getByLabel("Table name").fill("Live Repair");
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "GUEST QR" })).toBeVisible();
  await expect(page.locator(".sheet.open")).toHaveCount(0);
  await expectNoPageScroll(page);
  await noHorizontalOverflow(page);
  await shot(page, "01-create-table-inline-390x844.png");

  await page.getByRole("tab", { name: "GUEST QR" }).click();
  await expect(page.getByAltText("Guest QR — no email")).toBeVisible();
  await expect(page.getByAltText("Verified QR — email confirmation")).toHaveCount(0);
  await expectNoPageScroll(page);
  await shot(page, "02-guest-qr-inline-390x844.png");
  const guestUrl = await setupJoinUrl(page, "guest");

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await guestPage.goto(new URL(guestUrl).pathname);
  await expect(guestPage.getByText("Join without email")).toBeVisible();
  await guestPage.getByLabel("Play name").fill("Casey");
  await guestPage.getByRole("button", { name: "Join table" }).click();
  await expect(guestPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  const joinedAt = Date.now();
  const guestCookies = await guestContext.cookies();
  expect(guestCookies.some((cookie) => cookie.name === "jetonbro.guest" && cookie.httpOnly && cookie.path === "/")).toBe(true);
  expect(guestCookies.some((cookie) => cookie.name === "authjs.session-token")).toBe(false);

  await expect(page.locator("[data-player-row]").filter({ hasText: "Casey" })).toBeVisible({ timeout: 2000 });
  expect(Date.now() - joinedAt).toBeLessThan(2000);

  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator("[data-table-board=PHASE_ZERO_DEALER]")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "ADD PLAYER" })).toBeVisible();
  await shot(page, "04-dealer-phase0-open-betting-390x844.png");

  await guestPage.reload();
  await expect(guestPage.locator("[data-table-board=PHASE_ZERO_PLAYER]")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await expect(guestPage.getByText("YOUR JETONS")).toBeVisible();
  const guestSnap = await tableSnapshot(guestPage);
  expect(guestSnap.isOwner).toBe(false);
  expect(guestSnap.isDealer).toBe(false);
  expect(guestSnap.isSeatedPlayer).toBe(true);
  expect(guestSnap.isGuest).toBe(true);
  const ownerSnap = await tableSnapshot(page);
  expect(ownerSnap.isOwner).toBe(true);
  expect(ownerSnap.isDealer).toBe(true);
  expect(ownerSnap.isSeatedPlayer).toBe(false);
  expect(ownerSnap.canStartBetting).toBe(true);
  expect(ownerSnap.seatedPlayerCount).toBe(1);
  await shot(guestPage, "03-guest-phase0-390x844.png");

  const bettingStarted = Date.now();
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-table-board=BLACKJACK_DEALER]")).toBeVisible({ timeout: 2000 });
  await expect.poll(async () => (await tableSnapshot(guestPage)).phase, { timeout: 2000 }).toBe("BETTING");
  expect(Date.now() - bettingStarted).toBeLessThan(2000);
  await guestPage.reload();
  await expect(guestPage.locator("[data-table-board=BLACKJACK_PLAYER]")).toBeVisible();
  await guestPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect(guestPage.locator("[data-player-wallet]")).toContainText("75", { timeout: 20_000 });
  await expect.poll(async () => {
    const snap = await tableSnapshot(page);
    const casey = snap.bank?.players.find((player) => player.name === "Casey");
    return casey ? `${casey.available.label}/${casey.locked.label}` : "";
  }).toBe("75/25");
  await shot(guestPage, "05-guest-betting-390x844.png");
  await shot(page, "06-dealer-betting-390x844.png");
  await guestContext.close();
});

test("verified join uses the Player board", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await openAs(context, page, uniqueEmail("live-verified-owner"), "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await openSetupSheet(page);
  await page.getByLabel("Table name").fill("Verified Live");
  await page.getByLabel("Table name").blur();
  const verifiedUrl = await setupJoinUrl(page, "verified");
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await openAs(playerContext, playerPage, uniqueEmail("live-verified-player"), "Sam");
  await playerPage.goto(new URL(verifiedUrl).pathname);
  await expect(playerPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await playerPage.reload();
  await expect(playerPage.locator("[data-table-board=PHASE_ZERO_PLAYER]")).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await playerContext.close();
});

test("Poker smoke keeps Owner and Player boards distinct", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await openAs(context, page, uniqueEmail("live-poker-owner"), "Alex");
  await createPokerTable(page, "Live Poker", { starting: "100" });
  const joinUrl = await setupJoinUrl(page, "verified");
  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, uniqueEmail("live-poker-sam"), "Sam");
  await samPage.goto(new URL(joinUrl).pathname);
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "START HAND", exact: true }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PRE-FLOP", { timeout: 20_000 });
  await samPage.reload();
  await expect(samPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(samPage.getByRole("button", { name: "START HAND", exact: true })).toHaveCount(0);
  await samContext.close();
});
