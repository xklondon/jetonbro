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
  const create = page.getByRole("button", { name: "CREATE TABLE" });
  await expect(create).toBeVisible();
  await create.click();
  await expect(page).toHaveURL(/\/tables\/(?!new(?:\?|$))/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Table name")).toBeVisible();
  await expect(page.getByLabel("Starting jetons per player")).toBeVisible();
}

export async function createPokerTable(
  page: Page,
  name: string,
  options?: { starting?: string; smallBlind?: string; bigBlind?: string },
) {
  await openSetupSheet(page);
  await page.getByLabel("Table name").fill(name);
  await page.getByLabel("Table name").blur();
  await expect(page.getByLabel("Table name")).toHaveValue(name);
  await page.getByLabel("Starting jetons per player").fill(options?.starting ?? "0");
  await page.getByLabel("Starting jetons per player").blur();
  await page.getByRole("button", { name: /Texas Hold/i }).click();
  await expect(page.locator("[data-selected-game=POKER]")).toBeVisible();
  if (options?.smallBlind) await page.getByLabel("Small blind").fill(options.smallBlind);
  if (options?.bigBlind) await page.getByLabel("Big blind").fill(options.bigBlind);
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator("[data-phase-heading]").first()).toHaveText(/TABLE SETUP/i, { timeout: 20_000 });
  await expect(page.locator("[data-table-name]")).toHaveText(name, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START HAND", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "START HAND", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "START BLACKJACK" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toHaveCount(0);
  await expect(page.getByText(/Texas Hold.?em needs at least two/i)).toHaveCount(0);
}

export async function openInviteMask(page: Page) {
  const add = page.getByRole("button", { name: /ADD (NEW )?PLAYERS?/i });
  if (await add.count()) {
    if (!(await page.locator(".sheet.open .invite-mask").count())) {
      await add.click();
    }
    await expect(page.locator(".sheet.open .invite-mask")).toBeVisible();
    return;
  }
  await expect(page.getByRole("tab", { name: "GUEST QR" })).toBeVisible({ timeout: 20_000 });
}

export async function setupJoinUrl(page: Page, kind: "guest" | "verified" = "verified") {
  const attr = kind === "guest" ? "data-guest-join-url" : "data-verified-join-url";
  const el = page.locator(`[${attr}]`).first();
  await expect(el).toBeAttached({ timeout: 20_000 });
  const url = await el.getAttribute(attr);
  if (!url) throw new Error(`${kind} join URL missing`);
  return url;
}

export async function createBlackjackTable(
  page: Page,
  name: string,
  options?: { starting?: string; email?: string },
) {
  await openSetupSheet(page);
  await page.getByLabel("Table name").fill(name);
  await page.getByLabel("Table name").blur();
  await expect(page.getByLabel("Table name")).toHaveValue(name);
  await page.getByLabel("Starting jetons per player").fill(options?.starting ?? "0");
  await page.getByLabel("Starting jetons per player").blur();
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page).toHaveURL(/\/tables\/(?!new(?:\?|$))/);
  await expect(page.locator("[data-phase-heading]").first()).toHaveText(/TABLE SETUP/i, { timeout: 20_000 });
  await expect(page.locator("[data-table-name]")).toHaveText(name, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeVisible();
  await expect(page.getByRole("button", { name: "START BLACKJACK" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "START POKER" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /ADD PLAYER/i })).toBeVisible();
  await expect(page.getByAltText("Guest QR — no email")).toHaveCount(0);
  await expect(page.locator(".setup-mask")).toHaveCount(0);
  await expect(page.locator(".waiting-room")).toHaveCount(0);
  if (options?.email) {
    await invitePlayerFromLobby(page, options.email);
  }
}

export async function openTableMenu(page: Page) {
  if (await page.locator(".sheet.open").count()) {
    await closeTableMenu(page);
  }
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.locator(".sheet.open")).toBeVisible();
}

export async function closeTableMenu(page: Page) {
  const sheet = page.locator(".sheet.open");
  if (!(await sheet.count())) return;
  const dismiss = sheet.getByRole("button", { name: /^(Cancel|Close)$/ });
  if (await dismiss.count()) {
    await dismiss.last().click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(page.locator(".sheet.open")).toHaveCount(0);
}

export async function giveJetonsFromMenu(page: Page) {
  await openTableMenu(page);
  await page.locator(".sheet.open").getByRole("button", { name: "GIVE JETONS" }).click();
}

export async function scheduleDealFromMenu(page: Page) {
  await openTableMenu(page);
  await page.locator(".sheet.open").getByRole("button", { name: "DEAL IN 7 SECONDS" }).click();
}

export async function addLocalPlayerFromMenu(page: Page, name: string) {
  await openTableMenu(page);
  await page.getByRole("button", { name: "ADD LOCAL PLAYER" }).click();
  await page.getByLabel("Player name").fill(name);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".sheet.open")).toHaveCount(0);
}

export async function invitePlayerFromLobby(page: Page, email: string) {
  await openInviteMask(page);
  await page.getByRole("tab", { name: /EMAIL/i }).click();
  await expect(page.getByLabel("Player email")).toBeVisible();
  await page.getByLabel("Player email").fill(email);
  await page.getByRole("button", { name: /^SEND/i }).click();
  await expect(page.getByText("Pending")).toBeVisible();
  const close = page.locator(".invite-mask, .sheet.open").getByRole("button", { name: "Close" });
  if (await close.count()) {
    await close.first().click();
    await expect(page.locator(".sheet.open")).toHaveCount(0);
  }
}

export async function expectPokerPhase(page: Page, label: string, options?: { timeout?: number }) {
  await expect(page.locator("[data-phase-heading]")).toHaveText(label, { timeout: options?.timeout ?? 15_000 });
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

export async function expectNoPageScroll(page: Page) {
  const scrolled = await page.evaluate(() => {
    const phone = document.querySelector(".tt-phone, .phone");
    const felt = document.querySelector("main.tt-felt, main.felt");
    return {
      phone: phone ? phone.scrollHeight > phone.clientHeight + 2 : false,
      felt: felt ? felt.scrollHeight > felt.clientHeight + 2 : false,
      missing: !phone || !felt,
    };
  });
  expect(scrolled.missing).toBe(false);
  expect(scrolled.phone).toBe(false);
  expect(scrolled.felt).toBe(false);
}

export async function expectNoDocumentScroll(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.innerHeight + 2);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
}

export async function expectPlayerPayoutIdle(page: Page) {
  await expect(page.getByRole("button", { name: "DOUBLE" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "2×" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "SPLIT" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "INSURANCE", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PLACE BET", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "RETRACT" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ADD BOX" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PLACE INSURANCE" })).toHaveCount(0);
  await expect(page.locator("[data-play-controls]")).toHaveCount(0);
  await expect(page.locator("[data-player-wallet]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add 25 jetons" })).toBeDisabled();
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
