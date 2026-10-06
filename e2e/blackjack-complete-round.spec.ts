import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, expectNoDocumentScroll, expectPlayerPayoutIdle, openAs, uniqueEmail } from "./helpers";

const shots = join(process.cwd(), "test-results", "prompt2");

async function snapshot(page: import("@playwright/test").Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<{
    player?: { available: { label: string }; boxes: { id: string; boxNumber: number; bet: { label: string }; outcome?: string | null; insurance?: { label: string } | null }[] };
    bank?: { boxes: { id: string; boxNumber: number; playerName: string; bet: { label: string } }[]; phase: string };
    setup?: { joinUrl: string | null };
    phase?: string;
  }>;
}

test("complete Blackjack round through the real UI", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await mkdir(shots, { recursive: true });
  const ownerEmail = uniqueEmail("round-owner");
  const playerEmail = uniqueEmail("round-player");

  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Round table", { starting: "100" });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD PLAYER" })).toBeVisible();
  await expect(page.locator("[data-table-name]")).toHaveCount(1);
  await expect(page.locator("[data-phase-action]")).toBeVisible();
  await expect(page.locator(".cloth-name-rule")).toHaveCount(0);
  await expect(page.locator(".phase-zero-meta")).toHaveCount(0);
  const startBox = await page.getByRole("button", { name: "START BETTING" }).boundingBox();
  const addBox = await page.getByRole("button", { name: "ADD PLAYER" }).boundingBox();
  expect(startBox).toBeTruthy();
  expect(addBox).toBeTruthy();
  expect(Math.abs(startBox!.y - addBox!.y)).toBeLessThan(4);
  expect(startBox!.height).toBeGreaterThanOrEqual(48);
  expect(Math.abs(startBox!.height - addBox!.height)).toBeLessThan(2);
  expect(startBox!.y + startBox!.height).toBeLessThan(844);
  await expectNoDocumentScroll(page);
  await page.screenshot({ path: join(shots, "setup-owner-390x844.png") });

  const setup = await snapshot(page);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(joinPath);
  await expect(playerPage.getByText(/Waiting for the table to open betting|Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();
  await expect(playerPage.getByText("100").first()).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "Invite Player" })).toHaveCount(0);
  await playerPage.screenshot({ path: join(shots, "setup-player-390x844.png") });

  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD PLAYER" })).toBeVisible();

  await playerPage.reload();
  await expect(playerPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(playerPage.locator("[data-player-wallet]")).toBeVisible();
  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("75");
  await playerPage.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.length).toBe(2);
  const boxes = (await snapshot(playerPage)).player!.boxes;
  const box1 = boxes.find((box) => box.boxNumber === 1)!;
  const box2 = boxes.find((box) => box.boxNumber === 2)!;
  await playerPage.locator(`[data-box-id="${box2.id}"]`).click();
  await playerPage.getByRole("button", { name: "Add 10 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("65");
  await playerPage.getByRole("button", { name: /^RETRACT$/i }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("75");
  await playerPage.getByRole("button", { name: "Add 10 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("65");
  const box1Bet = playerPage.locator(`[data-box-id="${box1.id}"]`);
  const box1AtBet = await box1Bet.boundingBox();
  expect(box1AtBet).toBeTruthy();
  await expectNoDocumentScroll(playerPage);
  await playerPage.screenshot({ path: join(shots, "betting-player-390x844.png") });

  await expect(page.locator(`[data-box-id="${box1.id}"]`)).toBeVisible();
  await expect(page.locator(`[data-box-id="${box2.id}"]`)).toBeVisible();
  await page.screenshot({ path: join(shots, "betting-dealer-390x844.png") });
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await page.screenshot({ path: join(shots, "playing-dealer-390x844.png") });

  await playerPage.reload();
  await expect(playerPage.getByRole("button", { name: "2×" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "SPLIT" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "INSURANCE", exact: true })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "INSURANCE", exact: true })).toBeDisabled();
  await expect(playerPage.getByRole("button", { name: "ADD BOX" })).toHaveCount(0);
  await expect(playerPage.locator("[data-player-wallet]")).toBeVisible();
  await playerPage.locator(`[data-box-id="${box1.id}"]`).click();
  await playerPage.getByRole("button", { name: "2×" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("40");
  const box1AtPlay = await playerPage.locator(`[data-box-id="${box1.id}"]`).boundingBox();
  expect(box1AtPlay).toBeTruthy();
  // Box identity stays stable; Tabletop may reflow Y between Betting and Playing chrome.
  expect(Math.abs((box1AtPlay!.x) - box1AtBet!.x)).toBeLessThan(48);
  await playerPage.screenshot({ path: join(shots, "playing-player-390x844.png") });

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await expect(page.getByRole("button", { name: "CLOSE INSURANCE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN INSURANCE" })).toHaveCount(0);
  await page.screenshot({ path: join(shots, "insurance-dealer-390x844.png") });
  await playerPage.reload();
  await expect(playerPage.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await expect(playerPage.getByRole("button", { name: "INSURANCE", exact: true })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "ADD BOX" })).toHaveCount(0);
  const box1AtIns = await playerPage.locator(`[data-box-id="${box1.id}"]`).boundingBox();
  expect(Math.abs((box1AtIns!.x) - box1AtBet!.x)).toBeLessThan(48);
  await playerPage.locator(`[data-box-id="${box1.id}"]`).click();
  await playerPage.getByRole("button", { name: "INSURANCE", exact: true }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.find((box) => box.id === box1.id)?.insurance?.label ?? "").not.toBe("");
  await playerPage.screenshot({ path: join(shots, "insurance-player-390x844.png") });
  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expectNoDocumentScroll(page);
  await page.screenshot({ path: join(shots, "payout-unresolved-dealer-390x844.png") });

  await page.locator(`[data-box-id="${box1.id}"] [data-payout-action="true"]`).filter({ hasText: /^WON$/ }).click();
  await page.locator(`[data-box-id="${box2.id}"] [data-payout-action="true"]`).filter({ hasText: /^LOST$/ }).click();
  await page.locator(`[data-box-id="${box1.id}"] [data-insurance-action="lost"]`).click();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 10_000 });
  await expectNoDocumentScroll(page);
  await page.screenshot({ path: join(shots, "payout-dealer-390x844.png") });

  await playerPage.reload();
  await expect.poll(async () => Number((await snapshot(playerPage)).player?.available.label ?? "0")).toBeGreaterThan(100);
  await expect(playerPage.locator("[data-player-wallet]")).toBeVisible();
  await expect(playerPage.locator("[data-payout-main=true]").first()).toBeVisible();
  await expect(playerPage.locator(`[data-box-id="${box1.id}"] [data-payout-insurance=true]`)).toBeVisible();
  await expect(playerPage.locator(`[data-box-id="${box2.id}"] [data-payout-insurance]`)).toHaveCount(0);
  await expectPlayerPayoutIdle(playerPage);
  const box1AtPay = await playerPage.locator(`[data-box-id="${box1.id}"]`).boundingBox();
  expect(box1AtPay).toBeTruthy();
  expect(Math.abs((box1AtPay!.x) - box1AtBet!.x)).toBeLessThan(48);
  await expectNoDocumentScroll(playerPage);
  await playerPage.screenshot({ path: join(shots, "payout-player-390x844.png") });

  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await page.reload();
  await playerPage.reload();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await expect(playerPage.locator("[data-phase-heading]")).toHaveText("BETTING");
  const ownerAfter = await snapshot(page);
  const playerAfter = await snapshot(playerPage);
  expect(ownerAfter.phase).toBe("BETTING");
  expect(playerAfter.phase).toBe("BETTING");
  expect(Number(playerAfter.player?.available.label ?? "0")).toBeGreaterThan(100);
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "FOLD" })).toHaveCount(0);

  await playerContext.close();
});
