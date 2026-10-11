import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { openAs, openSetupSheet } from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "premium-setup-invite");

async function noScroll(page: import("@playwright/test").Page) {
  const scroll = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(scroll.x).toBeLessThanOrEqual(1);
  expect(scroll.y).toBeLessThanOrEqual(1);
}

test("Premium Create Table + Poker setup invite journey", async ({ page, context }) => {
  test.setTimeout(180_000);
  await mkdir(shots, { recursive: true });
  const stamp = randomUUID().slice(0, 8);
  const ownerEmail = `premium-setup-${stamp}@example.com`;
  const tableName = `Setup Invite ${stamp}`;

  await openAs(context, page, ownerEmail, "Owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await openSetupSheet(page);

  await expect(page.locator('[data-table-board="CREATE_TABLE"]')).toHaveCount(1);
  await page.getByLabel("Table name").fill(tableName);
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();

  await page.getByRole("button", { name: "BLACKJACK" }).click();
  await expect(page.getByRole("button", { name: "BLACKJACK" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "OPEN BANK" })).toBeVisible();
  await noScroll(page);
  await page.screenshot({ path: join(shots, "01-create-blackjack-390x844.png"), fullPage: false });

  await page.getByRole("button", { name: /TEXAS HOLD/i }).click();
  await expect(page.getByRole("button", { name: /TEXAS HOLD/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Small blind")).toBeVisible();
  await noScroll(page);
  await page.screenshot({ path: join(shots, "02-create-poker-390x844.png"), fullPage: false });

  await page.getByRole("button", { name: "INVITE PLAYER" }).click();
  await expect(page.locator('[data-invite-mask="true"]')).toHaveCount(1);
  await expect(page.locator('[data-invite-kind="guest"]')).toBeVisible();
  await page.screenshot({ path: join(shots, "03-create-invite-guest-390x844.png"), fullPage: false });
  await page.getByRole("button", { name: "Close invite" }).click();
  await expect(page.locator('[data-invite-mask="true"]')).toHaveCount(0);

  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.getByRole("button", { name: "START TABLE" })).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('[data-table-board="POKER_DEALER"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START HAND" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD PLAYER" })).toBeVisible();
  await expect(page.getByRole("button", { name: "START HAND" })).toBeDisabled();

  const tableBefore = await page.locator('[data-poker-table="true"]').boundingBox();
  await noScroll(page);
  await page.screenshot({ path: join(shots, "07-poker-setup-console-390x844.png"), fullPage: false });

  await page.getByRole("button", { name: "ADD PLAYER" }).click();
  await expect(page.locator('[data-invite-mask="true"]')).toHaveCount(1);
  await page.screenshot({ path: join(shots, "08-poker-setup-invite-390x844.png"), fullPage: false });

  const guestUrl = await page.locator("[data-guest-join-url]").first().getAttribute("data-guest-join-url");
  expect(guestUrl).toBeTruthy();
  await page.getByRole("button", { name: "Close invite" }).click();

  const guestContext = await context.browser()!.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await guestPage.goto(new URL(guestUrl!).pathname);
  await expect(guestPage.getByRole("heading", { name: /Join without email/i })).toBeVisible({
    timeout: 20_000,
  });
  await guestPage.getByLabel("Play name").fill("Casey");
  await guestPage.getByRole("button", { name: "Join table" }).click();
  await expect(guestPage).toHaveURL(/\/tables\//, { timeout: 20_000 });

  await expect(page.getByText("Casey").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START HAND" })).toBeEnabled();
  const tableAfter = await page.locator('[data-poker-table="true"]').boundingBox();
  if (tableBefore && tableAfter) {
    expect(Math.abs(tableBefore.y - tableAfter.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(tableBefore.height - tableAfter.height)).toBeLessThanOrEqual(2);
  }
  await page.screenshot({ path: join(shots, "09-poker-setup-joined-390x844.png"), fullPage: false });
  await guestContext.close();
});
