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

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "dealer-rows-wipe");
const ADMIN = process.env.JETONBRO_ADMIN_EMAIL || "p6-admin-wipe@jetonbro.test";

type Snap = {
  player?: {
    available: { label: string };
    boxes: { id: string; boxNumber: number; bet: { label: string } }[];
  };
  bank?: { boxes: { id: string }[] };
};

async function snapshot(page: Page): Promise<Snap> {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((r) => r.json());
}

async function shot(page: Page, name: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(shots, `${name}-390x844.png`), fullPage: false });
}

test("Dealer box rows + admin WIPE ALL TABLES screenshots", async ({ page, context, browser }) => {
  test.setTimeout(240_000);
  await mkdir(shots, { recursive: true });

  const ordinary = await browser.newContext();
  const ordinaryPage = await ordinary.newPage();
  await openAs(ordinary, ordinaryPage, uniqueEmail("ordinary"), "Drew");
  await ordinaryPage.goto("/");
  await expect(ordinaryPage.getByRole("button", { name: "WIPE ALL TABLES" })).toHaveCount(0);
  await expect(ordinaryPage.getByRole("button", { name: "DELETE ALL MY TABLES" })).toHaveCount(0);
  await shot(ordinaryPage, "10-home-ordinary-no-bulk-delete");
  await ordinary.close();

  await openAs(context, page, ADMIN, "Admin");
  await createBlackjackTable(page, "Row Salon", { starting: "100" });
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
  const riley = await joinGuest("Riley");
  await expect(riley.page.getByText(/Waiting for the table to open betting/i)).toBeVisible({ timeout: 20_000 });

  await expect(page.locator("[data-blackjack-box-row]")).toHaveCount(2);
  await expect(page.locator(".tt-pbox")).toHaveCount(0);
  await shot(page, "01-dealer-setup-joined");

  await page.getByRole("button", { name: "START BETTING" }).click();
  await casey.page.reload();
  await expect(casey.page.getByText("YOUR JETONS")).toBeVisible();
  await casey.page.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.available.label).toBe("75");
  // Two players seated → two box rows; one has a wager.
  await expect(page.locator("[data-blackjack-box-row]")).toHaveCount(2);
  await expect(page.getByText("Wagered").first()).toBeVisible();
  await shot(page, "02-dealer-betting-one-box");

  await casey.page.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.boxes.length).toBe(2);
  const caseyBoxes = (await snapshot(casey.page)).player!.boxes;
  const caseyBox2 = caseyBoxes.find((b) => b.boxNumber === 2)!;
  await casey.page.locator(`[data-box-id="${caseyBox2.id}"]`).click();
  await casey.page.getByRole("button", { name: "Add 10 jetons" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.available.label).toBe("65");

  await riley.page.reload();
  await expect(riley.page.getByText("YOUR JETONS")).toBeVisible();
  await riley.page.getByRole("button", { name: "Add 25 jetons" }).click();
  await riley.page.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(riley.page)).player?.boxes.length).toBe(2);
  const rileyBoxes = (await snapshot(riley.page)).player!.boxes;
  const rileyBox2 = rileyBoxes.find((b) => b.boxNumber === 2)!;
  await riley.page.locator(`[data-box-id="${rileyBox2.id}"]`).click();
  await riley.page.getByRole("button", { name: "Add 5 jetons" }).click();
  await expect.poll(async () => (await snapshot(page)).bank?.boxes.length ?? 0).toBe(4);
  await expect.poll(async () => page.locator("[data-blackjack-box-row]").count()).toBe(4);
  await shot(page, "03-dealer-betting-four-boxes");

  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await page.getByRole("button", { name: "+ CARD" }).first().click();
  await page.getByRole("button", { name: "10", exact: true }).click();
  await shot(page, "04-dealer-playing-cards");
  await casey.page.reload();
  await casey.page.getByRole("button", { name: "2×" }).click();
  await expect(page.locator("[data-doubled=true]")).toBeVisible();
  await shot(page, "05-dealer-playing-doubled");

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await casey.page.reload();
  await casey.page.getByRole("button", { name: "INSURANCE", exact: true }).click();
  await shot(page, "06-dealer-insurance");

  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.getByRole("button", { name: /Set Box .* result: Stand-off/ }).first()).toBeVisible();
  await expect(page.locator("[data-payout-action=true]").filter({ hasText: /^TIE$/ }).first()).toBeVisible();
  await shot(page, "07-dealer-payout-unresolved");

  await page.locator("[data-payout-action=true]").filter({ hasText: /^LOST$/ }).first().click();
  await shot(page, "08-dealer-payout-partial");
  for (let i = 0; i < 8; i += 1) {
    const lost = page.locator("[data-payout-action=true]").filter({ hasText: /^LOST$/ }).first();
    if (!(await lost.count())) break;
    await lost.click();
  }
  const insLost = page.locator("[data-insurance-action=lost]").first();
  if (await insLost.count()) {
    await insLost.click();
  }
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 15_000 });
  await shot(page, "09-dealer-payout-resolved");

  for (const [w, h] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expectNoDocumentScroll(page);
  }

  await page.goto("/");
  await expect(page.getByRole("button", { name: "WIPE ALL TABLES" })).toBeVisible();
  await expect(page.getByRole("button", { name: "DELETE ALL MY TABLES" })).toHaveCount(0);
  await shot(page, "11-home-admin-wipe-only");
  await page.getByRole("button", { name: "WIPE ALL TABLES" }).click();
  await expect(page.getByRole("heading", { name: "WIPE ALL TABLES" })).toBeVisible();
  await shot(page, "12-admin-wipe-confirmation");
  await page.getByLabel("Type WIPE ALL TABLES").fill("WIPE ALL TABLES");
  await page.getByRole("button", { name: "Confirm wipe" }).click();
  await expect(page.getByText("All tables wiped")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-table-id]")).toHaveCount(0);
  await shot(page, "13-home-empty-after-wipe");

  await casey.ctx.close();
  await riley.ctx.close();
});
