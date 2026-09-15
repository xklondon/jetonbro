import { expect, test } from "@playwright/test";
import { createBlackjackTable, openAs, uniqueEmail } from "./helpers";

test("shared QR, bet, countdown and PLAYING", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  const ownerEmail = uniqueEmail("bank");
  const samEmail = uniqueEmail("sam");
  const joEmail = uniqueEmail("jo");

  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Salon table", { starting: "100" });
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeDisabled();
  await expect(page.locator(".waiting-room")).toHaveCount(0);
  await expect(page.getByText("CURRENT PHASE:")).toBeVisible();
  await expect(page.getByText("TABLE SETUP", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "QR" }).click();
  await expect(page.locator(".sheet.open").getByAltText("Shared table join QR code")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  const snapshot = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  const data = (await snapshot.json()) as { setup?: { joinUrl: string | null }; phase?: string };
  expect(data.phase).toBe("TABLE_SETUP");
  expect(data.setup?.joinUrl).toBeTruthy();
  const joinPath = new URL(data.setup!.joinUrl!).pathname;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(joinPath);
  await expect(joPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  await expect(page.locator(".setup-seat").filter({ hasText: /Joined|Ready/ }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled();
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await expect(page.getByText("CURRENT PHASE:")).toBeVisible();
  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "DEAL IN 7 SECONDS" })).toBeDisabled();

  await samPage.reload();
  await expect(samPage.getByText("YOUR JETONS")).toBeVisible();
  await samPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect(samPage.getByText("75", { exact: true }).first()).toBeVisible();
  await expect(samPage.getByLabel("Retract 25 jetons from Box 1")).toBeVisible();

  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL IN 7 SECONDS" }).click();
  await expect(page.getByText(/Cards in [1-7]/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Cards in [1-7]/)).toBeVisible();
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await expect(page.getByText("CURRENT PHASE:")).toBeVisible();
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();

  await samPage.reload();
  await expect(samPage.getByRole("button", { name: "Double" })).toBeVisible();

  await samContext.close();
  await joContext.close();
});
