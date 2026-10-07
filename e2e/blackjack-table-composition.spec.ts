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

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "blackjack-table-composition");

type Snap = {
  player?: {
    available: { label: string };
    boxes: { id: string; boxNumber: number; bet: { label: string } }[];
  };
  bank?: { boxes: { id: string; bet?: { label: string } }[]; players?: { userId: string }[]; phase?: string };
  phase?: string;
};

async function snapshot(page: Page): Promise<Snap> {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((r) => r.json());
}

async function shot(page: Page, name: string, size: { width: number; height: number } = { width: 390, height: 844 }) {
  await page.setViewportSize(size);
  await page.screenshot({ path: join(shots, `${name}-${size.width}x${size.height}.png`), fullPage: false });
}

async function assertSharedSurface(page: Page) {
  await expect(page.locator("[data-blackjack-table-surface=true]")).toBeVisible();
  await expect(page.locator("[data-felt-name=true]")).toBeVisible();
  await expect(page.locator("[data-dealer-slot=true]")).toBeVisible();
  await expect(page.locator("[data-table-cloth=true]")).toHaveCount(0);
  await expect(page.locator(".tt-ledger-wrap")).toHaveCount(0);
}

test("Blackjack one-table composition across phases", async ({ page, context, browser }) => {
  test.setTimeout(300_000);
  await mkdir(shots, { recursive: true });

  await openAs(context, page, uniqueEmail("comp-own"), "Dee");
  await createBlackjackTable(page, "Composition Salon", { starting: "100" });

  await assertSharedSurface(page);
  await expect(page.locator("[data-blackjack-box-row]")).toHaveCount(0);
  await expect(page.getByText("Invite a Player to begin.")).toBeVisible();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeDisabled();
  await shot(page, "01-dealer-setup-empty");

  const guestUrl = await setupJoinUrl(page, "guest");
  const caseyCtx = await browser.newContext();
  const casey = await caseyCtx.newPage();
  await casey.setViewportSize({ width: 390, height: 844 });
  await casey.goto(new URL(guestUrl, page.url()).pathname);
  await casey.getByLabel("Play name").fill("G");
  await casey.getByRole("button", { name: "Join table" }).click();
  await expect(casey.getByText(/Waiting for the (Dealer|table) to open betting/i)).toBeVisible({ timeout: 20_000 });

  await expect(page.locator("[data-blackjack-box-row]")).toHaveCount(1);
  await expect(page.locator('[data-status="READY"]')).toBeVisible();
  await expect(page.getByText("READY", { exact: true })).toBeVisible();
  await expect(page.getByText("Waiting", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-field="available"]')).toContainText("100");
  await expect(page.locator('[data-field="main-bet"]')).toHaveCount(0);
  await expect(page.getByText("Ready to open betting.")).toBeVisible();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled();
  await assertSharedSurface(page);
  await shot(page, "02-dealer-setup-joined-ready");
  await assertSharedSurface(casey);
  await shot(casey, "09-player-waiting");

  await page.getByRole("button", { name: "START BETTING" }).click();
  await casey.reload();
  await expect(casey.getByText("YOUR JETONS")).toBeVisible();
  await expect(page.locator("[data-blackjack-box-row]")).toHaveCount(1);
  await expect(page.getByText("NO BET")).toBeVisible();
  await expect(page.locator('[data-field="main-bet"]')).toContainText("0");
  await assertSharedSurface(page);
  await shot(page, "03-dealer-betting-no-wager");

  await casey.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(casey)).player?.available.label).toBe("75");
  await expect.poll(async () => (await snapshot(casey)).player?.boxes[0]?.bet.label).toBe("25");
  await expect(page.locator('[data-field="main-bet"]')).toContainText("25");
  await expect(page.locator('[data-blackjack-box-row][data-available="75"]')).toHaveCount(1);
  await expect(page.locator('[data-field="status"]')).toHaveText("WAGERED");
  await expect(page.locator('[data-field="status"]')).not.toContainText("75");
  await assertSharedSurface(page);
  await shot(page, "04-dealer-betting-wager-25");
  await assertSharedSurface(casey);
  await shot(casey, "10-player-betting");

  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await assertSharedSurface(page);
  await shot(page, "05-dealer-playing");
  await assertSharedSurface(casey);
  await shot(casey, "11-player-playing");

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await assertSharedSurface(page);
  await shot(page, "06-dealer-insurance");
  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-payout-rail=row]").first()).toBeVisible();
  const rail = page.locator("[data-payout-rail=row]").first();
  const y0 = (await rail.locator("[data-payout-action=true]").nth(0).boundingBox())!.y;
  for (let i = 1; i < 4; i += 1) {
    expect(Math.abs((await rail.locator("[data-payout-action=true]").nth(i).boundingBox())!.y - y0)).toBeLessThan(8);
  }
  await assertSharedSurface(page);
  await shot(page, "07-dealer-payout-unresolved");

  while (await page.locator("[data-payout-action=true]").count()) {
    await page.locator("[data-payout-action=true]").filter({ hasText: /^WIN$/ }).first().click();
  }
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 15_000 });
  await assertSharedSurface(page);
  await shot(page, "08-dealer-payout-resolved");
  await assertSharedSurface(casey);
  await shot(casey, "12-player-payout");

  for (const [w, h] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expectNoDocumentScroll(page);
    await assertSharedSurface(page);
    await shot(page, `viewport-dealer-${w}x${h}`, { width: w, height: h });
    await casey.setViewportSize({ width: w, height: h });
    await assertSharedSurface(casey);
  }

  await caseyCtx.close();
});
