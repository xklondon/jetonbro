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

/**
 * Presentation-only visual capture for the Blackjack physical-table rebuild.
 * Does not assert business rules beyond reaching each named screen.
 */
const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "blackjack-physical-rebuild");

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 430, height: 932 },
] as const;

type Snap = {
  player?: {
    available: { label: string };
    boxes: { id: string; boxNumber: number; bet: { label: string } }[];
  };
  bank?: {
    boxes?: { id: string; bet?: { label: string } }[];
  };
};

async function snapshot(page: Page): Promise<Snap> {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((r) => r.json());
}

async function capture(page: Page, name: string) {
  for (const size of VIEWPORTS) {
    await page.setViewportSize(size);
    await expectNoDocumentScroll(page);
    await page.screenshot({
      path: join(shots, `${name}-${size.width}x${size.height}.png`),
      fullPage: false,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

test("Blackjack physical rebuild — named visual screens", async ({ page, context, browser }) => {
  test.setTimeout(300_000);
  await mkdir(shots, { recursive: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(context, page, uniqueEmail("phys-own"), "Dee");
  await createBlackjackTable(page, "EMERALD SALON", { starting: "100" });

  await expect(page.locator("[data-blackjack-table-surface=true]")).toBeVisible();
  await expect(page.locator(".tt-bj-wood")).toBeVisible();
  await expect(page.locator(".tt-bj-leather")).toBeVisible();
  await expect(page.locator(".tt-bj-gold")).toBeVisible();
  await expect(page.locator(".tt-bj-cloth")).toBeVisible();
  await expect(page.locator("[data-felt-markings=true]")).toBeVisible();
  await capture(page, "01-dealer-setup-empty");

  const guestUrl = await setupJoinUrl(page, "guest");
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await playerPage.goto(new URL(guestUrl, page.url()).pathname);
  await playerPage.getByLabel("Play name").fill("Sam");
  await playerPage.getByRole("button", { name: "Join table" }).click();

  await expect(playerPage.getByText(/Waiting for the (Dealer|table) to open betting/i)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('[data-status="PLAYER_JOINED"]')).toHaveCount(1);
  await expect(page.getByText("PLAYER JOINED")).toBeVisible();
  await capture(page, "02-dealer-setup-joined");
  await capture(playerPage, "03-player-waiting");

  await page.getByRole("button", { name: "START BETTING" }).click();
  await playerPage.reload();
  await expect(playerPage.getByText("YOUR JETONS")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-box-stage=true]")).toBeVisible();

  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("75");
  await expect.poll(async () => (await snapshot(page)).bank?.boxes?.[0]?.bet?.label ?? (await snapshot(playerPage)).player?.boxes?.[0]?.bet?.label).toBe("25");
  await page.reload();
  await expect(page.locator("[data-box-stage=true]")).toBeVisible({ timeout: 15_000 });
  await capture(page, "04-dealer-betting");
  await capture(playerPage, "05-player-betting-one-box");

  await playerPage.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.length).toBe(2);
  await capture(playerPage, "06-player-betting-two-boxes");

  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await playerPage.reload();
  await capture(page, "07-dealer-playing");
  await capture(playerPage, "08-player-playing");

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.locator("[data-bj-layout=payout]")).toBeVisible();
  await playerPage.reload();
  await capture(page, "09-dealer-payout");
  await capture(playerPage, "10-player-payout");

  await playerContext.close();
});
