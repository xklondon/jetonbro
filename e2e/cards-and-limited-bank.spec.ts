import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { openAs, uniqueEmail } from "./helpers";

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
  await page.goto("/");
  await page.getByRole("button", { name: "CREATE A TABLE" }).click();
  await page.getByLabel("Table name").fill("Salon table");
  await page.locator(".setup-mask").getByLabel("Starting jetons per player").fill("100");
  if (options?.cardAssist) {
    await page.locator(".setup-mask").getByRole("button", { name: options.cardAssist, exact: true }).click();
  }
  if (options?.limited) {
    await page.locator(".setup-mask").getByRole("button", { name: "LIMITED BANK" }).click();
    await page.locator(".setup-mask").getByLabel("Starting Bank jetons").fill("500");
  }
  await page.locator(".setup-mask").getByLabel("Player email").fill(playerEmail);
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
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
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await playerPage.reload();
  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect(playerPage.getByText("75", { exact: true }).first()).toBeVisible();
  return { playerContext, playerPage };
}

test("optional manual flow still deals and pays without cards", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await mkdir(out, { recursive: true });
  const { playerContext, playerPage } = await twoSeatTable(page, context, browser);
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await expect(page.getByRole("button", { name: "PAYOUT PHASE" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "+ ADD CARDS" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-playing-optional-cards-390x844.png") });
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await page.getByRole("button", { name: "WON" }).click();
  await expect(playerPage.getByText(/Won|YOUR JETONS/i).first()).toBeVisible();
  await playerContext.close();
});

test("card-assist Confirm applies a suggested outcome", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  const { playerContext, playerPage } = await twoSeatTable(page, context, browser, { cardAssist: "CONFIRM" });
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await playerPage.getByRole("button", { name: "+ ADD CARDS" }).click();
  await playerPage.locator(".rank-tray").getByRole("button", { name: "K", exact: true }).click();
  await playerPage.locator(".rank-tray").getByRole("button", { name: "9", exact: true }).click();
  await playerPage.getByRole("button", { name: "HAND COMPLETE" }).click();
  await page.locator(".bank-phase-control").getByRole("button", { name: "+ ADD CARDS" }).click();
  await page.locator(".bank-phase-control .rank-tray").getByRole("button", { name: "K", exact: true }).click();
  await page.locator(".bank-phase-control .rank-tray").getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "DEALER COMPLETE" }).click();
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
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
  await page.goto("/");
  await page.getByRole("button", { name: "CREATE A TABLE" }).click();
  await page.getByLabel("Table name").fill("Auto table");
  await page.locator(".setup-mask").getByLabel("Starting jetons per player").fill("100");
  await page.locator(".setup-mask").getByRole("button", { name: "AUTO", exact: true }).click();
  await page.locator(".setup-mask").getByLabel("Player email").fill(samEmail);
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
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
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await samPage.reload();
  await joPage.reload();
  await samPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await joPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await samPage.getByRole("button", { name: "+ ADD CARDS" }).click();
  await samPage.locator(".rank-tray").getByRole("button", { name: "K", exact: true }).click();
  await samPage.locator(".rank-tray").getByRole("button", { name: "9", exact: true }).click();
  await samPage.getByRole("button", { name: "HAND COMPLETE" }).click();
  await page.locator(".bank-phase-control").getByRole("button", { name: "+ ADD CARDS" }).click();
  await page.locator(".bank-phase-control .rank-tray").getByRole("button", { name: "K", exact: true }).click();
  await page.locator(".bank-phase-control .rank-tray").getByRole("button", { name: "7", exact: true }).click();
  await page.getByRole("button", { name: "DEALER COMPLETE" }).click();
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
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
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await page.getByRole("button", { name: "WON" }).click();
  await expect(page.getByText("Available 475")).toBeVisible();
  await page.getByRole("button", { name: "NEXT ROUND NOW" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await expect(page.getByText("LIMITED BANK")).toBeVisible();
  await expect(page.getByText("475").first()).toBeVisible();
  await page.screenshot({ path: join(out, "app-limited-bank-next-round-390x844.png") });
  await playerContext.close();
  void playerPage;
});
