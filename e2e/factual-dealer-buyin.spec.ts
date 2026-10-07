import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  createPokerTable,
  expectNoDocumentScroll,
  openAs,
  setupJoinUrl,
  uniqueEmail,
} from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "factual-dealer-buyin");

type Snap = {
  player?: {
    available: { label: string };
    boxes: { id: string; boxNumber: number; bet: { label: string } }[];
  };
  bank?: { boxes: { id: string }[]; players?: { userId: string }[] };
  poker?: { seats: { userId: string; available: { label: string } }[]; canGiveJetons?: boolean; phase?: string };
  members?: { userId: string; available?: { label: string } | null; name: string }[];
};

async function snapshot(page: Page): Promise<Snap> {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((r) => r.json());
}

async function shot(page: Page, name: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(shots, `${name}-390x844.png`), fullPage: false });
}

test("factual Dealer anatomy + Poker Owner buy-in screenshots", async ({ page, context, browser }) => {
  test.setTimeout(300_000);
  await mkdir(shots, { recursive: true });

  await openAs(context, page, uniqueEmail("fact-own"), "Dee");
  await createBlackjackTable(page, "Factual Salon", { starting: "100" });

  await expect(page.locator("[data-dealer-empty=true]")).toBeVisible();
  await expect(page.locator("[data-blackjack-box-row]")).toHaveCount(0);
  await expect(page.getByText("No players have joined yet.")).toBeVisible();
  await expect(page.getByText("Open seat")).toHaveCount(0);
  await expect(page.locator("[data-table-cloth=true]")).toBeVisible();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeDisabled();
  await shot(page, "01-empty-dealer-setup");

  const guestUrl = await setupJoinUrl(page, "guest");
  async function joinGuest(name: string) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(new URL(guestUrl, page.url()).pathname);
    await p.getByLabel("Play name").fill(name);
    await p.getByRole("button", { name: "Join table" }).click();
    return { ctx, page: p };
  }

  const casey = await joinGuest("Casey");
  await expect(casey.page.getByText(/Waiting for the table to open betting/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-blackjack-box-row]")).toHaveCount(1);
  await expect(page.locator("[data-membership-id]")).toHaveCount(1);
  await expect(page.getByText("No players have joined yet.")).toHaveCount(0);
  await shot(page, "02-joined-player-setup");

  const riley = await joinGuest("Riley");
  await expect(riley.page.getByText(/Waiting for the table to open betting/i)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();

  await casey.page.reload();
  await expect(casey.page.getByText("YOUR JETONS")).toBeVisible();
  await casey.page.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.available.label).toBe("75");
  await expect(page.locator("[data-blackjack-box-row]")).toHaveCount(2);
  await shot(page, "03-dealer-betting-one-box");

  await casey.page.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.boxes.length).toBe(2);
  const caseyBoxes = (await snapshot(casey.page)).player!.boxes;
  const caseyBox2 = caseyBoxes.find((b) => b.boxNumber === 2)!;
  await casey.page.locator(`[data-box-id="${caseyBox2.id}"]`).click();
  await casey.page.getByRole("button", { name: "Add 10 jetons" }).click();

  await riley.page.reload();
  await expect(riley.page.getByText("YOUR JETONS")).toBeVisible();
  await riley.page.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(page)).bank?.boxes.length ?? 0).toBeGreaterThanOrEqual(3);
  await shot(page, "04-dealer-betting-multiple-boxes");
  await shot(casey.page, "09-player-view-shared-cloth");
  await expect(casey.page.locator("[data-table-cloth=true]")).toBeVisible();

  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await shot(page, "05-dealer-playing");

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await shot(page, "06-dealer-insurance");
  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-payout-rail=row]").first()).toBeVisible();
  const rail = page.locator("[data-payout-rail=row]").first();
  await expect(rail.locator("[data-payout-action=true]")).toHaveCount(4);
  const box = await rail.boundingBox();
  expect(box).toBeTruthy();
  const buttons = rail.locator("[data-payout-action=true]");
  const y0 = (await buttons.nth(0).boundingBox())!.y;
  for (let i = 1; i < 4; i += 1) {
    const y = (await buttons.nth(i).boundingBox())!.y;
    expect(Math.abs(y - y0)).toBeLessThan(8);
  }
  await shot(page, "07-dealer-payout-unresolved");

  while (await page.locator("[data-payout-action=true]").count()) {
    await page.locator("[data-payout-action=true]").filter({ hasText: /^LOST$/ }).first().click();
  }
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 15_000 });
  await shot(page, "08-dealer-payout-resolved");

  for (const [w, h] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expectNoDocumentScroll(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  }

  await casey.ctx.close();
  await riley.ctx.close();

  // Poker Owner buy-in
  await page.goto("/");
  await createPokerTable(page, "Buy-in Felt", { starting: "0", smallBlind: "5", bigBlind: "10" });
  const pokerGuest = await setupJoinUrl(page, "guest");
  const samCtx = await browser.newContext();
  const sam = await samCtx.newPage();
  await sam.setViewportSize({ width: 390, height: 844 });
  await sam.goto(new URL(pokerGuest, page.url()).pathname);
  await sam.getByLabel("Play name").fill("Sam");
  await sam.getByRole("button", { name: "Join table" }).click();
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole("button", { name: "BUY-IN" })).toBeVisible();
  await page.getByRole("button", { name: "BUY-IN" }).click();
  await expect(page.getByRole("heading", { name: "Buy-in" })).toBeVisible();
  await page.getByLabel("Player").selectOption({ label: "Sam" });
  await page.getByLabel("Jeton amount").fill("80");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect.poll(async () => {
    const snap = await snapshot(page);
    return snap.poker?.seats.find((s) => s.available.label === "80" || Number(s.available.label) >= 80);
  }).toBeTruthy();
  await shot(page, "10-poker-owner-buy-in");

  // Fund Owner too so START HAND can proceed, then permission check on Sam
  await page.getByRole("button", { name: "BUY-IN" }).click();
  await page.getByLabel("Player").selectOption({ label: "Dee" });
  await page.getByLabel("Jeton amount").fill("100");
  await page.getByRole("button", { name: "Confirm" }).click();

  await sam.reload();
  await expect(sam.getByRole("button", { name: "BUY-IN" })).toHaveCount(0);
  await shot(sam, "11-poker-player-without-buy-in");

  await page.reload();
  await expect.poll(async () => (await snapshot(page)).poker?.seats.some((s) => Number(s.available.label) >= 80)).toBe(true);
  await shot(page, "12-poker-after-buy-in-refresh");

  await samCtx.close();
});
