import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

test("two browsers: setup, join, and a real 25 jeton bet", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("bank");
  const playerEmail = uniqueEmail("player");

  await openAs(context, page, ownerEmail, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "CREATE A TABLE" }).click();
  await page.getByLabel("Table name").fill("Salon table");
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Player email").fill(playerEmail);
  await page.screenshot({ path: join(out, "app-create-table-setup-390x844.png") });
  await page.getByRole("button", { name: "SET UP TABLE" }).click();
  await expect(page.getByText("Invited")).toBeVisible();

  const mailbox = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(playerEmail)}`);
  const mail = (await mailbox.json()) as { messages: { url?: string }[] };
  expect(mail.messages[0]?.url).toBeTruthy();
  const invitePath = new URL(mail.messages[0]!.url!).pathname;

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(invitePath);
  await expect(playerPage.getByText(/Waiting for the Bank/i)).toBeVisible();
  await expect(playerPage.getByText("100").first()).toBeVisible();

  await expect(page.locator(".member-row").filter({ hasText: /Joined|Ready/ })).toBeVisible({
    timeout: 15_000,
  });
  await page.screenshot({ path: join(out, "app-bank-lobby-invited-joined-390x844.png") });

  await page.getByRole("button", { name: /START BETTING/i }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();

  await playerPage.reload();
  await expect(playerPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(playerPage.getByText("100", { exact: true }).first()).toBeVisible();
  await playerPage.screenshot({ path: join(out, "app-player-before-bet-390x844.png") });
  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect(playerPage.getByText("75", { exact: true }).first()).toBeVisible();
  await expect(playerPage.locator("button.box").first()).toContainText("25");
  await playerPage.screenshot({ path: join(out, "app-player-after-bet-25-390x844.png") });
  await playerPage.reload();
  await expect(playerPage.getByText("75", { exact: true }).first()).toBeVisible();
  await expect(playerPage.locator("button.box").first()).toContainText("25");

  await page.reload();
  await expect(page.locator(".box").first()).toContainText("25");
  await page.screenshot({ path: join(out, "app-bank-player-bet-25-390x844.png") });

  await playerContext.close();
});
