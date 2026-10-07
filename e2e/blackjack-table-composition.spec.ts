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

async function snapshot(page: Page): Promise<Snap> {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((r) => r.json());
}

async function shot(page: Page, name: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(shots, `${name}-390x844.png`), fullPage: false });
}

async function assertSharedSurface(page: Page) {
  await expect(page.locator("[data-blackjack-table-surface=true]")).toBeVisible();
  await expect(page.locator("[data-felt-markings=true]")).toBeVisible();
  await expect(page.locator("[data-felt-name=true]")).toBeVisible();
  await expect(page.locator("[data-phase-stack=true]")).toBeVisible();
  await expect(page.locator("[data-dealer-slot=true]")).toBeVisible();
  const name = await page.locator("[data-table-name]").first().innerText();
  expect(name).not.toMatch(/\.\.\.|…/);
}

test("Blackjack physical table composition across phases", async ({ page, context, browser }) => {
  test.setTimeout(300_000);
  await mkdir(shots, { recursive: true });

  await openAs(context, page, uniqueEmail("comp-own"), "Dee");
  await createBlackjackTable(page, "Composition Salon", { starting: "100" });

  await assertSharedSurface(page);
  await expect(page.locator("[data-blackjack-box-row]")).toHaveCount(0);
  await expect(page.getByText("Invite a Player to begin.")).toBeVisible();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeDisabled();
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
  await assertSharedSurface(page);
  await shot(page, "02-setup-player-joined");

  const riley = await joinGuest("Riley");
  await expect(riley.page.getByText(/Waiting for the (Dealer|table) to open betting/i)).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "START BETTING" }).click();
  await casey.page.reload();
  await expect(casey.page.getByText("YOUR JETONS")).toBeVisible();
  await expect(page.locator("[data-box-stage=true]")).toBeVisible();
  await expect(page.locator(".tt-bj-overlay-row")).toHaveCount(0);
  await shot(page, "03-dealer-betting-one-box");

  await casey.page.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.available.label).toBe("75");
  await shot(casey.page, "05-player-betting-one-box");
  await casey.page.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.boxes.length).toBe(2);
  const caseyBoxes = (await snapshot(casey.page)).player!.boxes;
  const caseyBox2 = caseyBoxes.find((b) => b.boxNumber === 2)!;
  await casey.page.locator(`[data-box-id="${caseyBox2.id}"]`).click();
  await casey.page.getByRole("button", { name: "Add 10 jetons" }).click();
  await shot(casey.page, "06-player-betting-two-boxes");
  await riley.page.reload();
  await expect(riley.page.getByText("YOUR JETONS")).toBeVisible();
  await riley.page.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(page)).bank?.boxes.length ?? 0).toBeGreaterThanOrEqual(3);
  const order = await page.locator("[data-box-stage=true] [data-box-slot]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-box-slot")),
  );
  expect(order[0]).not.toBe("1");
  expect(order.at(-1)).toBe("1");
  await shot(page, "04-dealer-betting-multiple-boxes");

  const yBet = await page.locator("[data-box-stage=true]").boundingBox();
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await expect(page.getByText("Play the hands.")).toBeVisible();
  const yPlay = await page.locator("[data-box-stage=true]").boundingBox();
  expect(yBet && yPlay).toBeTruthy();
  expect(Math.abs(yBet!.y - yPlay!.y)).toBeLessThanOrEqual(8);
  await shot(page, "08-dealer-playing");
  await shot(casey.page, "07-player-playing");

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await expect(page.locator("[data-box-stage=true]")).toBeVisible();
  await shot(page, "10-dealer-insurance");
  await shot(casey.page, "09-player-insurance");
  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.locator("[data-box-stage=true]")).toHaveCount(0);
  await expect(page.locator(".tt-bj-overlay-row").first()).toBeVisible();
  const rail = page.locator("[data-payout-rail=row]").first();
  await expect(rail).toBeVisible();
  const y0 = (await rail.locator("[data-payout-action=true]").nth(0).boundingBox())!.y;
  for (let i = 1; i < 4; i += 1) {
    expect(Math.abs((await rail.locator("[data-payout-action=true]").nth(i).boundingBox())!.y - y0)).toBeLessThan(8);
  }
  await shot(page, "11-dealer-payout-unresolved");

  while (await page.locator("[data-payout-action=true]").count()) {
    await page.locator("[data-payout-action=true]").filter({ hasText: /^LOST$/ }).first().click();
  }
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 15_000 });
  await shot(page, "12-dealer-payout-resolved");
  await shot(casey.page, "13-player-payout");

  for (const [w, h] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expectNoDocumentScroll(page);
  }

  await casey.ctx.close();
  await riley.ctx.close();
});
