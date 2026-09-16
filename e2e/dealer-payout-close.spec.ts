import { expect, test, type Page } from "@playwright/test";
import { createBlackjackTable, openAs, uniqueEmail } from "./helpers";

async function tableSnapshot(page: Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json());
}

async function swipeRow(page: Page, boxId: string, direction: "right" | "left") {
  const inner = page.locator(`[data-box-id="${boxId}"] .payout-row-inner`);
  await expect(inner).toBeVisible();
  const box = await inner.boundingBox();
  if (!box) throw new Error("missing payout row");
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (direction === "right" ? 120 : -120), y, { steps: 12 });
  await page.mouse.up();
}

async function addJetons(page: Page, amount: "5" | "10" | "25") {
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.getByRole("button", { name: `Add ${amount} jetons` }).click({ force: true });
}

test("dealer list payouts, next round countdown and close table", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("bank");
  const samEmail = uniqueEmail("sam");
  const joEmail = uniqueEmail("jo");

  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Payout table", { starting: "100" });
  const setupSnap = (await tableSnapshot(page)) as { setup?: { joinUrl: string | null } };
  expect(setupSnap.setup?.joinUrl).toBeTruthy();
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;

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
  await expect(page.locator(".dealer-list")).toBeVisible();
  await expect(page.locator(".dealer-grid")).toHaveCount(0);

  await samPage.reload();
  await expect(samPage.getByRole("button", { name: "Add 25 jetons" })).toBeVisible();
  await addJetons(samPage, "25");
  await samPage.getByRole("button", { name: "+ Box" }).click({ force: true });
  await samPage.getByRole("button", { name: /YOUR BOX 2/ }).click({ force: true });
  await addJetons(samPage, "10");
  await joPage.reload();
  await expect(joPage.getByRole("button", { name: "Add 25 jetons" })).toBeVisible();
  await addJetons(joPage, "25");
  await expect(joPage.getByText("75", { exact: true }).first()).toBeVisible();
  await expect(samPage.getByText("65", { exact: true }).first()).toBeVisible();

  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open Insurance" }).click();
  await samPage.reload();
  await samPage.getByRole("button", { name: /YOUR BOX 1/ }).click();
  await samPage.getByRole("button", { name: "Insurance" }).click();
  await page.getByRole("button", { name: "Close Insurance" }).click();
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "NEXT ROUND NOW" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "NEXT ROUND IN 7 SECONDS" })).toBeDisabled();

  const payoutSnap = (await tableSnapshot(page)) as {
    bank?: { players: { name: string; boxes: { id: string }[] }[] };
  };
  const samBoxes = payoutSnap.bank?.players.find((player) => player.name === "Sam")?.boxes ?? [];
  const joBoxes = payoutSnap.bank?.players.find((player) => player.name === "Jo")?.boxes ?? [];
  expect(samBoxes.length).toBeGreaterThanOrEqual(2);
  expect(joBoxes.length).toBe(1);

  await swipeRow(page, samBoxes[0]!.id, "right");
  await expect(page.locator(`[data-box-id="${samBoxes[0]!.id}"]`)).toContainText(/Won/i, { timeout: 10_000 });
  await swipeRow(page, samBoxes[1]!.id, "left");
  await expect(page.locator(`[data-box-id="${samBoxes[1]!.id}"]`)).toContainText(/Lost/i, { timeout: 10_000 });
  await page.locator(`[data-box-id="${joBoxes[0]!.id}"]`).getByRole("button", { name: /STAND OFF/ }).click();
  await expect(page.getByRole("button", { name: "NEXT ROUND NOW" })).toBeDisabled();
  await page.getByRole("button", { name: "No Blackjack" }).click();

  await expect(page.getByRole("button", { name: "NEXT ROUND NOW" })).toBeEnabled({ timeout: 10_000 });
  await page.getByRole("button", { name: "NEXT ROUND IN 7 SECONDS" }).click();
  await expect(page.getByText(/Next round in [1-7]/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Next round in [1-7]/)).toBeVisible();
  await page.getByRole("button", { name: "NEXT ROUND NOW" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await samPage.reload();
  await joPage.reload();
  await expect(samPage.getByText("BETTING").or(samPage.getByText("YOUR JETONS"))).toBeVisible();
  await expect(joPage.getByText("BETTING").or(joPage.getByText("YOUR JETONS"))).toBeVisible();

  await addJetons(samPage, "5");
  await addJetons(joPage, "5");
  await expect(samPage.getByText("97.5", { exact: true }).first()).toBeVisible();
  await expect(joPage.getByText("95", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  const second = (await tableSnapshot(page)) as { bank?: { players: { boxes: { id: string }[] }[] } };
  for (const player of second.bank?.players ?? []) {
    for (const box of player.boxes) {
      await page.locator(`[data-box-id="${box.id}"]`).getByRole("button", { name: /STAND OFF/ }).click({ force: true });
    }
  }
  await expect(page.getByRole("button", { name: "NEXT ROUND NOW" })).toBeEnabled();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "CLOSE TABLE & SAVE BALANCES" }).click();
  await expect(page.getByText(/Save each Player/i)).toBeVisible();
  await page.getByRole("button", { name: "Confirm close" }).click();
  await expect(page.getByRole("button", { name: /CREATE (A|NEW) TABLE/ })).toBeVisible();

  const retry = await page.request.post(`/api/tables/${tableId}/commands`, {
    data: { command: "closeTable", idempotencyKey: crypto.randomUUID() },
  });
  expect(retry.ok()).toBeTruthy();

  await samContext.close();
  await joContext.close();
});
