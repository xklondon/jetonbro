import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  createPokerTable,
  expectNoDocumentScroll,
  expectPlayerPayoutIdle,
  expectPokerPhase,
  openAs,
  setupJoinUrl,
  uniqueEmail,
} from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "classic-screenpack");

async function snapshot(page: Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<{
    phase?: string;
    player?: {
      available: { label: string };
      boxes: { id: string; boxNumber: number; bet: { label: string }; insurance?: { label: string } | null }[];
    };
    bank?: { boxes: { id: string; playerName: string }[]; phase: string; players?: { name: string }[] };
    setup?: { joinUrl: string | null; guestJoinUrl?: string | null };
    members?: { name: string; isBankDealer?: boolean }[];
  }>;
}

async function assertNoForbiddenCopy(page: Page) {
  await expect(page.getByText("BETTING PHASE")).toHaveCount(0);
  await expect(page.getByText("PLAYING PHASE")).toHaveCount(0);
  await expect(page.getByText("PAYOUT PHASE")).toHaveCount(0);
  await expect(page.getByText("CURRENT PHASE:")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CLOSE BETTING" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "START NEXT ROUND" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "START ADDITIONAL BOX" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toHaveCount(0);
}

async function overflowAt(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await expectNoDocumentScroll(page);
}

test("Classic Blackjack phase matrix, centred boxes, overflow, and Dealer Add Player during Betting", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(180_000);
  await mkdir(shots, { recursive: true });
  const ownerEmail = uniqueEmail("pack-owner");
  const playerEmail = uniqueEmail("pack-player");

  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Classic pack", { starting: "100" });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD PLAYER" })).toBeVisible();
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toHaveCount(0);
  await assertNoForbiddenCopy(page);
  await page.screenshot({ path: join(shots, "dealer-phase0-390x844.png") });

  const joinPath = new URL((await snapshot(page)).setup!.joinUrl!).pathname;
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(joinPath);
  await expect(playerPage.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "DEAL CARDS" })).toHaveCount(0);

  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD PLAYER" })).toBeVisible();
  await expect(page.locator("[data-player-wallet]")).toHaveCount(0);
  await assertNoForbiddenCopy(page);
  await page.screenshot({ path: join(shots, "dealer-betting-390x844.png") });

  await page.getByRole("button", { name: "ADD PLAYER" }).click();
  await expect(page.locator(".sheet.open .invite-mask")).toBeVisible();
  await expect(page.getByRole("tab", { name: /GUEST QR/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /VERIFIED QR/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /EMAIL/i })).toBeVisible();
  await page.screenshot({ path: join(shots, "dealer-add-player-mask-betting-390x844.png") });
  const guestUrl = await setupJoinUrl(page, "guest");
  await page.locator(".invite-mask").getByRole("button", { name: "Close" }).click();

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.setViewportSize({ width: 390, height: 844 });
  await guestPage.goto(new URL(guestUrl).pathname);
  await expect(guestPage.getByText("Join without email")).toBeVisible();
  await guestPage.getByLabel("Play name").fill("Casey");
  await guestPage.getByRole("button", { name: "Join table" }).click();
  await expect(guestPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await expect.poll(async () => (await snapshot(page)).members?.some((member) => member.name === "Casey")).toBe(true);
  await expect(page.getByText("Casey").first()).toBeVisible({ timeout: 20_000 });
  await guestPage.reload();
  await expect(guestPage.locator("[data-phase-heading]")).toHaveText("BETTING");
  await expect(guestPage.getByRole("button", { name: "PLACE BET" })).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "ADD BOX" })).toBeVisible();

  await playerPage.reload();
  await expect(playerPage.locator("[data-phase-heading]")).toHaveText("BETTING");
  await expect(playerPage.getByRole("button", { name: "PLACE BET" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "ADD BOX" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "2×" })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "SPLIT" })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "INSURANCE", exact: true })).toHaveCount(0);
  await expect(playerPage.locator("[data-box-count]")).toHaveAttribute("data-box-count", "1");
  const box1 = playerPage.locator("[data-box-stage] [data-box-id]").first();
  await expect(playerPage.locator('[data-empty-slot="1"]')).toBeAttached();
  await expect(playerPage.locator('[data-empty-slot="3"]')).toBeAttached();
  const oneBox = await box1.boundingBox();
  expect(oneBox).toBeTruthy();
  expect(oneBox!.x).toBeGreaterThan(90);
  expect(oneBox!.x + oneBox!.width).toBeLessThan(300);
  await playerPage.screenshot({ path: join(shots, "player-betting-one-box-390x844.png") });

  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("75");
  const box1Id = (await snapshot(playerPage)).player!.boxes.find((box) => box.boxNumber === 1)!.id;
  const beforeAdd = await playerPage.locator(`[data-box-id="${box1Id}"]`).boundingBox();
  await playerPage.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.length).toBe(2);
  const afterAdd = await playerPage.locator(`[data-box-id="${box1Id}"]`).boundingBox();
  expect(Math.abs((afterAdd!.x) - beforeAdd!.x)).toBeLessThan(8);
  const boxes = (await snapshot(playerPage)).player!.boxes;
  const box2 = boxes.find((box) => box.boxNumber === 2)!;
  const left = await playerPage.locator(`[data-box-id="${box2.id}"]`).boundingBox();
  expect(left!.x).toBeLessThan(afterAdd!.x);
  await playerPage.locator(`[data-box-id="${box2.id}"]`).click();
  await playerPage.getByRole("button", { name: "Add 10 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("65");
  await expect(playerPage.getByRole("button", { name: /^RETRACT$/i })).toBeVisible();
  await playerPage.screenshot({ path: join(shots, "player-betting-two-boxes-390x844.png") });

  await overflowAt(playerPage, 360, 800);
  await overflowAt(playerPage, 390, 844);
  await overflowAt(playerPage, 430, 932);
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await overflowAt(page, 360, 800);
  await overflowAt(page, 390, 844);
  await overflowAt(page, 430, 932);
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await expect(page.getByRole("button", { name: "ENTER PAYOUT" })).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN INSURANCE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CLOSE INSURANCE" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "ADD PLAYER" })).toHaveCount(0);
  await assertNoForbiddenCopy(page);
  await page.screenshot({ path: join(shots, "dealer-playing-open-insurance-390x844.png") });

  await playerPage.reload();
  await expect(playerPage.getByRole("button", { name: "2×" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "SPLIT" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "ADD BOX" })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "PLACE BET" })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "RETRACT" })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "INSURANCE", exact: true })).toHaveCount(0);
  await expect(playerPage.getByRole("button", { name: "Add 25 jetons" })).toBeDisabled();
  await playerPage.screenshot({ path: join(shots, "player-playing-390x844.png") });

  await guestPage.reload();
  await expect(guestPage.getByRole("button", { name: "PLACE BET" })).toHaveCount(0);
  await expect(guestPage.getByRole("button", { name: "ADD BOX" })).toHaveCount(0);

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await expect(page.getByRole("button", { name: "CLOSE INSURANCE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN INSURANCE" })).toHaveCount(0);
  await page.screenshot({ path: join(shots, "dealer-insurance-close-390x844.png") });

  await playerPage.reload();
  await expect(playerPage.locator("[data-phase-heading]")).toHaveText("INSURANCE OPEN");
  await playerPage.locator(`[data-box-id="${box1Id}"]`).click();
  await expect(playerPage.getByRole("button", { name: "INSURANCE", exact: true })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "ADD BOX" })).toHaveCount(0);
  await playerPage.screenshot({ path: join(shots, "player-insurance-390x844.png") });
  await playerPage.getByRole("button", { name: "INSURANCE", exact: true }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.find((box) => box.id === box1Id)?.insurance?.label ?? "").not.toBe("");

  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "WON" }).first()).toBeVisible();
  await page.screenshot({ path: join(shots, "dealer-payout-unresolved-390x844.png") });

  await page.locator(`[data-box-id="${box1Id}"]`).getByRole("button", { name: "WON" }).click();
  await page.locator(`[data-box-id="${box2.id}"]`).getByRole("button", { name: "LOST" }).click();
  await page.getByRole("button", { name: "INS LOST" }).click();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 10_000 });
  await assertNoForbiddenCopy(page);
  await page.screenshot({ path: join(shots, "dealer-payout-resolved-390x844.png") });

  await playerPage.reload();
  await expectPlayerPayoutIdle(playerPage);
  await playerPage.screenshot({ path: join(shots, "player-payout-390x844.png") });

  await playerContext.close();
  await guestContext.close();
});

test("Poker smoke: START HAND opens PRE-FLOP without Blackjack deal chrome", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  await openAs(context, page, uniqueEmail("pack-poker-owner"), "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await createPokerTable(page, "Pack poker", { starting: "100", smallBlind: "5", bigBlind: "10" });
  const joinPath = new URL((await snapshot(page)).setup!.joinUrl!).pathname;
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, uniqueEmail("pack-poker-sam"), "Sam");
  await playerPage.goto(joinPath);
  await expect(page.getByRole("button", { name: "START HAND", exact: true })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START HAND", exact: true }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "DEAL FLOP" })).toBeVisible();
  await playerContext.close();
});
