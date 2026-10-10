import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "premium-polish");

async function expectNoDocumentScroll(page: Page) {
  const scroll = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(scroll.x).toBeLessThanOrEqual(1);
  expect(scroll.y).toBeLessThanOrEqual(1);
}

async function capture(page: Page, screen: string, name: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/dev/premium?screen=${screen}`);
  await expect(page.locator("[data-skin=premium]")).toBeVisible({ timeout: 20_000 });
  await expectNoDocumentScroll(page);
  await page.screenshot({ path: join(shots, `${name}-390x844.png`), fullPage: false });
}

test("Premium polish smoke — setup stack, poker console, BJ console", async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(shots, { recursive: true });

  await capture(page, "13-poker-setup-starting-stack", "01-poker-setup-starting-stack");
  await expect(page.locator("[data-starting-stack=true]")).toBeVisible();
  await expect(page.locator("[data-casino-console=true]")).toBeVisible();

  await capture(page, "10-poker-heads-up-preflop", "02-poker-preflop-console");
  await expect(page.locator("[data-casino-console=true]")).toBeVisible();
  await expect(page.locator("[data-jeton-tray=true]")).toBeVisible();
  await expect(page.locator("[data-to-call=true]")).toBeVisible();

  await capture(page, "06-bj-player-betting-one-box", "03-bj-player-betting-console");
  await expect(page.locator("[data-casino-console=true]")).toBeVisible();
  await expect(page.locator("[data-jeton-tray=true]")).toBeVisible();
});
