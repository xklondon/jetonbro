import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  decodeQrDataUrl,
  expectNoPageScroll,
  noHorizontalOverflow,
  openAs,
  openSetupSheet,
  setupJoinUrl,
  uniqueEmail,
} from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "create-table-invites");

async function shot(page: Page, name: string) {
  await mkdir(out, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => undefined);
  await page.screenshot({ path: join(out, name) });
}

async function openCreateTable(page: Page, context: Parameters<typeof openAs>[0], name: string) {
  await openAs(context, page, uniqueEmail("invite-owner"), "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await openSetupSheet(page);
  await page.getByLabel("Table name").fill(name);
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await expect(page.locator(".sheet.open")).toHaveCount(0);
}

test("Create Table selector mounts Guest QR, Verified QR, and Email controls", async ({ page, context }) => {
  test.setTimeout(120_000);
  await openCreateTable(page, context, "Invite Selector");
  await expect(page.getByRole("tab", { name: "GUEST QR" })).toBeVisible();
  await expect(page.getByAltText("Guest QR — no email")).toHaveCount(0);
  await expect(page.getByLabel("Player email")).toHaveCount(0);

  await page.getByRole("tab", { name: "GUEST QR" }).click();
  await expect(page.locator("[data-selected-invite=guest]")).toBeVisible();
  await expect(page.getByText("Join this table without email. Starts with 100 jetons.")).toBeVisible();
  await expect(page.getByAltText("Guest QR — no email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Link" })).toBeVisible();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  const guestUrl = await setupJoinUrl(page, "guest");
  expect(guestUrl).toContain("/join/guest/");
  expect(guestUrl).not.toMatch(/localhost|railway\.internal/i);
  const guestSrc = await page.getByAltText("Guest QR — no email").getAttribute("src");
  expect(decodeQrDataUrl(guestSrc!)).toBe(guestUrl);
  await expect(page.getByAltText("Verified QR — email confirmation")).toHaveCount(0);
  await expect(page.getByLabel("Player email")).toHaveCount(0);
  await expectNoPageScroll(page);
  await noHorizontalOverflow(page);
  await shot(page, "01-guest-qr-390x844.png");

  await page.getByRole("tab", { name: "VERIFIED QR" }).click();
  await expect(page.locator("[data-selected-invite=verified]")).toBeVisible();
  await expect(page.getByText("Confirm email to become a verified user")).toBeVisible();
  await expect(page.getByAltText("Verified QR — email confirmation")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Link" })).toBeVisible();
  await expect(page.getByAltText("Guest QR — no email")).toHaveCount(0);
  await expect(page.getByLabel("Player email")).toHaveCount(0);
  const verifiedUrl = await setupJoinUrl(page, "verified");
  expect(verifiedUrl).toContain("/join/verified/");
  expect(verifiedUrl).not.toMatch(/localhost|railway\.internal/i);
  const verifiedSrc = await page.getByAltText("Verified QR — email confirmation").getAttribute("src");
  expect(decodeQrDataUrl(verifiedSrc!)).toBe(verifiedUrl);
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await shot(page, "02-verified-qr-390x844.png");

  const inviteEmail = uniqueEmail("invitee");
  await page.getByRole("tab", { name: "EMAIL" }).click();
  await expect(page.locator("[data-selected-invite=email]")).toBeVisible();
  await expect(page.getByLabel("Player email")).toBeVisible();
  await expect(page.getByRole("button", { name: "SEND INVITE" })).toBeVisible();
  await expect(page.getByAltText("Guest QR — no email")).toHaveCount(0);
  await expect(page.locator(".sheet.open")).toHaveCount(0);
  await page.getByLabel("Player email").fill("not-an-email");
  await page.getByRole("button", { name: "SEND INVITE" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await page.getByLabel("Player email").fill(inviteEmail);
  const command = page.waitForRequest((request) => {
    if (request.method() !== "POST" || !request.url().includes("/commands")) return false;
    const body = request.postData() ?? "";
    return body.includes("inviteByEmail") && body.includes(inviteEmail);
  });
  await page.getByRole("button", { name: "SEND INVITE" }).click();
  const posted = await command;
  const payload = posted.postDataJSON() as { command: string; emails: string };
  expect(payload.command).toBe("inviteByEmail");
  expect(payload.emails).toContain(inviteEmail);
  await expect(page.locator("[data-seat-status=Invited]").filter({ hasText: inviteEmail })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Pending")).toBeVisible();
  await expect(page.getByText("Invitation sent.")).toBeVisible();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await shot(page, "03-email-390x844.png");
});

test("isolated Guest join seats a Player and enables START BETTING", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await openCreateTable(page, context, "Guest Join");
  await page.getByRole("tab", { name: "GUEST QR" }).click();
  await expect(page.getByAltText("Guest QR — no email")).toBeVisible();
  const guestUrl = await setupJoinUrl(page, "guest");
  expect(guestUrl).toContain("/join/guest/");

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await guestPage.goto(new URL(guestUrl).pathname);
  await expect(guestPage.getByText("Join without email")).toBeVisible();
  await guestPage.getByLabel("Play name").fill("Casey");
  await guestPage.getByRole("button", { name: "Join table" }).click();
  await expect(guestPage).toHaveURL(/\/tables\//, { timeout: 20_000 });

  await expect(page.locator("[data-player-row]").filter({ hasText: "Casey" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator("[data-table-board=PHASE_ZERO_DEALER]")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "ADD PLAYER" })).toBeVisible();
  await expect(page.locator("[data-player-row]").filter({ hasText: "Casey" })).toBeVisible();
  await shot(page, "04-owner-phase0-open-betting-390x844.png");

  await guestPage.reload();
  await expect(guestPage.locator("[data-table-board=PHASE_ZERO_PLAYER]")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await expect(guestPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(guestPage.getByText("100")).toBeVisible();
  await shot(guestPage, "05-guest-player-phase0-390x844.png");
  await guestContext.close();
});
