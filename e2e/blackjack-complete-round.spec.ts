import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, openAs, uniqueEmail } from "./helpers";

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
  await expect(page.getByRole("button", { name: "START BLACKJACK" })).toBeVisible();
  await expect(page.locator("[data-table-name]")).toHaveCount(1);
  await expect(page.locator("[data-phase-action]")).toBeVisible();
  const startBox = await page.getByRole("button", { name: "START BLACKJACK" }).boundingBox();
  expect(startBox).toBeTruthy();
  expect(startBox!.y).toBeGreaterThan(0);
  expect(startBox!.y + startBox!.height).toBeLessThan(844);
  await page.screenshot({ path: join(shots, "setup-owner-390x844.png") });

  const setup = await snapshot(page);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(joinPath);
  await expect(playerPage.getByText(/Waiting for the Bank/i)).toBeVisible();
  await expect(playerPage.getByText("100").first()).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "START BLACKJACK" })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "ADD PLAYER" })).toHaveCount(0);
  await playerPage.screenshot({ path: join(shots, "setup-player-390x844.png") });

  await expect(page.getByRole("button", { name: "START BLACKJACK" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BLACKJACK" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await expect(page.getByRole("button", { name: "DEAL CARDS", exact: true })).toHaveCount(0);

  await playerPage.reload();
  await expect(playerPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(playerPage.locator("[data-player-wallet]")).toBeVisible();
  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("75");
  await playerPage.getByRole("button", { name: "START ADDITIONAL BOX" }).click();
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
  await playerPage.screenshot({ path: join(shots, "betting-player-390x844.png") });

  await expect(page.locator(`[data-box-id="${box1.id}"]`)).toBeVisible();
  await expect(page.locator(`[data-box-id="${box2.id}"]`)).toBeVisible();
  await page.screenshot({ path: join(shots, "betting-dealer-390x844.png") });
  await expect(page.getByRole("button", { name: "CLOSE BETTING" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await page.screenshot({ path: join(shots, "playing-dealer-390x844.png") });

  await playerPage.reload();
  await expect(playerPage.getByRole("button", { name: "DOUBLE" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "SPLIT" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "INSURANCE" })).toBeVisible();
  await expect(playerPage.locator("[data-player-wallet]")).toBeVisible();
  await playerPage.locator(`[data-box-id="${box1.id}"]`).click();
  await playerPage.getByRole("button", { name: "DOUBLE" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("40");
  const box1AtPlay = await playerPage.locator(`[data-box-id="${box1.id}"]`).boundingBox();
  expect(box1AtPlay).toBeTruthy();
  expect(Math.abs((box1AtPlay!.x) - box1AtBet!.x)).toBeLessThan(8);
  expect(Math.abs((box1AtPlay!.y) - box1AtBet!.y)).toBeLessThan(8);
  await playerPage.screenshot({ path: join(shots, "playing-player-390x844.png") });

  await page.getByRole("button", { name: "Open Insurance" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await page.screenshot({ path: join(shots, "insurance-dealer-390x844.png") });
  await playerPage.reload();
  await expect(playerPage.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await expect(playerPage.getByText("Up to half the box stake")).toBeVisible();
  const box1AtIns = await playerPage.locator(`[data-box-id="${box1.id}"]`).boundingBox();
  expect(Math.abs((box1AtIns!.x) - box1AtBet!.x)).toBeLessThan(8);
  expect(Math.abs((box1AtIns!.y) - box1AtBet!.y)).toBeLessThan(8);
  await playerPage.locator(`[data-box-id="${box1.id}"]`).click();
  await playerPage.getByLabel("Insurance amount").fill("5");
  await playerPage.getByRole("button", { name: "PLACE INSURANCE" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("35");
  await playerPage.screenshot({ path: join(shots, "insurance-player-390x844.png") });
  await page.getByRole("button", { name: "Close Insurance" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");

  await page.locator(`[data-box-id="${box1.id}"]`).getByRole("button", { name: "WON" }).click();
  await page.locator(`[data-box-id="${box2.id}"]`).getByRole("button", { name: "LOST" }).click();
  await page.getByRole("button", { name: "INS LOST" }).click();
  await expect(page.getByRole("button", { name: "START NEXT ROUND" })).toBeEnabled({ timeout: 10_000 });
  await page.screenshot({ path: join(shots, "payout-dealer-390x844.png") });

  await playerPage.reload();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("135");
  await expect(playerPage.locator("[data-player-wallet]")).toBeVisible();
  const box1AtPay = await playerPage.locator(`[data-box-id="${box1.id}"]`).boundingBox();
  expect(Math.abs((box1AtPay!.x) - box1AtBet!.x)).toBeLessThan(8);
  expect(Math.abs((box1AtPay!.y) - box1AtBet!.y)).toBeLessThan(8);
  await playerPage.screenshot({ path: join(shots, "payout-player-390x844.png") });

  await page.getByRole("button", { name: "START NEXT ROUND" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await page.reload();
  await playerPage.reload();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await expect(playerPage.locator("[data-phase-heading]")).toHaveText("BETTING");
  const ownerAfter = await snapshot(page);
  const playerAfter = await snapshot(playerPage);
  expect(ownerAfter.phase).toBe("BETTING");
  expect(playerAfter.phase).toBe("BETTING");
  expect(playerAfter.player?.available.label).toBe("135");
  await expect(page.getByRole("button", { name: "DEAL CARDS", exact: true })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "FOLD" })).toHaveCount(0);

  await playerContext.close();
});
