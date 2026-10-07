import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  expectNoDocumentScroll,
  openAs,
  setupJoinUrl,
  uniqueEmail,
} from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "blackjack-table-composition");

type Snap = {
  player?: {
    available: { label: string };
    boxes: { id: string; boxNumber: number; bet: { label: string } }[];
  };
  bank?: { boxes: { id: string }[]; players?: { userId: string }[]; phase?: string };
};

type Box = { x: number; y: number; width: number; height: number };

async function snapshot(page: Page): Promise<Snap> {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((r) => r.json());
}

async function shot(page: Page, name: string, size: { width: number; height: number } = { width: 390, height: 844 }) {
  await page.setViewportSize(size);
  await page.screenshot({ path: join(shots, `${name}-${size.width}x${size.height}.png`), fullPage: false });
}

function intersects(a: Box, b: Box) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function zoneBox(page: Page, zone: string): Promise<Box> {
  const box = await page.locator(`[data-table-zone="${zone}"]`).boundingBox();
  expect(box, `missing zone ${zone}`).toBeTruthy();
  return box!;
}

async function assertCleanGeometry(page: Page) {
  await expect(page.locator("[data-blackjack-table-surface=true]")).toBeVisible();
  await expect(page.locator("[data-felt-markings=true]")).toBeVisible();
  await expect(page.locator("[data-felt-name=true]")).toBeVisible();
  await expect(page.locator("[data-phase-stack=true]")).toBeVisible();
  await expect(page.locator("[data-dealer-slot=true]")).toBeVisible();
  await expect(page.locator("[data-table-outer-rail=true]")).toHaveCount(1);
  await expect(page.locator(".tt-bj-markings")).toHaveCount(0);
  await expect(page.locator("[data-internal-oval]")).toHaveCount(0);

  const name = await page.locator("[data-table-name]").first().innerText();
  expect(name).not.toMatch(/\.\.\.|…/);

  const phase = await zoneBox(page, "phase");
  const dealer = await zoneBox(page, "dealer");
  const rules = await zoneBox(page, "rules");
  const identity = await zoneBox(page, "identity");
  const boxes = await zoneBox(page, "boxes");

  expect(intersects(phase, rules)).toBe(false);
  expect(intersects(dealer, rules)).toBe(false);
  expect(intersects(identity, boxes)).toBe(false);

  const payoutBar = page.locator(".tt-bj-overlay-row, [data-payout-rail=row]").first();
  if (await payoutBar.count()) {
    const bar = await payoutBar.boundingBox();
    expect(bar).toBeTruthy();
    expect(intersects(identity, bar!)).toBe(false);
    expect(bar!.y).toBeGreaterThanOrEqual(identity.y + identity.height);
  }
}

test("Blackjack physical table composition across phases", async ({ page, context, browser }) => {
  test.setTimeout(300_000);
  await mkdir(shots, { recursive: true });

  await openAs(context, page, uniqueEmail("comp-own"), "Dee");
  await createBlackjackTable(page, "XKLONDON'S TABLE", { starting: "100" });

  await assertCleanGeometry(page);
  await expect(page.locator("[data-blackjack-box-row]")).toHaveCount(0);
  await expect(page.getByText("Invite a Player to begin.")).toBeVisible();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeDisabled();
  await expect(page.locator("[data-table-name]").first()).toHaveText("XKLONDON'S TABLE");
  await shot(page, "01-setup-empty");

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
  await expect(casey.page.getByText(/Waiting for the (Dealer|table) to open betting/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-status="PLAYER_JOINED"]')).toHaveCount(1);
  await expect(page.getByText("PLAYER JOINED")).toBeVisible();
  await expect(page.getByText("READY", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-field="available"]')).toContainText("100");
  await expect(page.locator('[data-field="main-bet"]')).toHaveCount(0);
  await expect(page.getByText("Ready to open betting.")).toBeVisible();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled();
  await assertCleanGeometry(page);
  await shot(page, "02-setup-player-joined");

  await page.getByRole("button", { name: "START BETTING" }).click();
  await casey.page.reload();
  await expect(casey.page.getByText("YOUR JETONS")).toBeVisible();
  await expect(page.locator("[data-box-stage=true]")).toBeVisible();
  await expect(page.locator(".tt-bj-overlay-row")).toHaveCount(0);
  await casey.page.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.available.label).toBe("75");
  await assertCleanGeometry(page);
  await assertCleanGeometry(casey.page);
  await shot(page, "03-dealer-betting");
  await shot(casey.page, "04-player-betting");

  const yBet = await page.locator("[data-table-zone=boxes]").boundingBox();
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await expect(page.getByText("Play the hands.")).toBeVisible();
  const yPlay = await page.locator("[data-table-zone=boxes]").boundingBox();
  expect(yBet && yPlay).toBeTruthy();
  expect(Math.abs(yBet!.y - yPlay!.y)).toBeLessThanOrEqual(8);
  await assertCleanGeometry(page);
  await shot(page, "05-dealer-playing");
  await shot(casey.page, "06-player-playing");

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await expect(page.locator("[data-box-stage=true]")).toBeVisible();
  await assertCleanGeometry(page);
  await shot(page, "07-dealer-insurance");
  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.locator("[data-bj-layout=payout]")).toBeVisible();
  await expect(page.locator("[data-box-stage=true]")).toHaveCount(0);
  await expect(page.locator(".tt-bj-overlay-row").first()).toBeVisible();
  const rail = page.locator("[data-payout-rail=row]").first();
  await expect(rail).toBeVisible();
  const y0 = (await rail.locator("[data-payout-action=true]").nth(0).boundingBox())!.y;
  for (let i = 1; i < 4; i += 1) {
    expect(Math.abs((await rail.locator("[data-payout-action=true]").nth(i).boundingBox())!.y - y0)).toBeLessThan(8);
  }

  for (const [w, h] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expectNoDocumentScroll(page);
    await assertCleanGeometry(page);
    await shot(page, "08-dealer-payout-unresolved", { width: w, height: h });
  }
  await page.setViewportSize({ width: 390, height: 844 });

  while (await page.locator("[data-payout-action=true]").count()) {
    await page.locator("[data-payout-action=true]").filter({ hasText: /^LOST$/ }).first().click();
  }
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 15_000 });
  await assertCleanGeometry(page);
  await shot(page, "09-dealer-payout-resolved");
  await shot(casey.page, "10-player-payout");

  await casey.ctx.close();
});
