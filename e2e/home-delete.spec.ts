import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, openAs, uniqueEmail } from "./helpers";

test("owner can permanently delete an empty draft from home", async ({ page, context }) => {
  test.setTimeout(120_000);
  const ownerEmail = uniqueEmail("home-del");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Draft to delete", { starting: "100" });
  await page.goto("/");
  const card = page.locator("[data-table-id]");
  await expect(card).toBeVisible();
  await expect(page.getByRole("button", { name: "RESUME" })).toBeVisible();
  await page.getByRole("button", { name: "Table menu" }).click();
  await expect(card.getByText("0 players").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "SAVE TABLE" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CLOSE TABLE" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CLOSE & REMOVE TABLE" })).toHaveCount(0);
  await page.getByRole("button", { name: "DELETE", exact: true }).click();
  await expect(page.getByText("Permanent draft deletion.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.locator("[data-table-id]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toBeVisible();
});

test("owner sees balances, non-owner does not, and started tables archive", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("home-own");
  const samEmail = uniqueEmail("home-sam");
  const joEmail = uniqueEmail("home-jo");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Open salon", { starting: "100" });
  const setupSnap = (await page.request
    .get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`)
    .then((response) => response.json())) as { setup?: { joinUrl: string | null } };
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the table to open betting|Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Open salon")).toBeVisible();
  await expect(page.getByRole("heading", { name: "SAVED TABLES" })).toBeVisible();
  await expect(page.getByText("Resume a table or create a new one.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Table menu" })).toBeVisible();
  await page.getByRole("button", { name: "Table menu" }).click();
  await expect(page.getByText("1 player").first()).toBeVisible();
  await expect(page.getByText("Owner · Alex · Dealer · Alex").first()).toBeVisible();
  await page.getByRole("button", { name: "Table menu" }).click();

  await samPage.goto("/");
  await expect(samPage.getByText("Open salon")).toBeVisible();
  await expect(samPage.getByRole("button", { name: "Table menu" })).toHaveCount(0);
  await expect(samPage.getByRole("button", { name: "END & DELETE" })).toHaveCount(0);

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(joinPath);
  await expect(joPage.getByText(/Waiting for the table to open betting|Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();

  await samPage.goto("/");
  await expect(samPage.getByText("Open salon")).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Table menu" }).click();
  await expect(page.getByText("2 players").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "SAVE TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CLOSE & REMOVE TABLE" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "DELETE", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "CLOSE TABLE" }).click();
  await expect(page.getByText("Historical archival.")).toBeVisible();
  await expect(page.getByText("Saving 100")).toHaveCount(2);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Closed", { exact: true })).toBeVisible();
  await expect(page.getByText("Open salon")).toBeVisible();
  await expect(page.getByRole("button", { name: "RESUME" })).toHaveCount(0);
  await page.getByRole("button", { name: "Table menu" }).click();
  await page.getByRole("button", { name: "DELETE", exact: true }).click();
  await expect(page.getByText("Open salon", { exact: true })).toBeVisible();
  await expect(page.getByText("Closed table removal. Ledger and rounds are kept.")).toBeVisible();
  await mkdir(join(process.cwd(), "docs", "screenshots", "approval"), { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(process.cwd(), "docs", "screenshots", "approval", "05-closed-delete-390x844.png") });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Open salon")).toBeVisible();
  await page.getByRole("button", { name: "Table menu" }).click();
  await page.getByRole("button", { name: "DELETE", exact: true }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Open salon")).toHaveCount(0);

  await samPage.goto("/");
  await expect(samPage.getByText("Open salon")).toHaveCount(0);

  await samContext.close();
  await joContext.close();
});

test("locked bets block close and remove from home", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("lock-own");
  const samEmail = uniqueEmail("lock-sam");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Locked salon", { starting: "100" });
  const setupSnap = (await page.request
    .get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`)
    .then((response) => response.json())) as { setup?: { joinUrl: string | null } };
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;
  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await samPage.reload();
  await samPage.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await samPage.getByRole("button", { name: "Add 25 jetons" }).click({ force: true });
  await expect(samPage.getByText("75", { exact: true }).first()).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Table menu" }).click();
  await expect(page.getByRole("button", { name: "CLOSE TABLE" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "END & DELETE" }).first()).toBeVisible();
  await page.getByRole("button", { name: "END & DELETE" }).first().click();
  await expect(page.getByText(/current hand or round will be abandoned/i)).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Locked salon")).toHaveCount(0);
  await samPage.goto("/");
  await expect(samPage.getByText("Locked salon")).toHaveCount(0);
  await samContext.close();
});

test("owner swipe-left reveals the same destructive actions as the menu", async ({ page, context }) => {
  test.setTimeout(120_000);
  const ownerEmail = uniqueEmail("home-swipe");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Swipe salon", { starting: "100" });
  await page.goto("/");
  const card = page.locator("[data-table-id]").first();
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  if (!box) throw new Error("saved-table card has no box");
  await page.mouse.move(box.x + box.width - 16, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(card.locator("[data-home-delete]")).toBeVisible();
  await page.getByRole("button", { name: "Table menu" }).click();
  await expect(page.getByRole("button", { name: "DELETE", exact: true }).first()).toBeVisible();
});
