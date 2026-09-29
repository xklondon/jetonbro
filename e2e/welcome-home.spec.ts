import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, noHorizontalOverflow, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

test("authenticated welcome, create table, then the dealer setup table", async ({ page, context }) => {
  test.setTimeout(120_000);
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("welcome");
  await openAs(context, page, ownerEmail, "Alex");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toBeVisible();
  await expect(page.getByText("Welcome, Alex")).toBeVisible();
  await expect(page.locator(".welcome-celebration")).toHaveCount(0, { timeout: 5000 });
  await page.screenshot({ path: join(out, "app-welcome-empty-390x844.png") });

  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page).toHaveURL(/\/tables\/new/);
  await expect(page.getByLabel("Table name")).toHaveValue("Alex's table");
  await expect(page.getByLabel("Starting jetons per player")).toBeVisible();
  await page.screenshot({ path: join(out, "app-welcome-games-390x844.png") });

  await page.getByLabel("Starting jetons per player").fill("0");
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page).toHaveURL(/\/tables\/(?!new(?:\?|$))/);
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toHaveCount(0);
  await expect(page.locator(".waiting-room")).toHaveCount(0);
  await expect(page.locator(".setup-mask")).toHaveCount(0);
  await expect(page.locator("[data-phase-heading]")).toHaveText("TABLE SETUP");
  await expect(page.getByText("TABLE SETUP", { exact: true })).toBeVisible();
  await expect(page.getByText("DEALER · Alex")).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD PLAYER" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "START BLACKJACK" })).toBeVisible();
  await expect(page.getByRole("button", { name: "START POKER" })).toBeVisible();
  await expect(page.getByRole("button", { name: "START BLACKJACK" })).toBeDisabled();
  await expect(page.getByText("Waiting for a player to join")).toBeVisible();
  await page.getByRole("button", { name: "QR" }).first().click();
  await expect(page.locator(".sheet.open").getByAltText("Shared table join QR code")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("DEALER · Alex")).toBeVisible();
  await page.screenshot({ path: join(out, "app-blackjack-setup-390x844.png") });
  await page.screenshot({ path: join(out, "app-table-lobby-invites-390x844.png") });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "RESUME" })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await noHorizontalOverflow(page);
});

test("welcome animation is non-blocking, session-limited and respects reduced motion", async ({ page, context }) => {
  const ownerEmail = uniqueEmail("anim");
  await openAs(context, page, ownerEmail, "Sam");
  await page.goto("/");
  await expect(page.locator(".welcome-celebration")).toBeVisible();
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toBeVisible();
  await expect(page.locator(".welcome-celebration")).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.locator(".welcome-particle")).toHaveCount(0);
});
