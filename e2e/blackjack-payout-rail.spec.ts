import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  doubleTapPayoutRow,
  noHorizontalOverflow,
  openAs,
  swipePayoutRow,
  uniqueEmail,
  openTableMenu,
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
  await expect(samPage.getByText(/Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(joinPath);
  await expect(joPage.getByText(/Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();

  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "OPEN BETTING" }).click();

  await samPage.reload();
  await expect(samPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(samPage.locator("[data-box-id]").first()).toBeVisible();
  await expect(samPage.getByRole("button", { name: "Add 25 jetons" })).toBeEnabled();
  await addJetons(samPage, "25");
  await expect.poll(async () => {
    const snap = (await tableSnapshot(samPage)) as { player?: { boxes: { boxNumber: number; bet: { label: string } }[] } };
    return snap.player?.boxes.find((box) => box.boxNumber === 1)?.bet.label ?? "";
  }).toBe("25");
  await samPage.getByRole("button", { name: "START ADDITIONAL BOX" }).click({ force: true });
  await expect.poll(async () => {
    const snap = (await tableSnapshot(samPage)) as { player?: { boxes: { id: string; boxNumber: number; bet: { label: string } }[] } };
    return snap.player?.boxes.length ?? 0;
  }).toBe(2);
  const samBetting = (await tableSnapshot(samPage)) as { player?: { boxes: { id: string; boxNumber: number; bet: { label: string } }[] } };
  const extraBox = samBetting.player?.boxes.find((box) => box.boxNumber === 2);
  expect(extraBox?.id).toBeTruthy();
  await samPage.locator(`[data-box-id="${extraBox!.id}"]`).click();
  await addJetons(samPage, "10");
  await expect.poll(async () => {
    const snap = (await tableSnapshot(samPage)) as { player?: { boxes: { boxNumber: number; bet: { label: string } }[] } };
    return snap.player?.boxes.find((box) => box.boxNumber === 2)?.bet.label ?? "";
  }).toBe("10");
  await joPage.reload();
  await expect(joPage.getByText("YOUR JETONS")).toBeVisible();
  await addJetons(joPage, "25");
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as {
      bank?: { boxCount?: number; players: { name: string; boxes: { bet?: { label: string } }[] }[] };
    };
    const sam = snap.bank?.players.find((player) => player.name === "Sam")?.boxes ?? [];
    const jo = snap.bank?.players.find((player) => player.name === "Jo")?.boxes ?? [];
    const samBets = sam.map((box) => box.bet?.label ?? "0").sort();
    const samLive = samBets.filter((label) => label !== "0").length;
    return { samLive, samBets, jo: jo.length, boxCount: snap.bank?.boxCount ?? 0 };
  }, { timeout: 15_000 }).toEqual({ samLive: 2, samBets: ["10", "25"], jo: 1, boxCount: 3 });

  await expect(page.getByRole("button", { name: "CLOSE BETTING" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await expect(page.locator(".phone")).toHaveCount(1);
  await expect(page.locator(".bj-rail")).toHaveCount(0);
  await expect(page.locator(".table-rail")).toHaveCount(0);
  await expect(page.locator("[data-dealer-box]")).toBeVisible();
  await expect(page.locator("[data-dealer-box]").getByText("DEALER", { exact: true })).toBeVisible();
  expect(await page.locator("[data-blackjack-box-row]").count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator(".betting-spot")).toHaveCount(0);
  await mkdir(join(process.cwd(), "docs", "screenshots", "classic"), { recursive: true });
  await page.screenshot({ path: join(process.cwd(), "docs", "screenshots", "classic", "app-blackjack-dealer-playing-390x844.png") });
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  await expect(page.locator("[data-dealer-box]")).toBeVisible();
  await expect(page.locator("[data-dealer-box]")).toContainText("DEALER");
  await expect(page.locator("[data-table-board=BLACKJACK_DEALER]").getByRole("button", { name: "DEALER WON" })).toHaveCount(0);
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

  await page.locator(`[data-box-id="${samBoxes[0]!.id}"]`).getByRole("button", { name: "LOST" }).click();
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === samBoxes[0]!.id)?.outcome ?? null;
  }, { timeout: 10_000 }).toBe("LOST");
  await page.screenshot({ path: join(process.cwd(), "docs", "screenshots", "classic", "app-blackjack-payout-drag-left-390x844.png") });
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === samBoxes[1]!.id)?.outcome ?? null;
  }).toBeNull();

  await page.locator(`[data-box-id="${samBoxes[1]!.id}"]`).getByRole("button", { name: "WON" }).click();
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === samBoxes[1]!.id)?.outcome ?? null;
  }, { timeout: 10_000 }).toBe("WON");
  await page.screenshot({ path: join(process.cwd(), "docs", "screenshots", "classic", "app-blackjack-payout-drag-right-390x844.png") });
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === joBoxes[0]!.id)?.outcome ?? null;
  }).toBeNull();

  await doubleTapPayoutRow(page, joBoxes[0]!.id);
  await expect.poll(async () => {
    const snap = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string; outcome: string | null }[] }[] } };
    return snap.bank?.players.flatMap((player) => player.boxes).find((box) => box.id === joBoxes[0]!.id)?.outcome ?? null;
  }).toBe("PUSH");
  await expect(page.getByRole("button", { name: "START NEXT ROUND" })).toBeEnabled({ timeout: 10_000 });
  await openTableMenu(page);
  await expect(page.locator(".sheet.open").getByRole("button", { name: "IN 7 SECONDS", exact: true })).toBeVisible();
  await page.locator(".sheet.open").getByRole("button", { name: "Cancel" }).click();
  await mkdir(join(process.cwd(), "docs", "screenshots", "classic"), { recursive: true });
  await page.screenshot({ path: join(process.cwd(), "docs", "screenshots", "classic", "app-blackjack-round-complete-390x844.png") });
  await expect(page.locator(".outcome-celebration")).toHaveCount(0);

  await page.getByRole("button", { name: "START NEXT ROUND" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await samPage.reload();
  await addJetons(samPage, "25");
  await expect(page.getByRole("button", { name: "CLOSE BETTING" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  await samPage.reload();
  await expect(samPage.getByText("ROUND COMPLETE").first()).toBeVisible({ timeout: 15_000 });

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
  await expect(samPage.getByText(/Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await samPage.reload();
  await expect(samPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(samPage.locator("[data-box-id]").first()).toBeVisible();
  await expect(samPage.getByRole("button", { name: "Add 25 jetons" })).toBeEnabled();
  await addJetons(samPage, "25");
  await expect.poll(async () => {
    const snap = (await tableSnapshot(samPage)) as { player?: { boxes: { boxNumber: number; bet: { label: string } }[] } };
    return snap.player?.boxes.find((box) => box.boxNumber === 1)?.bet.label ?? "";
  }).toBe("25");
  await samPage.getByRole("button", { name: "START ADDITIONAL BOX" }).click({ force: true });
  await expect.poll(async () => {
    const snap = (await tableSnapshot(samPage)) as { player?: { boxes: { id: string; boxNumber: number; bet: { label: string } }[] } };
    return snap.player?.boxes.length ?? 0;
  }).toBe(2);
  const extraBox = ((await tableSnapshot(samPage)) as { player?: { boxes: { id: string; boxNumber: number }[] } }).player?.boxes.find((box) => box.boxNumber === 2);
  expect(extraBox?.id).toBeTruthy();
  await samPage.locator(`[data-box-id="${extraBox!.id}"]`).click();
  await addJetons(samPage, "10");
  await expect.poll(async () => {
    const snap = (await tableSnapshot(samPage)) as { player?: { boxes: { boxNumber: number; bet: { label: string } }[] } };
    return snap.player?.boxes.find((box) => box.boxNumber === 2)?.bet.label ?? "";
  }).toBe("10");
  await expect(page.getByRole("button", { name: "CLOSE BETTING" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await page.getByRole("button", { name: "Open Insurance" }).click();
  await samPage.reload();
  await samPage.getByRole("button", { name: "PLACE INSURANCE" }).click();
  await page.getByRole("button", { name: "Close Insurance" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  const snap = (await tableSnapshot(page)) as {
    bank?: { players: { name: string; boxes: { id: string; outcome: string | null }[] }[]; insurance?: { window: string } };
  };
  const boxes = snap.bank?.players.find((player) => player.name === "Sam")?.boxes ?? [];
  expect(boxes.length).toBeGreaterThanOrEqual(2);
  await page.locator(`[data-box-id="${boxes[0]!.id}"]`).getByRole("button", { name: /^WON/ }).click();
  await expect(page.locator(`[data-box-id="${boxes[0]!.id}"]`)).toContainText(/Won/i, { timeout: 10_000 });
  await expect(page.locator("[data-table-board=BLACKJACK_DEALER]").getByRole("button", { name: "DEALER WON" })).toHaveCount(0);
  await openTableMenu(page);
  await page.locator(".sheet.open").getByRole("button", { name: "DEALER WON" }).click();
  await expect(page.getByText("Dealer wins against all unresolved boxes?")).toBeVisible();
  await page.locator(".sheet.open").getByRole("button", { name: "Confirm" }).click();
  await expect(page.locator(`[data-box-id="${boxes[1]!.id}"]`)).toContainText(/Lost/i, { timeout: 10_000 });
  await expect(page.locator(`[data-box-id="${boxes[0]!.id}"]`)).toContainText(/Won/i);
  await expect(page.getByRole("button", { name: "INS WON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "INS LOST" })).toBeVisible();
  await samContext.close();
});
