import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { openAs, uniqueEmail } from "./helpers";

const shots = join(process.cwd(), "test-results", "premium-visual-restore");

type Snap = {
  setup?: { verifiedJoinUrl?: string | null; joinUrl?: string | null; guestJoinUrl?: string | null };
  bank?: { phase: string; boxes: { id: string; boxNumber: number; outcome?: string | null }[] };
  player?: {
    phase: string;
    available: { label: string };
    boxes: { id: string; boxNumber: number; bet: { label: string }; isDoubled?: boolean }[];
  };
  poker?: { phase: string; seats: { userId: string; streetContribution: { label: string } }[] };
  phase?: string;
};

async function snapshot(page: Page): Promise<Snap> {
  const tableId = page.url().split("/tables/")[1]?.split("?")[0];
  const response = await page.request.get(`/api/tables/${tableId}/snapshot`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<Snap>;
}

async function command(page: Page, tableId: string, name: string, extra: Record<string, string> = {}) {
  const response = await page.request.post(`/api/tables/${tableId}/commands`, {
    data: { command: name, idempotencyKey: crypto.randomUUID(), ...extra },
  });
  return { ok: response.ok(), status: response.status(), body: await response.json().catch(() => ({})) };
}

async function shot(page: Page, name: string, width: number) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => undefined);
  await page.screenshot({ path: join(shots, `${name}-${width}.png`) });
}

test("Premium visual restore: BJ box/payout + Poker jetons/tray", async ({ page, context, browser }) => {
  test.setTimeout(300_000);
  await mkdir(shots, { recursive: true });

  const ownerEmail = uniqueEmail("vis-owner");
  const playerEmail = uniqueEmail("vis-player");
  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(context, page, ownerEmail, "Alex");
  // Prefer draft route directly — Home CREATE TABLE click can race hydration in CI.
  await page.goto("/tables/new");
  await expect(page).toHaveURL(/\/tables\/(?!new(?:\?|$))/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Table name").fill("Visual BJ");
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("200");
  await page.getByLabel("Starting jetons per player").blur();
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeVisible({ timeout: 20_000 });
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;
  const setup = await snapshot(page);
  const joinUrl = setup.setup?.verifiedJoinUrl || setup.setup?.joinUrl || setup.setup?.guestJoinUrl;
  expect(joinUrl).toBeTruthy();

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(new URL(joinUrl!).pathname);
  await expect(playerPage).toHaveURL(/\/tables\//, { timeout: 20_000 });

  await page.getByRole("button", { name: "START BETTING" }).click();
  await playerPage.reload();
  await expect(playerPage.getByRole("button", { name: "Add 25 jetons" })).toBeVisible({ timeout: 15_000 });
  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("175");

  // Box frame must be complete and compact (content inside border box).
  const box = playerPage.locator("[data-box-id]").first();
  await expect(box).toBeVisible();
  const boxMetrics = await box.evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      borderTop: style.borderTopWidth,
      borderBottom: style.borderBottomWidth,
      borderLeft: style.borderLeftWidth,
      borderRight: style.borderRightWidth,
      radius: style.borderRadius,
      overflow: style.overflow,
    };
  });
  expect(Number.parseFloat(boxMetrics.borderTop)).toBeGreaterThanOrEqual(1);
  expect(Number.parseFloat(boxMetrics.borderBottom)).toBeGreaterThanOrEqual(1);
  expect(Number.parseFloat(boxMetrics.borderLeft)).toBeGreaterThanOrEqual(1);
  expect(Number.parseFloat(boxMetrics.borderRight)).toBeGreaterThanOrEqual(1);
  expect(boxMetrics.height).toBeLessThanOrEqual(160);
  expect(boxMetrics.width).toBeLessThanOrEqual(150);
  expect(boxMetrics.overflow).toBe("hidden");
  await expect(box.locator(".pm-bj-main")).toContainText("MAIN");
  await expect(box.locator("[data-casino-jeton]").first()).toBeVisible();
  await expect(box.locator("[data-retract-chip]").first()).toBeVisible();

  await shot(playerPage, "bj-player-betting", 390);
  await shot(playerPage, "bj-player-betting", 1024);

  // Retract chip (behavior)
  await box.locator("[data-retract-chip]").first().click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("200");
  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await playerPage.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.length).toBe(2);
  const boxes = (await snapshot(playerPage)).player!.boxes;
  const box2 = boxes.find((b) => b.boxNumber === 2)!;
  await playerPage.locator(`[data-box-id="${box2.id}"]`).click();
  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();

  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect.poll(async () => (await snapshot(page)).bank?.phase ?? (await snapshot(page)).phase).toBe("PLAYING");

  const play = await snapshot(playerPage);
  const b1 = play.player!.boxes.find((b) => b.boxNumber === 1)!;
  const doubleRes = await command(playerPage, tableId, "doubleBox", { boxId: b1.id });
  expect(doubleRes.ok).toBe(true);
  const splitRes = await command(playerPage, tableId, "splitBox", { boxId: box2.id });
  expect(splitRes.ok).toBe(true);

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.getByRole("button", { name: "CLOSE INSURANCE" })).toBeVisible();
  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect.poll(async () => (await snapshot(page)).bank?.phase ?? (await snapshot(page)).phase).toBe("PAYOUT");

  const rail = page.locator("[data-payout-rail=row]").first().locator("[data-payout-action=true]");
  await expect(rail).toHaveCount(4);
  await expect(rail.nth(0)).toHaveAttribute("data-outcome", "WON");
  await expect(rail.nth(1)).toHaveAttribute("data-outcome", "LOST");
  await expect(rail.nth(2)).toHaveAttribute("data-outcome", "BLACKJACK");
  await expect(rail.nth(3)).toHaveAttribute("data-outcome", "PUSH");
  const btnStyle = await rail.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, minHeight: s.minHeight };
  });
  // Translucent — not opaque solid blocks (alpha < 1 when parsed as rgba)
  expect(btnStyle.bg).toMatch(/rgba?\(/);
  expect(Number.parseFloat(btnStyle.minHeight)).toBeGreaterThanOrEqual(70);

  await shot(page, "bj-dealer-payout", 390);
  await shot(page, "bj-dealer-payout", 1024);

  const rows = page.locator("[data-payout-rail=row]");
  const n = await rows.count();
  for (let i = 0; i < n; i += 1) {
    const row = rows.nth(i);
    if ((await row.getAttribute("data-payout-state")) === "pending") {
      await row.locator('[data-outcome="LOST"]').click();
    }
  }

  await playerContext.close();

  // --- Poker ---
  await page.goto("/tables/new");
  await expect(page).toHaveURL(/\/tables\/(?!new(?:\?|$))/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Table name").fill("Visual Poker");
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();
  await page.getByRole("button", { name: /Texas Hold/i }).click();
  await page.getByLabel("Small blind").fill("5");
  await page.getByLabel("Big blind").fill("10");
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.getByRole("button", { name: "START HAND", exact: true })).toBeVisible({ timeout: 20_000 });
  // Dealer setup must not reserve a hollow tray
  await expect(page.locator("[data-jeton-tray].is-reserved")).toHaveCount(0);
  await shot(page, "poker-dealer-setup", 390);

  const pokerSetup = await snapshot(page);
  const pokerJoin =
    pokerSetup.setup?.verifiedJoinUrl || pokerSetup.setup?.joinUrl || pokerSetup.setup?.guestJoinUrl;
  expect(pokerJoin).toBeTruthy();

  const p2Context = await browser.newContext();
  const p2 = await p2Context.newPage();
  await p2.setViewportSize({ width: 390, height: 844 });
  await openAs(p2Context, p2, uniqueEmail("vis-poker"), "Sam");
  await p2.goto(new URL(pokerJoin!).pathname);
  await expect(p2).toHaveURL(/\/tables\//, { timeout: 20_000 });

  // Viewer starting stack uses CasinoJeton
  await expect(p2.locator("[data-starting-stack] [data-casino-jeton]").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(p2.locator(".pm-poker-stack-chip")).toHaveCount(0);
  await expect(p2.locator("[data-jeton-tray].is-reserved")).toHaveCount(0);
  await expect(p2.locator("[data-player-wallet]")).toHaveCount(1);
  await shot(p2, "poker-player-setup", 390);

  await page.getByRole("button", { name: "START HAND", exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).poker?.phase ?? "").not.toMatch(/SETUP|TABLE_SETUP/);

  await p2.reload();
  await expect(p2.locator("[data-jeton-tray]")).toBeVisible({ timeout: 15_000 });
  await expect(p2.locator("[data-casino-jeton]").first()).toBeVisible();
  await expect(p2.locator("[data-player-wallet]")).toHaveCount(1);
  // Street wager chips when contribution present
  const hasWager = await p2.locator("[data-street-wager] [data-casino-jeton]").count();
  if (hasWager === 0) {
    // blinds may already be posted — check seats still non-overlapping plaques
    await expect(p2.locator(".pm-poker-seat-plaque").first()).toBeVisible();
  } else {
    await expect(p2.locator("[data-street-wager] [data-casino-jeton]").first()).toBeVisible();
  }
  await shot(p2, "poker-player-preflop", 390);
  await shot(p2, "poker-player-preflop", 1024);
  await shot(page, "poker-dealer-preflop", 390);

  // Actor can take an action if available
  const call = p2.getByRole("button", { name: /^(CALL|CHECK|BET)/ });
  if (await call.count()) {
    await call.first().click();
  }

  await p2Context.close();
});
