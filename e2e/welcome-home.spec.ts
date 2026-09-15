import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { noHorizontalOverflow, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

test("authenticated welcome, create table and lobby", async ({ page, context }) => {
  test.setTimeout(120_000);
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("welcome");
  await openAs(context, page, ownerEmail, "Alex");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "CREATE A TABLE" })).toBeVisible();
  await expect(page.getByText("Welcome to the table, Alex")).toBeVisible();
  await expect(page.locator(".welcome-celebration")).toHaveCount(0, { timeout: 5000 });
  await page.screenshot({ path: join(out, "app-welcome-empty-390x844.png") });

  await page.getByRole("button", { name: "CREATE A TABLE" }).click();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Blackjack/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Poker/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Zilch/ })).toBeDisabled();
  await expect(page.getByLabel("Player email")).toBeVisible();
  await expect(page.getByLabel("Table name")).toHaveValue("Alex's table");
  await page.screenshot({ path: join(out, "app-welcome-games-390x844.png") });
  await page.screenshot({ path: join(out, "app-blackjack-setup-390x844.png") });

  await page.getByLabel("Starting jetons per player").fill("0");
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.getByText(/Bank\/Dealer Alex/)).toBeVisible();
  await expect(page.getByRole("button", { name: "+ ADD PLAYER" })).toBeVisible();
  await expect(page.getByAltText("Shared table join QR code")).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeDisabled();
  await expect(page.getByText("Waiting for a player to join")).toBeVisible();
  await page.screenshot({ path: join(out, "app-table-lobby-invites-390x844.png") });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "CREATE NEW TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "RETURN TO TABLE" })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await noHorizontalOverflow(page);
});

test("welcome animation is non-blocking, session-limited and respects reduced motion", async ({ page, context }) => {
  const ownerEmail = uniqueEmail("anim");
  await openAs(context, page, ownerEmail, "Sam");
  await page.goto("/");
  await expect(page.locator(".welcome-celebration")).toBeVisible();
  await page.getByRole("button", { name: "CREATE A TABLE" }).click();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("button", { name: "CREATE A TABLE" })).toBeVisible();
  await expect(page.locator(".welcome-celebration")).toHaveCount(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.locator(".welcome-particle")).toHaveCount(0);
});
