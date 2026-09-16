import { expect, test, type Page } from "@playwright/test";
import { createBlackjackTable, decodeQrDataUrl, openAs, uniqueEmail } from "./helpers";

async function decodeSetupQr(page: Page) {
  return page.evaluate(async () => {
    const img = document.querySelector(".setup-qr img") as HTMLImageElement | null;
    const fallback = document.querySelector(".setup-qr")?.getAttribute("data-join-url") ?? null;
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
      complete: rect.top >= 0 && rect.bottom <= window.innerHeight && rect.width > 80 && rect.height > 80,
      top: rect.top,
      bottom: rect.bottom,
      setupTop: document.querySelector(".setup-sheet-actions")?.getBoundingClientRect().top ?? 0,
    };
  });
}

test("setup QR is fully visible, decodes to the shared join URL, and two players can use it", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(120_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:3000" });
  const ownerEmail = uniqueEmail("qr-bank");
  await openAs(context, page, ownerEmail, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "CREATE A TABLE" }).click();
  await expect(page.locator(".setup-qr img")).toBeVisible();
  await expect(page.getByText("SCAN TO JOIN TABLE")).toBeVisible();
  await expect(page.getByRole("button", { name: "COPY LINK" })).toBeVisible();
  await expect(page.getByRole("button", { name: "SHARE" })).toBeVisible();
  await expect(page.getByText("OR INVITE BY EMAIL")).toBeVisible();
  const emailBox = page.locator(".setup-mask").getByLabel("Player email");
  await expect(emailBox).toBeVisible();
  const qrBox = await page.locator(".setup-qr img").boundingBox();
  const copyBox = await page.getByRole("button", { name: "COPY LINK" }).boundingBox();
  const setupBox = await page.getByRole("button", { name: "CREATE TABLE" }).boundingBox();
  expect(qrBox).toBeTruthy();
  expect(copyBox).toBeTruthy();
  expect(setupBox).toBeTruthy();
  expect(qrBox!.y).toBeGreaterThan(0);
  expect(qrBox!.y + qrBox!.height).toBeLessThan(copyBox!.y + 8);
  expect(copyBox!.y + copyBox!.height).toBeLessThan(emailBox ? (await emailBox.boundingBox())!.y + 40 : 800);
  expect(qrBox!.y + qrBox!.height).toBeLessThan(setupBox!.y);
  expect(setupBox!.y + setupBox!.height).toBeLessThan(844);

  const snapshot = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  const data = (await snapshot.json()) as { setup?: { joinUrl: string | null } };
  expect(data.setup?.joinUrl).toBeTruthy();
  expect(data.setup!.joinUrl).not.toMatch(/railway\.internal/i);
  const src = await page.locator(".setup-qr img").getAttribute("src");
  expect(src).toBeTruthy();
  const decoded = decodeQrDataUrl(src!);
  expect(decoded).toBe(data.setup!.joinUrl);
  expect(decoded).not.toMatch(/railway\.internal/i);
  expect(decoded).toContain("/join/");

  await page.getByRole("button", { name: "COPY LINK" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(data.setup!.joinUrl);

  await page.reload();
  await expect(page.locator(".setup-qr img")).toBeVisible();
  const afterReload = await decodeSetupQr(page);
  expect(afterReload.fallback).toBe(data.setup!.joinUrl);

  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.locator(".setup-qr img")).toBeVisible();
  const small = await decodeSetupQr(page);
  expect(small.complete).toBe(true);
  expect(small.bottom).toBeLessThan(small.setupTop + 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".setup-mask").getByLabel("Starting jetons per player").fill("100");
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  const joinPath = new URL(data.setup!.joinUrl!).pathname;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, uniqueEmail("qr-sam"), "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, uniqueEmail("qr-jo"), "Jo");
  await joPage.goto(joinPath);
  await expect(joPage.getByText(/Waiting for the Bank/i)).toBeVisible();
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
  await expect(samPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await samPage.reload();
  await samPage.getByRole("button", { name: "Add 25 jetons" }).click({ force: true });
  await expect(samPage.getByText("75", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  const payout = (await page.request
    .get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`)
    .then((response) => response.json())) as { bank?: { boxes: { id: string }[] } };
  for (const box of payout.bank?.boxes ?? []) {
    await page.locator(`[data-box-id="${box.id}"]`).getByRole("button", { name: /STAND OFF/ }).click({ force: true });
  }
  await expect(page.getByRole("button", { name: "NEXT ROUND NOW" })).toBeEnabled({ timeout: 10_000 });

  const bankTwoContext = await browser.newContext();
  const bankTwo = await bankTwoContext.newPage();
  await openAs(bankTwoContext, bankTwo, ownerEmail, "Alex");
  await bankTwo.goto(tableUrl);
  await expect(bankTwo.getByRole("button", { name: "NEXT ROUND NOW" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "NEXT ROUND IN 7 SECONDS" }).click();
  await expect(page.getByText(/Next round in [1-7]/)).toBeVisible();
  await page.getByRole("button", { name: "NEXT ROUND NOW" }).click();
  await bankTwo.getByRole("button", { name: "NEXT ROUND NOW" }).click({ force: true }).catch(() => undefined);
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await samPage.reload();
  await expect(samPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await expect(page.getByText(/Next round in/)).toHaveCount(0);
  await expect(samPage.locator(".outcome-celebration")).toHaveCount(0);

  await samContext.close();
  await bankTwoContext.close();
});
