import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

test("two player sessions join a table and open betting", async ({ page, context, browser }) => {
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("owner");
  const alexEmail = uniqueEmail("alex");
  const joEmail = uniqueEmail("jo");

  await openAs(context, page, ownerEmail, "Owner");
  await createBlackjackTable(page, "Salon table");
  await page.screenshot({ path: join(out, "app-setup-390x844.png") });

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

  const snapshot = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  const data = (await snapshot.json()) as { setup?: { joinUrl: string | null } };
  expect(data.setup?.joinUrl).toBeTruthy();

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(new URL(data.setup!.joinUrl!).pathname);
  await expect(joPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  await page.reload();
  await expect(page.locator(".member-row strong").filter({ hasText: "Alex" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Show QR" }).click();
  await expect(page.getByAltText("Table join QR code")).toBeVisible();

  const memberSelect = page.locator("select").last();
  await memberSelect.selectOption({ label: "Alex" });
  await page.getByPlaceholder("Jeton amount").fill("100");
  await page.getByRole("button", { name: "Give jetons" }).click();
  await page.getByRole("button", { name: "Start betting" }).click();
  await expect(page.getByText(/CURRENT PHASE/i)).toBeVisible();
  await alexPage.reload();
  await expect(alexPage.getByText("YOUR JETONS")).toBeVisible();
});
