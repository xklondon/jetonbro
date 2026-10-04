import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, expectNoDocumentScroll, expectPlayerPayoutIdle, openAs, uniqueEmail } from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "blackjack-visual");
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;

async function snapshot(page: Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<{
    player?: { available: { label: string }; boxes: { id: string; boxNumber: number; bet: { label: string }; outcome?: string | null }[] };
    bank?: { boxes: { id: string }[] };
    setup?: { joinUrl: string | null };
    phase?: string;
  }>;
}

async function capture(page: Page, name: string) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectNoDocumentScroll(page);
    await page.screenshot({
      path: join(shots, `${name}-${viewport.width}x${viewport.height}.png`),
    });
  }
}

test("Blackjack visual states at canonical mobile sizes", async ({ page, context, browser }) => {
  test.setTimeout(240_000);
  await mkdir(shots, { recursive: true });
  const ownerEmail = uniqueEmail("visual-owner");
  const playerEmail = uniqueEmail("visual-player");

  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Salon table", { starting: "100" });

  const setup = await snapshot(page);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(joinPath);
  await expect(playerPage.getByText(/Waiting for the table to open betting/i)).toBeVisible();
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });

  await capture(page, "01-owner-dealer-setup");
  await capture(playerPage, "05-player-waiting");

  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Betting open");
  await playerPage.reload();
  await expect(playerPage.locator("[data-phase-heading]")).toHaveText("Betting is open.");
  await capture(page, "02-owner-dealer-betting");
  await capture(playerPage, "06-player-betting-empty");

  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("button", { name: "Change Dealer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change Game" })).toBeVisible();
  await capture(page, "10-owner-menu-betting");
  await page.getByRole("button", { name: "Cancel" }).click();

  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("75");
  await capture(playerPage, "07-player-betting-placed");

  await playerPage.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.length).toBe(2);
  await capture(playerPage, "16-player-betting-two-boxes");

  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await playerPage.reload();
  await expect(playerPage.getByRole("button", { name: "2×" })).toBeVisible();
  await capture(page, "03-dealer-playing");
  await capture(playerPage, "08-player-playing");

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await capture(page, "11-dealer-insurance");
  await playerPage.reload();
  await capture(playerPage, "18-player-insurance");
  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeDisabled();
  await capture(page, "12-dealer-payout-unresolved");
  const boxId = (await snapshot(page)).bank?.boxes[0]?.id;
  await page.locator(boxId ? `[data-box-id="${boxId}"]` : "[data-blackjack-box-row]").getByRole("button", { name: "WON" }).first().click();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 10_000 });
  await playerPage.reload();
  await expectPlayerPayoutIdle(playerPage);
  await capture(page, "04-dealer-payout-resolved");
  await capture(playerPage, "09-player-payout");

  await expect(page.getByRole("button", { name: "Change Dealer" })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "Change Dealer" })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "Change Game" })).toHaveCount(0);

  await playerContext.close();
});
