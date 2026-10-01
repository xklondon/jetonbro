import { expect, test, type Page } from "@playwright/test";
import { createBlackjackTable, decodeQrDataUrl, openAs, openInviteMask, uniqueEmail, openTableMenu } from "./helpers";

async function decodeSetupQr(page: Page) {
  return page.evaluate(async () => {
    const img = document.querySelector('[data-invite-kind="verified"] img') as HTMLImageElement | null;
    const fallback = document.querySelector("[data-verified-join-url]")?.getAttribute("data-verified-join-url") ?? null;
    if (!img) return { decoded: null, fallback, complete: false };
    await img.decode();
    const rect = img.getBoundingClientRect();
    let decoded: string | null = null;
    if ("BarcodeDetector" in window) {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(img);
      decoded = codes[0]?.rawValue ?? null;
    }
    return {
      decoded,
      fallback,
      complete: rect.width > 80 && rect.height > 80,
      top: rect.top,
      bottom: rect.bottom,
      setupTop: document.querySelector("[data-phase-action]")?.getBoundingClientRect().top ?? 0,
    };
  });
}

test("setup QR is fully visible, decodes to the shared join URL, and two players can use it", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120_000);
  const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const ownerEmail = uniqueEmail("qr-bank");
  await openAs(context, page, ownerEmail, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await page.getByLabel("Table name").fill("QR table");
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeVisible();
  await openInviteMask(page);
  await page.getByRole("tab", { name: "VERIFIED QR" }).click();
  await expect(page.getByAltText("Verified QR — email confirmation")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Verified Link" })).toBeVisible();
  const qrBox = await page.getByAltText("Verified QR — email confirmation").boundingBox();
  const copyBox = await page.getByRole("button", { name: "Copy Verified Link" }).boundingBox();
  const startBox = await page.getByRole("button", { name: "OPEN BETTING" }).boundingBox();
  expect(qrBox).toBeTruthy();
  expect(copyBox).toBeTruthy();
  expect(startBox).toBeTruthy();
  expect(qrBox!.y).toBeGreaterThan(0);
  expect(startBox!.y + startBox!.height).toBeLessThan(844);

  const snapshot = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  const data = (await snapshot.json()) as { setup?: { joinUrl: string | null; verifiedJoinUrl?: string | null } };
  const expectedUrl = data.setup?.verifiedJoinUrl ?? data.setup?.joinUrl;
  expect(expectedUrl).toBeTruthy();
  expect(expectedUrl).not.toMatch(/railway\.internal/i);
  const src = await page.getByAltText("Verified QR — email confirmation").getAttribute("src");
  expect(src).toBeTruthy();
  const decoded = decodeQrDataUrl(src!);
  expect(decoded).toBe(expectedUrl);
  expect(decoded).not.toMatch(/railway\.internal/i);
  expect(decoded).toContain("/join/");

  await page.getByRole("button", { name: "Copy Verified Link" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(expectedUrl);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".sheet.open")).toHaveCount(0);

  await page.reload();
  await openInviteMask(page);
  await page.getByRole("tab", { name: "VERIFIED QR" }).click();
  await expect(page.getByAltText("Verified QR — email confirmation")).toBeVisible();
  const afterReload = await decodeSetupQr(page);
  expect(afterReload.fallback).toBe(expectedUrl);

  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.getByAltText("Verified QR — email confirmation")).toBeVisible();
  await page.getByAltText("Verified QR — email confirmation").scrollIntoViewIfNeeded();
  const small = await decodeSetupQr(page);
  expect(small.complete).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  const joinPath = new URL(expectedUrl!).pathname;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, uniqueEmail("qr-sam"), "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, uniqueEmail("qr-jo"), "Jo");
  await joPage.goto(joinPath);
  await expect(joPage.getByText(/Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });

  await samContext.close();
  await joContext.close();
});

test("two Bank sessions cannot create two next rounds after payout", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("restart-bank");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Restart table", { starting: "100" });
  const setupSnap = (await page.request
    .get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`)
    .then((response) => response.json())) as { setup?: { joinUrl: string | null } };
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;
  const tableUrl = page.url();

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, uniqueEmail("restart-sam"), "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();

  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await samPage.reload();
  await samPage.getByRole("button", { name: "Add 25 jetons" }).click({ force: true });
  await expect(samPage.getByText("75", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "CLOSE BETTING" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  const payout = (await page.request
    .get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`)
    .then((response) => response.json())) as { bank?: { boxes: { id: string }[] } };
  for (const box of payout.bank?.boxes ?? []) {
    await page.locator(`[data-box-id="${box.id}"]`).getByRole("button", { name: /STAND OFF/ }).click({ force: true });
  }
  await expect(page.getByRole("button", { name: "START NEXT ROUND" })).toBeEnabled({ timeout: 10_000 });

  const bankTwoContext = await browser.newContext();
  const bankTwo = await bankTwoContext.newPage();
  await openAs(bankTwoContext, bankTwo, ownerEmail, "Alex");
  await bankTwo.goto(tableUrl);
  await expect(bankTwo.getByRole("button", { name: "START NEXT ROUND" })).toBeEnabled({ timeout: 10_000 });
  await openTableMenu(page);
  await page.locator(".sheet.open").getByRole("button", { name: "IN 7 SECONDS", exact: true }).click();
  await expect(page.getByText(/Next round in [1-7]/)).toBeVisible();
  await page.getByRole("button", { name: "START NEXT ROUND" }).click();
  await bankTwo.getByRole("button", { name: "START NEXT ROUND" }).click({ force: true }).catch(() => undefined);
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await samPage.reload();
  await expect(samPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await expect(page.getByText(/Next round in/)).toHaveCount(0);
  await expect(samPage.locator(".outcome-celebration")).toHaveCount(0);

  await samContext.close();
  await bankTwoContext.close();
});
