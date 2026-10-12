import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, openAs, uniqueEmail } from "./helpers";

const shots = join(process.cwd(), "test-results", "premium-live-acceptance");

type Snap = {
  tableId: string;
  phase?: string;
  setup?: { joinUrl?: string | null; guestJoinUrl?: string | null; verifiedJoinUrl?: string | null };
  bank?: {
    phase: string;
    actions?: { switchGame?: boolean };
    canSwitchGame?: boolean;
    switchBlockedReason?: string | null;
    boxes: { id: string; boxNumber: number; outcome?: string | null; isDoubled?: boolean; isSplit?: boolean; bet: { label: string } }[];
  };
  player?: {
    phase: string;
    available: { label: string };
    actions?: { double?: boolean; split?: boolean };
    boxes: {
      id: string;
      boxNumber: number;
      bet: { label: string };
      isDoubled?: boolean;
      isSplit?: boolean;
      outcome?: string | null;
    }[];
  };
};

async function snapshot(page: Page): Promise<Snap> {
  const url = page.url();
  const tableId = url.split("/tables/")[1]?.split("?")[0];
  expect(tableId).toBeTruthy();
  const response = await page.request.get(`/api/tables/${tableId}/snapshot`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<Snap>;
}

async function command(page: Page, tableId: string, commandName: string, extra: Record<string, string> = {}) {
  const response = await page.request.post(`/api/tables/${tableId}/commands`, {
    data: { command: commandName, idempotencyKey: crypto.randomUUID(), ...extra },
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok(), status: response.status(), body };
}

test("Premium live: Double/Split API, Change Game, payout rail", async ({ page, context, browser }) => {
  test.setTimeout(240_000);
  await mkdir(shots, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });

  const ownerEmail = uniqueEmail("pm-owner");
  const playerEmail = uniqueEmail("pm-player");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Premium Live", { starting: "200" });
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;

  await expect(page.locator("[data-change-game=true]")).toBeVisible();
  await expect(page.getByRole("button", { name: "OWNER" })).toBeVisible();
  await expect(page.getByRole("button", { name: "DEALER" })).toBeVisible();
  await expect(page.locator("[data-change-game-badge=true]")).toBeVisible();

  const setupSnap = await snapshot(page);
  const joinUrl = setupSnap.setup?.verifiedJoinUrl || setupSnap.setup?.joinUrl || setupSnap.setup?.guestJoinUrl;
  expect(joinUrl).toBeTruthy();

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(new URL(joinUrl!).pathname);
  await expect(playerPage).toHaveURL(/\/tables\//, { timeout: 20_000 });

  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-change-game=true]")).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD PLAYER", exact: true })).toBeVisible();

  // Owner chrome → existing switchGame sheet (blinds / seat order)
  await page.locator("[data-change-game=true]").click();
  await expect(page.locator("[data-change-game-sheet=true]")).toBeVisible();
  await expect(page.getByRole("button", { name: /Texas Hold/i })).toBeVisible();
  await page.getByRole("button", { name: /Texas Hold/i }).click();
  await expect(page.getByLabel("Small blind")).toBeVisible();
  await expect(page.getByLabel("Big blind")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("[data-change-game-sheet=true]")).toHaveCount(0);

  await page.getByRole("button", { name: "OWNER" }).click();
  await expect(page.getByRole("button", { name: "Change Game", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Change Game", exact: true }).click();
  await expect(page.locator("[data-change-game-sheet=true]")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await playerPage.reload();
  await expect(playerPage.getByRole("button", { name: "Add 25 jetons" })).toBeVisible({ timeout: 15_000 });
  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("175");
  await playerPage.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.length).toBe(2);
  const boxes = (await snapshot(playerPage)).player!.boxes;
  const box1 = boxes.find((box) => box.boxNumber === 1)!;
  const box2 = boxes.find((box) => box.boxNumber === 2)!;
  await playerPage.locator(`[data-box-id="${box2.id}"]`).click();
  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("150");

  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect.poll(async () => (await snapshot(page)).bank?.phase ?? (await snapshot(page)).phase).toBe("PLAYING");

  // Reproduce Double / Split via real POST commands (no UNKNOWN_COMMAND)
  const before = await snapshot(playerPage);
  const target = before.player!.boxes.find((box) => box.boxNumber === 1)!;
  const doubleRes = await command(playerPage, tableId, "doubleBox", { boxId: target.id });
  expect(doubleRes.ok, `doubleBox failed: ${JSON.stringify(doubleRes.body)}`).toBe(true);
  expect(doubleRes.body).not.toMatchObject({ code: "UNKNOWN_COMMAND" });
  await expect.poll(async () => {
    const snap = await snapshot(playerPage);
    return snap.player?.boxes.find((box) => box.id === target.id)?.isDoubled;
  }).toBe(true);

  const afterDouble = await snapshot(playerPage);
  const splitTarget = afterDouble.player!.boxes.find((box) => box.boxNumber === 2 && !box.isDoubled) ?? afterDouble.player!.boxes.find((box) => box.id === box2.id)!;
  const splitRes = await command(playerPage, tableId, "splitBox", { boxId: splitTarget.id });
  expect(splitRes.ok, `splitBox failed: ${JSON.stringify(splitRes.body)}`).toBe(true);
  expect(splitRes.body).not.toMatchObject({ code: "UNKNOWN_COMMAND" });
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.length ?? 0).toBeGreaterThanOrEqual(3);

  // Wrong legacy names must still fail (no aliases)
  const legacy = await command(playerPage, tableId, "double", { boxId: target.id });
  expect(legacy.ok).toBe(false);
  expect(String((legacy.body as { code?: string }).code || "")).toMatch(/UNKNOWN_COMMAND|UNKNOWN/i);

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect.poll(async () => (await snapshot(page)).bank?.phase ?? (await snapshot(page)).phase).toBe("PAYOUT");

  await expect(page.getByRole("button", { name: "ADD PLAYER", exact: true })).toBeVisible();
  await expect(page.locator("[data-change-game=true]")).toBeVisible();
  await expect(page.locator("[data-change-game=true]")).toBeDisabled();
  await expect(page.locator("[data-change-game-blocked=true]")).toBeVisible();
  await expect(page.locator("[data-payout-resolved=false]")).toBeAttached();

  const rail = page.locator("[data-payout-rail=row]").first().locator("[data-payout-action=true]");
  await expect(rail).toHaveCount(4);
  await expect(rail.nth(0)).toHaveAttribute("data-outcome", "WON");
  await expect(rail.nth(1)).toHaveAttribute("data-outcome", "LOST");
  await expect(rail.nth(2)).toHaveAttribute("data-outcome", "BLACKJACK");
  await expect(rail.nth(3)).toHaveAttribute("data-outcome", "PUSH");
  await expect(rail.nth(0)).toContainText("WIN");
  await expect(rail.nth(1)).toContainText("LOST");
  await expect(rail.nth(2)).toContainText("BLACKJACK");
  await expect(rail.nth(3)).toContainText("DRAW");

  const railBox = await rail.first().boundingBox();
  expect(railBox).toBeTruthy();
  expect(railBox!.height).toBeGreaterThanOrEqual(60);
  const rowBox = await page.locator("[data-payout-rail=row]").first().boundingBox();
  expect(rowBox).toBeTruthy();
  // Four actions stay on one horizontal row at 390px (no wrap).
  const last = await rail.nth(3).boundingBox();
  expect(last).toBeTruthy();
  expect(Math.abs(railBox!.y - last!.y)).toBeLessThan(8);

  await page.screenshot({ path: join(shots, "payout-unresolved-390x844.png") });

  const outcomes = page.locator("[data-payout-rail=row]");
  const count = await outcomes.count();
  expect(count).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < count; i += 1) {
    const row = outcomes.nth(i);
    if ((await row.getAttribute("data-payout-state")) === "pending") {
      await row.locator('[data-outcome="WON"]').click();
    }
  }

  await expect.poll(async () => {
    const snap = await snapshot(page);
    return snap.bank?.boxes.every((box) => Boolean(box.outcome));
  }).toBe(true);

  await expect(page.locator("[data-payout-resolved=true]")).toBeAttached();
  await expect(page.locator("[data-change-game=true]")).toBeEnabled({ timeout: 10_000 });
  await page.locator("[data-change-game=true]").click();
  await expect(page.locator("[data-change-game-sheet=true]")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.screenshot({ path: join(shots, "payout-390x844.png") });
  await playerPage.screenshot({ path: join(shots, "player-after-split-390x844.png") });

  await playerContext.close();
});
