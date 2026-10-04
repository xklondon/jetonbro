import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  createPokerTable,
  expectNoPageScroll,
  noHorizontalOverflow,
  openAs,
  openInviteMask,
  openSetupSheet,
  setupJoinUrl,
  uniqueEmail,
} from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "rc3-repair");

async function shot(page: Page, name: string) {
  await mkdir(out, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => undefined);
  await page.screenshot({ path: join(out, name) });
}

test("compact Create Table, exclusive invite mask, guest Player board, and OPEN BETTING", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(240_000);
  const ownerEmail = uniqueEmail("rc3-owner");
  await openAs(context, page, ownerEmail, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await openSetupSheet(page);
  await page.getByLabel("Table name").fill("RC3 Repair");
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD NEW PLAYER" })).toBeVisible();
  await expect(page.getByAltText("Guest QR — no email")).toHaveCount(0);
  await expectNoPageScroll(page);
  await noHorizontalOverflow(page);
  await shot(page, "01-create-table-390x844.png");

  await openInviteMask(page);
  await page.getByRole("tab", { name: "GUEST QR" }).click();
  await expect(page.getByAltText("Guest QR — no email")).toBeVisible();
  await expect(page.getByAltText("Verified QR — email confirmation")).toHaveCount(0);
  await shot(page, "02-invite-guest-qr-390x844.png");
  await page.getByRole("tab", { name: "VERIFIED QR" }).click();
  await expect(page.getByAltText("Verified QR — email confirmation")).toBeVisible();
  await expect(page.getByAltText("Guest QR — no email")).toHaveCount(0);
  await shot(page, "03-invite-verified-qr-390x844.png");
  await page.getByRole("tab", { name: "EMAIL INVITE" }).click();
  await expect(page.getByLabel("Player email")).toBeVisible();
  await expect(page.getByAltText("Guest QR — no email")).toHaveCount(0);
  await expect(page.getByAltText("Verified QR — email confirmation")).toHaveCount(0);
  await shot(page, "04-invite-email-390x844.png");
  const guestUrl = await setupJoinUrl(page, "guest");
  await page.getByRole("button", { name: "Close" }).click();

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await guestPage.goto(new URL(guestUrl).pathname);
  await expect(guestPage.getByText("Join without email")).toBeVisible();
  await shot(guestPage, "05-guest-play-name-390x844.png");
  await guestPage.getByLabel("Play name").fill("Casey");
  await guestPage.getByRole("button", { name: "Join table" }).click();
  await expect(guestPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await expect(page.locator("[data-player-row]").filter({ hasText: "Casey" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Table setup");
  await expect(page.locator("[data-table-board=PHASE_ZERO_DEALER]")).toBeVisible();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator("[data-player-row]").filter({ hasText: "Casey" })).toBeVisible();
  await shot(page, "06-dealer-phase0-joined-390x844.png");
  await guestPage.reload();
  await expect(guestPage.locator("[data-table-board=PHASE_ZERO_PLAYER]")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await expect(guestPage.getByText("YOUR JETONS")).toBeVisible();
  await shot(guestPage, "07-guest-phase0-390x844.png");

  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText(/Betting is open\.|Betting open/);
  await expect(page.locator("[data-table-board=BLACKJACK_DEALER]")).toBeVisible();
  await shot(page, "08-dealer-betting-390x844.png");
  await guestPage.reload();
  await expect(guestPage.locator("[data-table-board=BLACKJACK_PLAYER]")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await guestPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect(guestPage.locator("[data-player-wallet]")).toContainText("75", { timeout: 20_000 });
  await shot(guestPage, "09-guest-betting-390x844.png");

  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await shot(page, "10-dealer-playing-390x844.png");
  await guestPage.reload();
  await expect(guestPage.getByRole("button", { name: "DOUBLE" })).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "CLOSE BETTING" })).toHaveCount(0);
  await shot(guestPage, "11-guest-playing-390x844.png");

  await page.getByRole("button", { name: "Open Insurance" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await shot(page, "12-dealer-insurance-390x844.png");
  await guestPage.reload();
  await expect(guestPage.locator("[data-phase-heading]")).toHaveText("INSURANCE OPEN");
  await expect(guestPage.getByRole("button", { name: "PLACE INSURANCE" })).toBeVisible();
  await shot(guestPage, "13-guest-insurance-390x844.png");

  await page.getByRole("button", { name: "Close Insurance" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await page.locator('[data-payout-action="true"]').filter({ hasText: "WON" }).click();
  await shot(page, "14-dealer-payout-390x844.png");
  await guestPage.reload();
  await expect(guestPage.getByRole("button", { name: "DOUBLE" })).toHaveCount(0);
  await expect(guestPage.getByText("YOUR JETONS")).toBeVisible();
  await shot(guestPage, "15-guest-payout-390x844.png");
  await guestContext.close();
});

test("Poker Dealer and Player action boards stay distinct", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("rc3-pk");
  await openAs(context, page, ownerEmail, "Alex");
  await createPokerTable(page, "RC3 Poker", { starting: "100" });
  const joinUrl = await setupJoinUrl(page, "verified");
  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, uniqueEmail("rc3-pk-sam"), "Sam");
  await samPage.goto(new URL(joinUrl).pathname);
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "START HAND", exact: true }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PRE-FLOP", { timeout: 20_000 });
  await shot(page, "16-poker-dealer-action-390x844.png");
  await samPage.reload();
  await expect(samPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(samPage.getByRole("button", { name: "START HAND", exact: true })).toHaveCount(0);
  await shot(samPage, "17-poker-player-action-390x844.png");
  await samContext.close();
});
