import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createPokerTable, expectNoDocumentScroll, openAs, openSetupSheet, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "tabletop", "poker-prompt8");

async function shot(page: import("@playwright/test").Page, name: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, `${name}-390x844.png`) });
}

test("Prompt 8: Create Poker → Phase 0 oval → START HAND seat hint", async ({ page, context, browser }) => {
  test.setTimeout(240_000);
  await mkdir(out, { recursive: true });
  await openAs(context, page, uniqueEmail("p8-own"), "Owner");
  await page.setViewportSize({ width: 390, height: 844 });

  await openSetupSheet(page);
  await page.getByLabel("Table name").fill("P8 Hold em");
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();
  await page.getByRole("button", { name: /Texas Hold/i }).click();
  await expect(page.locator("[data-selected-game=POKER]")).toBeVisible();
  await expect(page.getByText(/needs at least two/i)).toHaveCount(0);
  await expect(page.locator(".tt-error")).toHaveCount(0);
  await shot(page, "01-create-poker-zero-players");

  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("TABLE SETUP", { timeout: 20_000 });
  await expect(page.locator('[data-poker-rail="oval"]')).toBeVisible();
  await expect(page.getByText(/Waiting for Players/i)).toBeVisible();
  await expect(page.getByText(/STREET\s+\d/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "BLACKJACK" })).toBeVisible();
  await shot(page, "02-poker-dealer-phase0-zero");

  await page.getByRole("button", { name: "START HAND" }).click();
  await expect(page.locator("[data-poker-seat-hint=true]")).toHaveText(/Add at least two Players to start a Poker hand/);
  await expect(page.locator(".tt-error")).toHaveCount(0);
  await shot(page, "03-start-hand-compact-hint");

  const snap = (await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((r) => r.json())) as {
    setup?: { joinUrl: string | null };
  };
  const joinPath = new URL(snap.setup!.joinUrl!).pathname;
  const samContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, uniqueEmail("p8-sam"), "Sam");
  await samPage.goto(joinPath);
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-poker-seat-hint=true]")).toHaveCount(0);
  await shot(page, "04-poker-dealer-phase0-two");
  await shot(samPage, "05-poker-player-phase0");
  await expect(samPage.locator('[data-poker-rail="oval"]')).toBeVisible();
  await expect(samPage.getByRole("button", { name: "START HAND" })).toHaveCount(0);
  await expect(samPage.getByRole("button", { name: "BLACKJACK" })).toHaveCount(0);

  await expectNoDocumentScroll(page);
  for (const size of [
    { width: 360, height: 800 },
    { width: 430, height: 932 },
  ] as const) {
    await page.setViewportSize(size);
    await expectNoDocumentScroll(page);
  }

  await samContext.close();
});

test("Prompt 8 helper createPokerTable lands on oval TABLE SETUP", async ({ page, context }) => {
  await openAs(context, page, uniqueEmail("p8-helper"), "Owner");
  await createPokerTable(page, "Helper Poker", { starting: "100" });
  await expect(page.locator('[data-poker-rail="oval"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "START HAND" })).toBeEnabled();
});
