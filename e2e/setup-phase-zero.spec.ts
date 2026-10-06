import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, createPokerTable, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "setup-phase-zero");

async function shot(page: import("@playwright/test").Page, name: string) {
  await mkdir(out, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, name) });
}

test("create table setup, Phase 0 join, then Open Betting", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("p6-own");
  const samEmail = uniqueEmail("p6-sam");
  await openAs(context, page, ownerEmail, "Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START BETTING" })).toHaveCount(0);
  await page.getByLabel("Table name").fill("Phase Zero BJ");
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByRole("button", { name: "Blackjack" }).click();
  await shot(page, "04-create-blackjack-390x844.png");
  await page.getByRole("button", { name: "LIMITED BANK" }).click();
  await expect(page.getByLabel("Starting Bank jetons")).toBeVisible();
  await shot(page, "07-create-limited-bank-390x844.png");
  await page.getByRole("button", { name: "OPEN BANK" }).click();
  await shot(page, "06-create-open-bank-390x844.png");
  await page.getByRole("button", { name: /Texas Hold/i }).click();
  await shot(page, "05-create-poker-390x844.png");
  await page.getByRole("button", { name: "Blackjack" }).click();
  await expect(page.getByRole("tab", { name: "GUEST QR" })).toBeVisible();
  await page.getByRole("tab", { name: "GUEST QR" }).click();
  await expect(page.getByRole("button", { name: "SEND INVITE" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Copy Guest Link|Copy link/i }).first()).toBeVisible();
  await shot(page, "08-invite-sheet-390x844.png");
  const joinUrl = await page.locator("[data-verified-join-url]").first().getAttribute("data-verified-join-url");
  expect(joinUrl).toBeTruthy();
  expect(joinUrl).not.toMatch(/localhost|railway\.internal/i);
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("TABLE SETUP");
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeDisabled();
  await expect(page.locator("[data-seat-status=empty]")).toHaveCount(0);
  await expect(page.locator("[data-empty-waiting]")).toBeVisible();
  await shot(page, "09-phase0-blackjack-empty-390x844.png");
  await expect(page.getByRole("button", { name: "START TABLE" })).toHaveCount(0);

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(new URL(joinUrl!).pathname);
  await expect(samPage.getByText(/Waiting for the table to open betting|WAITING FOR PLAYERS/i).first()).toBeVisible();
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "10-phase0-blackjack-joined-390x844.png");
  await shot(samPage, "14-phase0-player-390x844.png");
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText(/Betting is open\.|Betting open/);
  await samPage.reload();
  await expect(samPage.getByText("YOUR JETONS")).toBeVisible();
  await samContext.close();
});

test("poker Phase 0 oval table; START HAND seat hint only after failed attempt", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("p6-pk");
  await openAs(context, page, ownerEmail, "Alex");
  await createPokerTable(page, "Phase Zero Poker", { starting: "100" });
  await expect(page.getByRole("button", { name: "START HAND" })).toBeEnabled();
  await expect(page.locator("[data-phase-heading]")).toHaveText("TABLE SETUP");
  await expect(page.locator('[data-poker-rail="oval"]')).toBeVisible();
  await expect(page.locator('[data-centre-divider="absent"]')).toBeAttached();
  await expect(page.getByText(/Add at least two Players/i)).toHaveCount(0);
  await shot(page, "11-phase0-poker-waiting-390x844.png");

  await page.getByRole("button", { name: "START HAND" }).click();
  await expect(page.locator("[data-poker-seat-hint=true]")).toHaveText(/Add at least two Players to start a Poker hand/i, {
    timeout: 10_000,
  });
  await expect(page.locator(".tt-error")).toHaveCount(0);
  await expect(page.locator("[data-phase-heading]")).toHaveText("TABLE SETUP");

  const snap = (await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((r) => r.json())) as {
    setup?: { joinUrl: string | null };
  };
  const joinUrl = snap.setup?.joinUrl;
  expect(joinUrl).toBeTruthy();

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, uniqueEmail("p6-pk-sam"), "Sam");
  await samPage.goto(new URL(joinUrl!).pathname);
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-poker-seat-hint=true]")).toHaveCount(0, { timeout: 20_000 });
  await shot(page, "12-phase0-poker-ready-390x844.png");
  await shot(page, "13-phase0-dealer-390x844.png");
  await page.getByRole("button", { name: "START HAND" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PRE-FLOP");
  await samContext.close();
});

test("owner can cancel or confirm delete; non-owner cannot delete", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("p6-del");
  const samEmail = uniqueEmail("p6-del-sam");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Disposable table", { starting: "100" });
  const setupSnap = (await page.request
    .get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`)
    .then((response) => response.json())) as { tableId: string; setup?: { joinUrl: string | null } };
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the table to open betting|WAITING FOR PLAYERS/i).first()).toBeVisible();
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });

  const blocked = await samPage.request.post(`/api/tables/${setupSnap.tableId}/commands`, {
    data: { command: "deleteTable", idempotencyKey: crypto.randomUUID() },
  });
  expect(blocked.status()).toBeGreaterThanOrEqual(400);

  await page.goto("/");
  await page.getByRole("button", { name: "Table menu" }).click();
  await expect(page.getByRole("button", { name: "DELETE" })).toHaveCount(0);
  await samPage.goto("/");
  await expect(samPage.getByRole("button", { name: "Table menu" })).toHaveCount(0);

  await createBlackjackTable(page, "Empty disposable", { starting: "100" });
  await page.goto("/");
  await shot(page, "01-home-saved-tables-390x844.png");
  const empty = page.locator("[data-table-id]").filter({ hasText: "Empty disposable" });
  await empty.getByRole("button", { name: "Table menu" }).click();
  await shot(page, "02-owner-delete-menu-390x844.png");
  await empty.getByRole("button", { name: "DELETE" }).click();
  await expect(page.getByText("Empty disposable", { exact: true }).first()).toBeVisible();
  await shot(page, "03-delete-confirm-390x844.png");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Empty disposable", { exact: true }).first()).toBeVisible();
  await empty.getByRole("button", { name: "Table menu" }).click();
  await empty.getByRole("button", { name: "DELETE" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Empty disposable", { exact: true })).toHaveCount(0);
  await samContext.close();
});
