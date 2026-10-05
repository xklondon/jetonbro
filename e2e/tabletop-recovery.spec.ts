import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  expectNoDocumentScroll,
  openAs,
  setupJoinUrl,
  uniqueEmail,
} from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "recovery");

async function snapshot(page: Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<{
    setup?: { canStartBetting?: boolean };
    player?: { available: { label: string } };
    bank?: { boxes: { id: string }[] };
  }>;
}

async function shot(page: Page, name: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-skin="tabletop"]')).toBeVisible();
  await expectNoDocumentScroll(page);
  await page.screenshot({ path: join(shots, `${name}-390x844.png`) });
}

test("recovery: restore visible controls through Guest join and a Blackjack round", async ({ page, context, browser }) => {
  test.setTimeout(240_000);
  await mkdir(shots, { recursive: true });
  const ownerEmail = uniqueEmail("rec-owner");
  const guestName = "Casey";

  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Recovery Table", { starting: "100" });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD PLAYER" }).first()).toBeVisible();
  await shot(page, "01-dealer-phase0-empty");

  const guestUrl = await setupJoinUrl(page, "guest");
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await guestPage.goto(new URL(guestUrl).pathname);
  await guestPage.getByLabel("Play name").fill(guestName);
  await guestPage.getByRole("button", { name: "Join table" }).click();
  await expect(guestPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await expect(page.getByText(guestName).first()).toBeVisible({ timeout: 20_000 });

  await expect.poll(async () => (await snapshot(page)).setup?.canStartBetting).toBe(true);
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await shot(page, "02-dealer-phase0-joined");
  await guestPage.reload();
  await expect(guestPage.getByText(/Waiting for the table to open betting/i).first()).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await shot(guestPage, "03-guest-phase0");

  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Betting open");
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD PLAYER" }).first()).toBeVisible();
  await shot(page, "04-dealer-betting");

  await guestPage.reload();
  await expect(guestPage.locator("[data-phase-heading]")).toHaveText("Betting is open.");
  await expect(guestPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(guestPage.locator("[data-player-wallet]")).toContainText("100");
  await expect(guestPage.getByRole("button", { name: "PLACE BET" })).toBeVisible();
  await shot(guestPage, "05-player-betting");

  await guestPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(guestPage)).player?.available.label).toBe("75");
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await expect(page.getByRole("button", { name: "ENTER PAYOUT" })).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN INSURANCE" })).toBeVisible();
  await shot(page, "06-dealer-playing");

  await guestPage.reload();
  await expect(guestPage.getByRole("button", { name: "2×" })).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "SPLIT" })).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "INSURANCE", exact: true })).toBeVisible();
  await shot(guestPage, "07-player-playing");

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.locator('[data-payout-action="true"]').first()).toBeVisible();
  await shot(page, "08-dealer-payout");

  const boxId = (await snapshot(page)).bank?.boxes[0]?.id;
  await page.locator(boxId ? `[data-box-id="${boxId}"]` : "[data-blackjack-box-row]").getByRole("button", { name: "WON" }).first().click();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 10_000 });

  await guestPage.reload();
  await expect(guestPage.getByRole("button", { name: "2×" })).toHaveCount(0);
  await expect(guestPage.locator("[data-player-wallet]")).toBeVisible();
  await shot(guestPage, "09-player-payout");

  await guestContext.close();
});
