import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const out = join(process.cwd(), "docs", "screenshots", "classic");

async function openAs(context: BrowserContext, page: Page, email: string, name: string) {
  const response = await page.request.post("/api/dev/session", {
    data: { email, name },
  });
  const data = (await response.json()) as { sessionToken: string };
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: data.sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
}

test("real Player and Bank phases with Insurance", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await mkdir(out, { recursive: true });
  const health = await page.request.get("/api/health");
  expect((await health.json()).ok).toBe(true);

  const ownerEmail = `owner-${randomUUID()}@jetonbro.test`;
  const alexEmail = `alex-${randomUUID()}@jetonbro.test`;
  await openAs(context, page, ownerEmail, "Owner");
  await page.goto("/tables/new");
  await page.getByPlaceholder("Table name").fill("Acceptance table");
  await page.getByPlaceholder("Starting jetons for you").fill("0");
  await page.getByRole("button", { name: "Open the table" }).click();
  await expect(page.getByText("Table setup")).toBeVisible();

  await page.getByPlaceholder("Invite by email").fill(alexEmail);
  await page.getByRole("button", { name: "Send email invites" }).click();
  await expect(page.getByText("Pending invitation")).toBeVisible();
  const mailbox = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(alexEmail)}`);
  const mail = (await mailbox.json()) as { messages: { url?: string }[] };
  const invitePath = new URL(mail.messages[0]!.url!).pathname;

  const alexContext = await browser.newContext();
  const alexPage = await alexContext.newPage();
  await openAs(alexContext, alexPage, alexEmail, "Alex");
  await alexPage.goto(invitePath);
  await expect(alexPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  await page.reload();
  await expect(page.locator(".member-row strong").filter({ hasText: "Alex" })).toBeVisible({ timeout: 15000 });
  await page.locator("select").last().selectOption({ label: "Alex" });
  await page.getByPlaceholder("Jeton amount").fill("200");
  await page.getByRole("button", { name: "Give jetons" }).click();
  await page.getByRole("button", { name: "Start betting" }).click();
  await expect(page.getByText("CURRENT PHASE:")).toBeVisible();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deal cards" })).toBeVisible();

  await alexPage.reload();
  await expect(alexPage.getByText("YOUR JETONS")).toBeVisible();
  await alexPage.getByRole("button", { name: "+ Box" }).click();
  await expect(alexPage.getByText("YOUR BOX 2")).toBeVisible();
  await alexPage.getByRole("button", { name: /YOUR BOX 1/ }).click();
  await alexPage.getByPlaceholder("Amount").fill("25");
  await alexPage.getByRole("button", { name: "Bet", exact: true }).click();
  await expect(alexPage.locator("button.box").filter({ hasText: "YOUR BOX 1" })).toContainText("25");
  await alexPage.getByRole("button", { name: /YOUR BOX 2/ }).click();
  await alexPage.getByPlaceholder("Amount").fill("10");
  await alexPage.getByRole("button", { name: "Bet", exact: true }).click();
  await expect(alexPage.locator("button.box").filter({ hasText: "YOUR BOX 2" })).toContainText("10");
  await expect(alexPage.getByText("165", { exact: true }).first()).toBeVisible();
  await expect(alexPage.getByText("YOUR JETONS")).toBeVisible();
  await alexPage.setViewportSize({ width: 390, height: 844 });
  await alexPage.screenshot({ path: join(out, "app-player-betting-390x844.png") });
  await alexPage.setViewportSize({ width: 320, height: 700 });
  await noHorizontalOverflow(alexPage);
  await expect(alexPage.getByPlaceholder("Amount")).toBeVisible();
  await expect(alexPage.getByText("YOUR JETONS")).toBeVisible();
  await alexPage.screenshot({ path: join(out, "app-player-betting-320x700.png") });
  await alexPage.setViewportSize({ width: 390, height: 844 });

  await page.reload();
  await expect(page.getByRole("button", { name: "Deal cards" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-bank-betting-390x844.png") });
  await page.getByRole("button", { name: "Deal cards" }).click();
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Payout phase" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deal cards" })).toHaveCount(0);

  await alexPage.reload();
  await expect(alexPage.getByRole("button", { name: "Double" })).toBeVisible();
  await expect(alexPage.getByText("YOUR JETONS")).toBeVisible();
  await alexPage.getByRole("button", { name: /YOUR BOX 1/ }).click();
  await alexPage.getByRole("button", { name: "Double" }).click();
  await alexPage.getByRole("button", { name: /YOUR BOX 2/ }).click();
  await alexPage.getByRole("button", { name: "Split" }).click();
  await expect(alexPage.getByText(/SPLIT BOX/)).toBeVisible();

  await page.getByRole("button", { name: "Open Insurance" }).click();
  await expect(page.getByText(/INSURANCE SIDE POT · OPEN/)).toBeVisible();
  await alexPage.reload();
  await alexPage.getByRole("button", { name: /YOUR BOX 1/ }).click();
  await alexPage.getByRole("button", { name: "Insurance" }).click();
  await page.reload();
  await expect(page.getByText(/INSURANCE SIDE POT · OPEN · 1 bet/)).toBeVisible();
  await alexPage.screenshot({ path: join(out, "app-player-playing-390x844.png") });
  await page.screenshot({ path: join(out, "app-bank-playing-insurance-390x844.png") });

  await page.getByRole("button", { name: "Close Insurance" }).click();
  await page.getByRole("button", { name: "Payout phase" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deal cards" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start next hand" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Won/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Dealer Blackjack" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-bank-payout-unresolved-390x844.png") });

  await alexPage.reload();
  await expect(alexPage.getByText("Waiting for the Bank", { exact: true }).first()).toBeVisible();
  await expect(alexPage.getByText("YOUR JETONS")).toBeVisible();
  await alexPage.screenshot({ path: join(out, "app-player-payout-390x844.png") });
  await alexPage.setViewportSize({ width: 320, height: 700 });
  await noHorizontalOverflow(alexPage);
  await expect(alexPage.getByText("YOUR JETONS")).toBeVisible();
  await alexPage.screenshot({ path: join(out, "app-player-payout-320x700.png") });
});
