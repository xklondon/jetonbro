import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  expectNoDocumentScroll,
  expectPlayerPayoutIdle,
  openAs,
  openSetupSheet,
  uniqueEmail,
} from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "tabletop");

async function snapshot(page: Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<{
    player?: { available: { label: string }; boxes: { id: string; boxNumber: number; bet: { label: string } }[] };
    bank?: { boxes: { id: string }[]; players?: { userId: string }[] };
    poker?: { phase: string; pot: { label: string } };
    setup?: { joinUrl: string | null };
  }>;
}

async function assertTabletop(page: Page) {
  await expect(page.locator('[data-skin="tabletop"]')).toBeVisible();
  await expect(page.locator(".classic-skin")).toHaveCount(0);
  await expectNoDocumentScroll(page);
}

async function shot(page: Page, name: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await assertTabletop(page);
  await page.screenshot({ path: join(shots, `${name}-390x844.png`) });
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoDocumentScroll(page);
  await page.screenshot({ path: join(shots, `${name}-360x800.png`) });
  await page.setViewportSize({ width: 430, height: 932 });
  await expectNoDocumentScroll(page);
  await page.screenshot({ path: join(shots, `${name}-430x932.png`) });
  await page.setViewportSize({ width: 390, height: 844 });
}

test("Tabletop skin default screens", async ({ page, context, browser }) => {
  test.setTimeout(300_000);
  await mkdir(shots, { recursive: true });
  const ownerEmail = uniqueEmail("tt-owner");
  const playerEmail = uniqueEmail("tt-player");

  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(context, page, ownerEmail, "Alex");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toBeVisible();
  await expect(page.locator('[data-skin="tabletop"]')).toBeVisible();
  await shot(page, "01-home");

  await openSetupSheet(page);
  await page.getByLabel("Table name").fill("K's Table");
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();
  await expect(page.locator('[data-table-board="CREATE_TABLE"]')).toBeVisible();
  await shot(page, "02-create-table");
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator('[data-table-board="PHASE_ZERO_DEALER"]')).toBeVisible({ timeout: 20_000 });
  await shot(page, "03-dealer-phase0");

  const joinPath = new URL((await snapshot(page)).setup!.joinUrl!).pathname;
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(joinPath);
  await expect(playerPage.getByText(/Waiting for the table to open betting/i)).toBeVisible();
  await assertTabletop(playerPage);
  await shot(playerPage, "04-player-phase0");

  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Betting open");
  await playerPage.reload();
  await expect(playerPage.locator("[data-phase-heading]")).toHaveText("Betting is open.");
  await shot(page, "08-dealer-betting");
  await shot(playerPage, "05-player-betting-empty");

  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("75");
  await shot(playerPage, "06-player-betting-placed");

  await playerPage.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.length).toBe(2);
  await shot(playerPage, "07-player-betting-two-boxes");

  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await playerPage.reload();
  await expect(playerPage.getByRole("button", { name: "2×" })).toBeVisible();
  await shot(page, "10-dealer-playing");
  await shot(playerPage, "09-player-playing");

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await playerPage.reload();
  await shot(page, "12-dealer-insurance");
  await shot(playerPage, "11-player-insurance");
  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await shot(page, "14-dealer-payout");
  const boxId = (await snapshot(page)).bank?.boxes[0]?.id;
  await page.locator(boxId ? `[data-box-id="${boxId}"]` : "[data-blackjack-box-row]").getByRole("button", { name: "WON" }).first().click();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 10_000 });
  await playerPage.reload();
  await expectPlayerPayoutIdle(playerPage);
  await shot(playerPage, "13-player-payout");
  await playerContext.close();

  await page.goto("/");
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page).toHaveURL(/\/tables\//);
  await page.getByLabel("Table name").fill("Poker Cloth");
  await page.getByRole("button", { name: /Texas Hold/i }).click();
  await expect(page.locator("[data-selected-game=POKER]")).toBeVisible();
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Table setup", { timeout: 20_000 });
  const pokerJoin = (await snapshot(page)).setup?.joinUrl;
  expect(pokerJoin).toBeTruthy();
  const pokerContext = await browser.newContext();
  const pokerPage = await pokerContext.newPage();
  await pokerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(pokerContext, pokerPage, uniqueEmail("tt-poker"), "Jo");
  await pokerPage.goto(new URL(pokerJoin!).pathname);
  await expect(page.getByText("Jo").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START HAND" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START HAND" }).click();
  await expect(page.locator('[data-table-board="POKER_DEALER"]')).toBeVisible({ timeout: 20_000 });
  await pokerPage.reload();
  await expect(pokerPage.locator('[data-table-board="POKER_PLAYER"]')).toBeVisible({ timeout: 20_000 });
  await shot(page, "16-poker-dealer");
  await shot(pokerPage, "15-poker-player");
  await pokerContext.close();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator('[data-skin="tabletop"]')).toBeVisible();
  await page.screenshot({ path: join(shots, "17-desktop-home.png") });
});
