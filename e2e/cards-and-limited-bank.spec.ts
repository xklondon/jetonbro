import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

async function twoSeatTable(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
  browser: import("@playwright/test").Browser,
  options?: { limited?: boolean; cardAssist?: "OFF" | "CONFIRM" | "AUTO" },
) {
  const ownerEmail = uniqueEmail("bank");
  const playerEmail = uniqueEmail("player");
  await openAs(context, page, ownerEmail, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await createBlackjackTable(page, "Salon table", { starting: "100" });
  if (options?.cardAssist) {
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: options.cardAssist, exact: true }).click();
    const cancel = page.getByRole("button", { name: "Cancel" });
    if (await cancel.isVisible()) {
      await cancel.click();
    }
  }
  await page.getByRole("button", { name: "ADD PLAYER" }).first().click();
  await page.getByLabel("Player email").fill(playerEmail);
  await page.getByRole("button", { name: "Invite by email" }).click();
  await expect(page.getByText("Invited")).toBeVisible();
  const mailbox = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(playerEmail)}`);
  const mail = (await mailbox.json()) as { messages: { url?: string }[] };
  const invitePath = new URL(mail.messages[0]!.url!).pathname;
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(invitePath);
  await expect(playerPage.getByText(/Waiting for the Bank/i)).toBeVisible();
  await expect(page.locator(".member-row").filter({ hasText: /Joined|Ready/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "START BLACKJACK" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BLACKJACK" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  if (options?.limited) {
    await page.getByRole("switch").click();
    await page.getByLabel("Starting Bank jetons").fill("500");
    await page.getByRole("button", { name: "Confirm Limited Bank" }).click();
    await expect(page.getByText(/500 available|LIMITED BANK/)).toBeVisible();
  }
  await playerPage.reload();
  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect(playerPage.getByText("75", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "CLOSE BETTING" })).toBeEnabled({ timeout: 15_000 });
  return { playerContext, playerPage };
}

test("optional manual flow still deals and pays without cards", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await mkdir(out, { recursive: true });
  const { playerContext, playerPage } = await twoSeatTable(page, context, browser);
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await expect(page.getByRole("button", { name: "ENTER PAYOUT" })).toBeVisible();
  await expect(playerPage.locator(".add-cards")).toHaveCount(0);
  await page.screenshot({ path: join(out, "app-playing-optional-cards-390x844.png") });
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await page.locator(".payout-access button.won").click();
  await expect(playerPage.getByText(/Won|YOUR JETONS/i).first()).toBeVisible();
  await playerContext.close();
});

test("card-assist Confirm applies a suggested outcome", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  const { playerContext, playerPage } = await twoSeatTable(page, context, browser, { cardAssist: "CONFIRM" });
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await playerPage.locator(".add-cards").click();
  await playerPage.locator(".rank-tray").getByRole("button", { name: "K", exact: true }).click();
  await playerPage.locator(".rank-tray").getByRole("button", { name: "9", exact: true }).click();
  await playerPage.getByRole("button", { name: "HAND COMPLETE", exact: true }).click();
  await page.locator("[data-dealer-box] .add-cards").click();
  await page.locator("[data-dealer-box] .rank-tray").getByRole("button", { name: "K", exact: true }).click();
  await page.locator("[data-dealer-box] .rank-tray").getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "DEALER COMPLETE" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.getByRole("button", { name: /APPLY WON/ })).toBeVisible();
  await page.screenshot({ path: join(out, "app-card-assist-confirm-390x844.png") });
  await page.getByRole("button", { name: /APPLY WON/ }).click();
  await expect(page.getByText(/Won/i).first()).toBeVisible();
  await playerContext.close();
});

test("card-assist Auto settles complete boxes and leaves incomplete manual", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  const ownerEmail = uniqueEmail("bank");
  const samEmail = uniqueEmail("sam");
  const joEmail = uniqueEmail("jo");
  await openAs(context, page, ownerEmail, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await createBlackjackTable(page, "Auto table", { starting: "100" });
  await expect(page.getByRole("button", { name: "START BLACKJACK" })).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("button", { name: "AUTO", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "AUTO", exact: true }).click();
  const cancel = page.getByRole("button", { name: "Cancel" });
  if (await cancel.isVisible()) {
    await cancel.click();
  }
  await page.getByRole("button", { name: "ADD PLAYER" }).first().click();
  await page.getByLabel("Player email").fill(samEmail);
  await page.getByRole("button", { name: "Invite by email" }).click();
  await expect(page.getByText("Invited")).toBeVisible();
  const samMail = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(samEmail)}`);
  const samInvite = new URL(((await samMail.json()) as { messages: { url?: string }[] }).messages[0]!.url!).pathname;
  const snapshot = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  const data = (await snapshot.json()) as { setup?: { joinUrl: string | null } };
  expect(data.setup?.joinUrl).toBeTruthy();
  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(samInvite);
  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(new URL(data.setup!.joinUrl!).pathname);
  await expect(page.getByText("Sam")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Jo")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "START BLACKJACK" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BLACKJACK" }).click();
  await samPage.reload();
  await joPage.reload();
  await samPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await joPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect(page.getByRole("button", { name: "CLOSE BETTING" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await samPage.locator(".add-cards").click();
  await samPage.locator(".rank-tray").getByRole("button", { name: "K", exact: true }).click();
  await samPage.locator(".rank-tray").getByRole("button", { name: "9", exact: true }).click();
  await samPage.getByRole("button", { name: "HAND COMPLETE", exact: true }).click();
  await page.locator("[data-dealer-box] .add-cards").click();
  await page.locator("[data-dealer-box] .rank-tray").getByRole("button", { name: "K", exact: true }).click();
  await page.locator("[data-dealer-box] .rank-tray").getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "DEALER COMPLETE" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.getByText(/Won/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "LOST" }).first()).toBeVisible();
  await page.screenshot({ path: join(out, "app-card-assist-auto-incomplete-390x844.png") });
  await samContext.close();
  await joContext.close();
});

test("Limited Bank win then next round keeps mode and balance", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await mkdir(out, { recursive: true });
  const { playerContext, playerPage } = await twoSeatTable(page, context, browser, { limited: true });
  await expect(page.getByText("LIMITED BANK")).toBeVisible();
  await page.screenshot({ path: join(out, "app-limited-bank-betting-390x844.png") });
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await page.locator(".payout-access button.won").click();
  await page.getByRole("button", { name: "START NEXT ROUND" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await expect(page.getByText("LIMITED BANK")).toBeVisible();
  await expect(page.getByText("475 available")).toBeVisible();
  await page.screenshot({ path: join(out, "app-limited-bank-next-round-390x844.png") });
  await playerContext.close();
  void playerPage;
});
