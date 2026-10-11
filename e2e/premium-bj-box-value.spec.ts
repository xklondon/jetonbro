import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "premium-bj-boxes");

test("Premium Blackjack factual boxes and chip stacks", async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(shots, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/dev/premium?screen=01-bj-dealer-setup-empty");
  await expect(page.locator('[data-skin="premium"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-box-number]')).toHaveCount(0);
  await expect(page.locator('[data-table-zone="setup"]')).toBeVisible();
  // Raster must not be the only source of box chrome — no dynamic boxes in setup.
  await page.screenshot({ path: join(shots, "04-bj-setup-clean-felt-390x844.png"), fullPage: false });

  await page.goto("/dev/premium?screen=06-bj-player-betting-one-box");
  await expect(page.locator('[data-box-number]')).toHaveCount(1);
  const one = page.locator('[data-box-number="1"]');
  await expect(one).toBeVisible();
  const mainOne = await one.getAttribute("data-main-amount");
  const stackOne = await one.locator("[data-chip-stack]").getAttribute("data-chip-stack-total");
  expect(stackOne).toBe(mainOne);
  await page.screenshot({ path: join(shots, "05-bj-betting-one-box-390x844.png"), fullPage: false });

  await page.goto("/dev/premium?screen=03-bj-dealer-betting-two-boxes");
  await expect(page.locator('[data-box-number]')).toHaveCount(2);
  for (const box of await page.locator("[data-box-number]").all()) {
    const main = await box.getAttribute("data-main-amount");
    const stack = await box.locator("[data-chip-stack]").getAttribute("data-chip-stack-total");
    expect(stack).toBe(main);
  }
  await page.screenshot({ path: join(shots, "06-bj-betting-two-boxes-390x844.png"), fullPage: false });

  // Fixture with MAIN 30 if present elsewhere — also assert denomination helper via static route.
  await page.goto("/dev/premium?screen=06-bj-player-betting-one-box");
  const values = await page.locator("[data-chip-values]").first().getAttribute("data-chip-values");
  const total = await page.locator("[data-chip-stack-total]").first().getAttribute("data-chip-stack-total");
  expect(total).toBeTruthy();
  if (total === "30") expect(values).toBe("25+5");
  if (total === "25") expect(values).toBe("25");
  if (total === "100") expect(values).toBe("100");
});
