import { expect, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import jsQR from "jsqr";
import { PNG } from "pngjs";

export async function openAs(context: BrowserContext, page: Page, email: string, name: string) {
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

export async function openSetupSheet(page: Page) {
  await page.goto("/");
  const create = page.getByRole("button", { name: /CREATE (A|NEW) TABLE/ });
  await expect(create).toBeVisible();
  await create.click();
  await expect(page).toHaveURL(/\/tables\//);
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Blackjack/ })).toBeVisible();
  await expect(page.locator(".setup-mask").getByLabel("Player email")).toBeVisible();
  await expect(page.locator(".setup-mask").getByLabel("Starting jetons per player")).toBeVisible();
  await expect(page.locator(".setup-mask").getByAltText("Shared table join QR code")).toBeVisible();
  await expect(page.locator(".setup-mask").getByText("SCAN TO JOIN TABLE")).toBeVisible();
}

export async function createBlackjackTable(
  page: Page,
  name: string,
  options?: { starting?: string; email?: string },
) {
  await openSetupSheet(page);
  await page.locator(".setup-mask").getByLabel("Table name").fill(name);
  await page.locator(".setup-mask").getByLabel("Starting jetons per player").fill(options?.starting ?? "0");
  if (options?.email) {
    await page.locator(".setup-mask").getByLabel("Player email").fill(options.email);
  }
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page.getByText("CURRENT PHASE:")).toBeVisible();
  await expect(page.getByText("TABLE SETUP", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ PLAYER" })).toBeVisible();
  await expect(page.getByRole("button", { name: "QR" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toHaveCount(0);
  await expect(page.locator(".waiting-room")).toHaveCount(0);
}

export async function invitePlayerFromLobby(page: Page, email: string) {
  await page.getByRole("button", { name: "+ PLAYER" }).click();
  await page.getByLabel("Player email").fill(email);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("Invited")).toBeVisible();
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
}

export async function swipePayoutRow(page: Page, boxId: string, direction: "right" | "left") {
  const inner = page.locator(`[data-box-id="${boxId}"] .payout-row-inner`);
  await expect(inner).toBeVisible();
  const box = await inner.boundingBox();
  if (!box) throw new Error("missing payout row");
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (direction === "right" ? 120 : -120), y, { steps: 12 });
  await page.mouse.up();
}

export async function doubleTapPayoutRow(page: Page, boxId: string) {
  const inner = page.locator(`[data-box-id="${boxId}"] .payout-row-inner`);
  await expect(inner).toBeVisible();
  const box = await inner.boundingBox();
  if (!box) throw new Error("missing payout row");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@jetonbro.test`;
}

export function decodeQrDataUrl(dataUrl: string): string | null {
  const encoded = dataUrl.split(",")[1];
  if (!encoded) return null;
  const png = PNG.sync.read(Buffer.from(encoded, "base64"));
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return code?.data ?? null;
}
