import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const out = join(process.cwd(), "docs", "screenshots", "classic");

async function openAs(
  context: BrowserContext,
  page: Page,
  email: string,
  name: string,
) {
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

test("two player sessions join a table and open betting", async ({ page, context, browser }) => {
  await mkdir(out, { recursive: true });
  const ownerEmail = `owner-${randomUUID()}@jetonbro.test`;
  const alexEmail = `alex-${randomUUID()}@jetonbro.test`;
  const joEmail = `jo-${randomUUID()}@jetonbro.test`;

  await openAs(context, page, ownerEmail, "Owner");
  await page.goto("/tables/new");
  await page.getByPlaceholder("Table name").fill("Salon table");
  await page.getByPlaceholder("Starting jetons for you").fill("0");
  await page.getByRole("button", { name: "Open the table" }).click();
  await expect(page.getByText("Table setup")).toBeVisible();
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
