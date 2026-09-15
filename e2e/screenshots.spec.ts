import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = join(process.cwd(), "docs", "screenshots", "classic");
const reference = pathToFileURL(
  join(process.cwd(), "design/reference/classic/jetonbro-player-bank-insurance.html"),
).href;

test("render Classic Player and Bank phases at target sizes", async ({ page }) => {
  await mkdir(out, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(reference);

  await page.screenshot({ path: join(out, "player-betting-390x844.png") });

  await page.getByRole("button", { name: "Bank / Dealer" }).click();
  await page.screenshot({ path: join(out, "bank-betting-390x844.png") });

  await page.getByRole("button", { name: "2 · Playing" }).click();
  await page.screenshot({ path: join(out, "bank-playing-390x844.png") });

  await page.getByRole("button", { name: "Player" }).click();
  await page.screenshot({ path: join(out, "player-playing-390x844.png") });

  await page.getByRole("button", { name: "Bank / Dealer" }).click();
  await page.getByRole("button", { name: "3 · Payout" }).click();
  await page.screenshot({ path: join(out, "bank-payout-390x844.png") });

  await page.getByRole("button", { name: "Player" }).click();
  await page.screenshot({ path: join(out, "player-payout-390x844.png") });

  await page.setViewportSize({ width: 320, height: 700 });
  await page.screenshot({ path: join(out, "player-payout-320x700.png") });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);

  await page.setViewportSize({ width: 430, height: 932 });
  await page.screenshot({ path: join(out, "player-payout-430x932.png") });
});
