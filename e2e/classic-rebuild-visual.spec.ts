import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, createPokerTable, expectNoDocumentScroll, openAs, uniqueEmail } from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "classic-rebuild");
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;

async function capture(page: Page, name: string) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectNoDocumentScroll(page);
    await page.screenshot({ path: join(shots, `${name}-${viewport.width}x${viewport.height}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(shots, `${name}-1440x900.png`) });
}

test("Home, swipe, create table, and poker visual states", async ({ page, context }) => {
  test.setTimeout(240_000);
  await mkdir(shots, { recursive: true });
  const ownerEmail = uniqueEmail("rebuild-home");
  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(context, page, ownerEmail, "Alex");

  await createBlackjackTable(page, "Salon one", { starting: "100" });
  await page.goto("/");
  await createBlackjackTable(page, "Salon two", { starting: "100" });
  await page.goto("/");
  await createBlackjackTable(page, "Salon three", { starting: "100" });
  await page.goto("/");
  await createBlackjackTable(page, "Salon four", { starting: "100" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SAVED TABLES" })).toBeVisible();
  await expect(page.getByText("Resume a table or create a new one.")).toBeVisible();
  await expect(page.locator("[data-table-id]")).toHaveCount(4);
  await capture(page, "01-home-four-tables");

  const card = page.locator("[data-table-id]").first();
  const box = await card.boundingBox();
  if (!box) throw new Error("saved-table card has no box");
  await page.mouse.move(box.x + box.width - 16, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(card.locator("[data-home-delete], [data-home-end-delete]").first()).toBeVisible();
  await capture(page, "02-home-swipe-reveal");

  await page.getByRole("button", { name: "Table menu" }).first().click();
  const destructive = page.getByRole("button", { name: /DELETE|END & DELETE/ }).first();
  await destructive.click();
  await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
  await capture(page, "03-owner-delete-confirm");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page.getByRole("heading", { name: "CREATE TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await capture(page, "04-create-table-collapsed");
  await page.getByRole("tab", { name: "GUEST QR" }).click();
  await expect(page.getByAltText(/Guest QR/i)).toBeVisible();
  await capture(page, "05-create-table-guest-qr");

  await page.goto("/");
  await createPokerTable(page, "Poker felt", { starting: "100" });
  await capture(page, "21-poker-dealer");
});
