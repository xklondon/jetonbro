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
  await expect(page).toHaveURL(/\/tables\/(?!new(?:\?|$))/);
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Blackjack/ })).toBeVisible();
  await expect(page.locator(".setup-mask").getByLabel("Player email")).toBeVisible();
  await expect(page.locator(".setup-mask").getByLabel("Starting jetons per player")).toBeVisible();
  await expect(page.locator(".setup-mask").getByAltText("Shared table join QR code")).toBeVisible();
  await expect(page.locator(".setup-mask").getByText("SCAN TO JOIN TABLE")).toBeVisible();
}

export async function createPokerTable(
  page: Page,
  name: string,
  options?: { starting?: string; smallBlind?: string; bigBlind?: string },
) {
  await openSetupSheet(page);
  await page.getByRole("button", { name: /Texas Hold/ }).click();
  await expect(page.getByLabel("Small blind")).toBeVisible();
  await expect(page.getByLabel("Big blind")).toBeVisible();
  await expect(page.getByLabel("Dealer rotation order")).toBeVisible();
  await page.locator(".setup-mask").getByLabel("Table name").fill(name);
  await page.locator(".setup-mask").getByLabel("Starting jetons per player").fill(options?.starting ?? "0");
  if (options?.smallBlind) {
    await page.getByLabel("Small blind").fill(options.smallBlind);
  }
  if (options?.bigBlind) {
    await page.getByLabel("Big blind").fill(options.bigBlind);
  }
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("POKER SETUP");
  await expect(page.getByText("POKER SETUP", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "DEAL CARDS", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toHaveCount(0);
}

export async function setupJoinUrl(page: Page) {
  await expect(page.locator(".setup-mask [data-join-url]")).toBeVisible();
  return page.locator(".setup-mask [data-join-url]").getAttribute("data-join-url");
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
  await expect(page.locator("[data-phase-heading]")).toHaveText("TABLE SETUP");
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

export async function expectPokerPhase(page: Page, label: string, options?: { timeout?: number }) {
  await expect(page.locator(".phase-head span strong")).toHaveText(label, { timeout: options?.timeout ?? 15_000 });
  const rail: Record<string, string> = {
    "PRE-FLOP": "PRE-FLOP",
    FLOP: "FLOP",
    TURN: "TURN",
    RIVER: "RIVER",
    SHOWDOWN: "SHOWDOWN",
  };
  const stop = rail[label];
  if (stop) {
    await expect(page.locator(`[data-rail="${stop}"][data-rail-state="current"]`)).toBeVisible();
  }
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
}

export async function swipePlayerBoxes(
  page: Page,
  direction: "left" | "right",
  options?: { pointerType?: "mouse" | "touch"; distance?: number },
) {
  const area = page.locator("[data-box-nav=true]");
  await expect(area).toBeVisible();
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  const box = await area.boundingBox();
  if (!box) throw new Error("missing box nav");
  const distance = options?.distance ?? 140;
  const y = box.y + Math.min(36, box.height / 5);
  const x = box.x + box.width / 2;
  const dx = direction === "left" ? -distance : distance;
  if (options?.pointerType === "touch") {
    await area.evaluate(
      (el, coords) => {
        const fire = (type: string, clientX: number, clientY: number) => {
          el.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              composed: true,
              pointerId: 1,
              pointerType: "touch",
              isPrimary: true,
              button: 0,
              buttons: type === "pointerup" ? 0 : 1,
              clientX,
              clientY,
            }),
          );
        };
        fire("pointerdown", coords.x, coords.y);
        fire("pointermove", coords.x + coords.dx / 3, coords.y);
        fire("pointermove", coords.x + (coords.dx * 2) / 3, coords.y);
        fire("pointermove", coords.x + coords.dx, coords.y);
        fire("pointerup", coords.x + coords.dx, coords.y);
      },
      { x, y, dx },
    );
    return;
  }
  await pointerSwipe(page, area, x, y, x + dx, y);
}

export async function swipePayoutRow(
  page: Page,
  boxId: string,
  direction: "right" | "left",
  distance = 120,
) {
  const row = page.locator(`[data-box-id="${boxId}"][data-payout-row], [data-box-id="${boxId}"][data-payout-gesture]`);
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  if (!box) throw new Error("missing payout row");
  const y = box.y + Math.min(28, box.height / 5);
  const x = box.x + box.width / 2;
  const dx = direction === "right" ? distance : -distance;
  await pointerSwipe(page, row, x, y, x + dx, y);
}

export async function dragPayoutRow(
  page: Page,
  boxId: string,
  direction: "right" | "left",
  options?: { distance?: number; release?: boolean },
) {
  const row = page.locator(`[data-box-id="${boxId}"][data-payout-row], [data-box-id="${boxId}"][data-payout-gesture]`);
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  if (!box) throw new Error("missing payout row");
  const y = box.y + Math.min(28, box.height / 5);
  const x = box.x + box.width / 2;
  const dx = direction === "right" ? (options?.distance ?? 90) : -(options?.distance ?? 90);
  await pointerSwipe(page, row, x, y, x + dx, y, { release: options?.release !== false });
}

export async function doubleTapPayoutRow(page: Page, boxId: string) {
  const inner = page.locator(`[data-box-id="${boxId}"] .payout-row-inner`);
  await expect(inner).toBeVisible();
  await inner.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
  const box = await inner.boundingBox();
  if (!box) throw new Error("missing payout row");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.up().catch(() => undefined);
  await page.mouse.move(x, y);
  await page.mouse.click(x, y, { clickCount: 2, delay: 40 });
}

async function pointerSwipe(
  page: Page,
  locator: ReturnType<Page["locator"]>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options?: { release?: boolean },
) {
  await locator.scrollIntoViewIfNeeded();
  await page.mouse.up().catch(() => undefined);
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, y1, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 10 });
  if (options?.release !== false) await page.mouse.up();
}

export async function releasePayoutDrag(page: Page, boxId: string, direction: "right" | "left", distance = 90) {
  const row = page.locator(`[data-box-id="${boxId}"][data-payout-row], [data-box-id="${boxId}"][data-payout-gesture]`);
  const box = await row.boundingBox();
  if (!box) throw new Error("missing payout row");
  const y = box.y + Math.min(28, box.height / 5);
  const x = box.x + box.width / 2 + (direction === "right" ? distance : -distance);
  await page.mouse.move(x, y);
  await page.mouse.up();
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
