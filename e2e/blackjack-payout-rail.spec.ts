import { expect, test, type Page } from "@playwright/test";
import {
  createBlackjackTable,
  doubleTapPayoutRow,
  openAs,
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
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();

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
  await page.setViewportSize({ width: 390, height: 844 });

  await swipePayoutRow(page, samBoxes[0]!.id, "left");
  await expect(page.locator(`[data-box-id="${samBoxes[0]!.id}"]`)).toContainText(/Lost/i, { timeout: 10_000 });
  await expect(page.locator(`[data-box-id="${samBoxes[1]!.id}"]`)).toContainText("Unresolved");
  await expect(page.locator(`[data-box-id="${joBoxes[0]!.id}"]`)).toContainText("Unresolved");

  await swipePayoutRow(page, samBoxes[1]!.id, "right");
  await expect(page.locator(`[data-box-id="${samBoxes[1]!.id}"]`)).toContainText(/Won/i, { timeout: 10_000 });
  await expect(page.locator(`[data-box-id="${joBoxes[0]!.id}"]`)).toContainText("Unresolved");

  await doubleTapPayoutRow(page, joBoxes[0]!.id);
  await expect(page.locator(`[data-box-id="${joBoxes[0]!.id}"]`)).toContainText(/Stand off/i, { timeout: 10_000 });
  await expect(page.getByRole("button", { name: "NEXT ROUND NOW" })).toBeEnabled({ timeout: 10_000 });
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
