import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  doubleTapPayoutRow,
  dragPayoutRow,
  noHorizontalOverflow,
  openAs,
  releasePayoutDrag,
  swipePayoutRow,
  uniqueEmail,
} from "./helpers";

async function tableSnapshot(page: Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json());
}

async function addJetons(page: Page, amount: "5" | "10" | "25") {
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.getByRole("button", { name: `Add ${amount} jetons` }).click({ force: true });
}

test("payout rail order, per-box gestures, and player blackjack celebration", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("rail-bank");
  const samEmail = uniqueEmail("rail-sam");
  const joEmail = uniqueEmail("rail-jo");

  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Rail table", { starting: "100" });
  const setupSnap = (await tableSnapshot(page)) as { setup?: { joinUrl: string | null } };
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(joinPath);
  await expect(joPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "OPEN BETTING" }).click();

  await samPage.reload();
  await addJetons(samPage, "25");
  await samPage.getByRole("button", { name: "+ Box" }).click({ force: true });
  await samPage.getByRole("button", { name: /YOUR BOX 2/ }).click({ force: true });
  await addJetons(samPage, "10");
  await joPage.reload();
  await addJetons(joPage, "25");
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { name: string; boxes: unknown[] }[] } };
    return snap.bank?.players.find((player) => player.name === "Jo")?.boxes.length ?? 0;
  }).toBe(1);

  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await expect(page.locator(".phone")).toHaveCount(1);
  await expect(page.locator(".bj-rail")).toHaveCount(0);
  await expect(page.locator(".table-rail")).toHaveCount(0);
  await expect(page.locator("[data-dealer-box]")).toBeVisible();
  await expect(page.locator("[data-dealer-box]").getByText("DEALER", { exact: true })).toBeVisible();
  await expect(page.locator("[data-dealer-box]").getByRole("button", { name: "+ CARDS" })).toBeVisible();
  await mkdir(join(process.cwd(), "docs", "screenshots", "classic"), { recursive: true });
  await page.screenshot({ path: join(process.cwd(), "docs", "screenshots", "classic", "app-blackjack-dealer-playing-390x844.png") });
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  await expect(page.locator("[data-dealer-box]")).toBeVisible();
  await expect(page.getByRole("button", { name: "DEALER WON" })).toBeVisible();
  await page.screenshot({ path: join(process.cwd(), "docs", "screenshots", "classic", "app-blackjack-dealer-payout-390x844.png") });

  const payoutSnap = (await tableSnapshot(page)) as {
    bank?: { players: { name: string; boxes: { id: string }[] }[] };
  };
  const samBoxes = payoutSnap.bank?.players.find((player) => player.name === "Sam")?.boxes ?? [];
  const joBoxes = payoutSnap.bank?.players.find((player) => player.name === "Jo")?.boxes ?? [];
  expect(samBoxes.length).toBeGreaterThanOrEqual(2);
  expect(joBoxes.length).toBe(1);

  const rail = page.locator(`[data-box-id="${samBoxes[0]!.id}"] .payout-access .rail-title`);
  await expect(rail).toHaveText(["LOST", "STAND OFF", "BLACKJACK", "WON"]);
  await expect(page.locator(`[data-box-id="${samBoxes[0]!.id}"] .payout-access`)).toHaveCSS("flex-wrap", "nowrap");

  await page.setViewportSize({ width: 320, height: 700 });
  await expect(rail).toHaveText(["LOST", "STAND OFF", "BLACKJACK", "WON"]);
  await expect(page.locator(`[data-box-id="${samBoxes[0]!.id}"] .payout-access`)).toHaveCSS("flex-wrap", "nowrap");
  await noHorizontalOverflow(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await swipePayoutRow(page, samBoxes[0]!.id, "left", 30);
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === samBoxes[0]!.id)?.outcome ?? null;
  }).toBeNull();

  const wonButton = page.locator(`[data-box-id="${joBoxes[0]!.id}"] [data-payout-action].won`);
  const wonBox = await wonButton.boundingBox();
  if (!wonBox) throw new Error("missing won button");
  await page.mouse.move(wonBox.x + wonBox.width / 2, wonBox.y + wonBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(wonBox.x + wonBox.width / 2 - 120, wonBox.y + wonBox.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === joBoxes[0]!.id)?.outcome ?? null;
  }).not.toBe("LOST");

  await dragPayoutRow(page, samBoxes[0]!.id, "left", { release: false, distance: 90 });
  await expect(page.locator(`[data-box-id="${samBoxes[0]!.id}"] .payout-reveal.loss`)).toBeVisible();
  await page.screenshot({ path: join(process.cwd(), "docs", "screenshots", "classic", "app-blackjack-payout-drag-left-390x844.png") });
  await releasePayoutDrag(page, samBoxes[0]!.id, "left", 90);
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === samBoxes[0]!.id)?.outcome ?? null;
  }).toBe("LOST");
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === samBoxes[1]!.id)?.outcome ?? null;
  }).toBeNull();

  await dragPayoutRow(page, samBoxes[1]!.id, "right", { release: false, distance: 90 });
  await expect(page.locator(`[data-box-id="${samBoxes[1]!.id}"] .payout-reveal.win`)).toBeVisible();
  await page.screenshot({ path: join(process.cwd(), "docs", "screenshots", "classic", "app-blackjack-payout-drag-right-390x844.png") });
  await releasePayoutDrag(page, samBoxes[1]!.id, "right", 90);
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === samBoxes[1]!.id)?.outcome ?? null;
  }).toBe("WON");
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === joBoxes[0]!.id)?.outcome ?? null;
  }).toBeNull();

  await doubleTapPayoutRow(page, joBoxes[0]!.id);
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === joBoxes[0]!.id)?.outcome ?? null;
  }).toBe("PUSH");
  await expect(page.getByRole("button", { name: "NEXT ROUND NOW" })).toBeEnabled({ timeout: 10_000 });
  await expect(page.locator(".next-round-row")).toBeVisible();
  await expect(page.getByRole("button", { name: "IN 7 SECONDS", exact: true })).toBeVisible();
  await mkdir(join(process.cwd(), "docs", "screenshots", "classic"), { recursive: true });
  await page.screenshot({ path: join(process.cwd(), "docs", "screenshots", "classic", "app-blackjack-round-complete-390x844.png") });
  await expect(page.locator(".outcome-celebration")).toHaveCount(0);

  await page.getByRole("button", { name: "NEXT ROUND NOW" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await samPage.reload();
  await addJetons(samPage, "25");
  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  await samPage.reload();
  await expect(samPage.getByText("Waiting for the Bank").first()).toBeVisible({ timeout: 15_000 });

  const second = (await tableSnapshot(page)) as {
    bank?: { players: { name: string; boxes: { id: string }[] }[] };
  };
  const samNext = second.bank?.players.find((player) => player.name === "Sam")?.boxes?.[0];
  expect(samNext?.id).toBeTruthy();
  await page.locator(`[data-box-id="${samNext!.id}"]`).getByRole("button", { name: /BLACKJACK/ }).click();
  await expect(page.locator(`[data-box-id="${samNext!.id}"]`)).toContainText(/Blackjack/i, { timeout: 10_000 });
  await expect(page.locator(".outcome-celebration")).toHaveCount(0);
  await expect(samPage.locator(".outcome-celebration")).toBeVisible({ timeout: 10_000 });
  await expect(samPage.locator(".outcome-celebration")).toContainText(/BLACKJACK/i);
  await samPage.reload();
  await expect(samPage.locator(".outcome-celebration")).toHaveCount(0);

  await samContext.close();
  await joContext.close();
});

test("DEALER WON settles unresolved boxes as LOST and leaves Insurance alone", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  const ownerEmail = uniqueEmail("dealer-won-bank");
  const samEmail = uniqueEmail("dealer-won-sam");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Dealer won table", { starting: "100" });
  const setupSnap = (await tableSnapshot(page)) as { setup?: { joinUrl: string | null } };
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;
  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await samPage.reload();
  await addJetons(samPage, "25");
  await samPage.getByRole("button", { name: "+ Box" }).click({ force: true });
  await samPage.getByRole("button", { name: /YOUR BOX 2/ }).click({ force: true });
  await addJetons(samPage, "10");
  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await page.getByRole("button", { name: "Open Insurance" }).click();
  await samPage.reload();
  await samPage.getByRole("button", { name: "Insurance" }).click();
  await page.getByRole("button", { name: "Close Insurance" }).click();
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  const snap = (await tableSnapshot(page)) as {
    bank?: { players: { name: string; boxes: { id: string; outcome: string | null }[] }[]; insurance?: { window: string } };
  };
  const boxes = snap.bank?.players.find((player) => player.name === "Sam")?.boxes ?? [];
  expect(boxes.length).toBeGreaterThanOrEqual(2);
  await page.locator(`[data-box-id="${boxes[0]!.id}"]`).getByRole("button", { name: /^WON/ }).click();
  await expect(page.locator(`[data-box-id="${boxes[0]!.id}"]`)).toContainText(/Won/i, { timeout: 10_000 });
  await page.getByRole("button", { name: "DEALER WON" }).click();
  await expect(page.getByText("Dealer wins against all unresolved boxes?")).toBeVisible();
  await page.locator("[data-dealer-box]").getByRole("button", { name: "Confirm" }).click();
  await expect(page.locator(`[data-box-id="${boxes[1]!.id}"]`)).toContainText(/Lost/i, { timeout: 10_000 });
  await expect(page.locator(`[data-box-id="${boxes[0]!.id}"]`)).toContainText(/Won/i);
  await expect(page.getByText(/INSURANCE SIDE POT|INSURANCE/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Dealer Blackjack" })).toBeVisible();
  await samContext.close();
});
