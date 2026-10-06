import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, noHorizontalOverflow, openAs, openSetupSheet, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "prompt7-acceptance");

type Snap = {
  tableId: string;
  members?: { userId: string; available: { label: string } }[];
  poker?: { seats: { available: { label: string } }[] };
  gameSession?: { stakeType: string; stakeExample: string };
};

async function tableSnapshot(page: Page): Promise<Snap> {
  const response = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Snap;
}

async function command(page: Page, tableId: string, commandName: string, extra: Record<string, string> = {}) {
  const response = await page.request.post(`/api/tables/${tableId}/commands`, {
    data: { command: commandName, idempotencyKey: crypto.randomUUID(), ...extra },
  });
  if (!response.ok()) {
    throw new Error(`${commandName} failed: ${JSON.stringify(await response.json().catch(() => ({})))}`);
  }
}

async function shot(page: Page, name: string) {
  await mkdir(out, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: false });
}

async function assertNoDocumentScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(overflow).toBeLessThanOrEqual(8);
}

test("prompt 7 compact stakes fun/money/custom + ledger", async ({ page, context, browser }) => {
  test.setTimeout(240_000);
  const ownerEmail = uniqueEmail("p7-owner");
  const caseyEmail = uniqueEmail("p7-casey");
  await openAs(context, page, ownerEmail, "Alex");

  await openSetupSheet(page);
  await page.getByLabel("Table name").fill("Prompt 7 Fun");
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();

  await expect(page.getByRole("button", { name: "Fun only" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Currency")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await assertNoDocumentScroll(page);
  await noHorizontalOverflow(page);
  await shot(page, "01-create-fun-only-390x844");

  await page.getByRole("button", { name: "Money" }).click();
  await expect(page.getByLabel("Currency")).toHaveValue("USD");
  await expect(page.getByLabel("Use a custom jeton-to-money rate")).not.toBeChecked();
  await expect(page.getByText("1 jeton = $1")).toBeVisible();
  await expect(page.getByLabel("Money buy-in for starting jetons")).toHaveCount(0);
  await shot(page, "02-create-money-default-390x844");

  await page.getByLabel("Use a custom jeton-to-money rate").check();
  await expect(page.getByLabel("Money buy-in for starting jetons")).toBeVisible();
  await shot(page, "03-create-money-custom-checked-390x844");
  await page.getByLabel("Money buy-in for starting jetons").fill("10.00");
  await page.getByLabel("Money buy-in for starting jetons").blur();
  await expect(page.getByText(/100 jetons = \$/)).toBeVisible();
  await shot(page, "04-create-100-equals-10-390x844");

  await page.getByRole("button", { name: "Something else" }).click();
  await page.getByLabel("Custom unit label").fill("Dinner");
  await expect(page.getByText(/jetons = 1 Dinner/)).toBeVisible();
  await expect(page.getByLabel("Custom unit label")).toHaveCount(1);
  await shot(page, "05-create-dinner-390x844");

  await page.getByRole("button", { name: "Fun only" }).click();
  await expect(page.getByRole("button", { name: "Fun only" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Table setup", { timeout: 20_000 });

  const live = await tableSnapshot(page);
  expect(live.gameSession?.stakeType).toBe("FUN_ONLY");
  const tableId = live.tableId;
  const verifiedUrl = await page.locator("[data-verified-join-url]").getAttribute("data-verified-join-url");
  expect(verifiedUrl).toBeTruthy();

  const caseyContext = await browser.newContext();
  const caseyPage = await caseyContext.newPage();
  await openAs(caseyContext, caseyPage, caseyEmail, "Casey");
  await caseyPage.goto(new URL(verifiedUrl!).pathname);
  await expect(caseyPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING", { timeout: 20_000 });

  await page.getByRole("button", { name: "BLACKJACK" }).click();
  await page.getByRole("button", { name: "SAVE RESULTS & START NEW GAME" }).click();
  await page.getByRole("button", { name: /Texas Hold/ }).click();
  await expect(page.locator("[data-new-session-setup]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fun only" })).toBeVisible();
  await shot(page, "06-new-game-fun-only-390x844");
  await page.getByRole("button", { name: "Money" }).click();
  await page.getByLabel("Use a custom jeton-to-money rate").check();
  await page.getByLabel("Money buy-in for starting jetons").fill("10.00");
  await shot(page, "07-new-game-custom-usd-390x844");
  await page.getByRole("button", { name: "Fun only" }).click();
  await page.getByRole("button", { name: "START NEW GAME" }).click();
  await expect.poll(async () => (await tableSnapshot(page)).poker?.seats.every((s) => s.available.label === "100")).toBe(true);

  const ids = ((await tableSnapshot(page)).members ?? []).map((m) => m.userId).join(",");
  await command(page, tableId, "saveGameSessionResults", {});
  await page.goto("/ledger");
  await expect(page.getByText("Fun only").first()).toBeVisible();
  await shot(page, "08-ledger-fun-only-390x844");

  await page.goto(`/tables/${tableId}`);
  await command(page, tableId, "startNewGame", {
    game: "BLACKJACK",
    savePersonalLedger: "true",
    startingJetonsPerPlayer: "100",
    participantUserIds: ids,
    stakeType: "MONEY",
    currencyCode: "USD",
  });
  await command(page, tableId, "saveGameSessionResults", {});
  await page.goto("/ledger");
  await expect(page.getByText("Money · USD").first()).toBeVisible();
  await shot(page, "09-ledger-default-usd-390x844");

  await page.goto(`/tables/${tableId}`);
  await command(page, tableId, "startNewGame", {
    game: "BLACKJACK",
    savePersonalLedger: "true",
    startingJetonsPerPlayer: "100",
    participantUserIds: ids,
    stakeType: "MONEY",
    currencyCode: "USD",
    moneyBuyIn: "10.00",
  });
  await command(page, tableId, "saveGameSessionResults", {});
  await page.goto("/ledger");
  await expect(page.getByText(/100 jetons = \$10/)).toBeVisible();
  await shot(page, "10-ledger-custom-usd-390x844");

  await page.goto(`/tables/${tableId}`);
  await command(page, tableId, "startNewGame", {
    game: "BLACKJACK",
    savePersonalLedger: "true",
    startingJetonsPerPlayer: "100",
    participantUserIds: ids,
    stakeType: "CUSTOM",
    customUnitLabel: "Dinner",
    jetonsPerCustomUnit: "50",
  });
  await command(page, tableId, "saveGameSessionResults", {});
  await page.goto("/ledger");
  await expect(page.getByText(/Dinner|50 jetons/)).toBeVisible();
  await shot(page, "11-ledger-dinner-390x844");

  for (const size of [
    { width: 360, height: 800 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(size);
    await openSetupSheet(page);
    await noHorizontalOverflow(page);
    await page.getByRole("button", { name: "Cancel" }).click();
  }

  await caseyContext.close();
});

test("prompt 7 blackjack + poker smoke with funded dealer", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await openAs(context, page, uniqueEmail("p7-bj"), "Alex");
  await createBlackjackTable(page, "P7 BJ smoke", { starting: "100" });
  const verifiedUrl = await page.locator("[data-verified-join-url]").getAttribute("data-verified-join-url");
  const caseyContext = await browser.newContext();
  const caseyPage = await caseyContext.newPage();
  await openAs(caseyContext, caseyPage, uniqueEmail("p7-poker"), "Casey");
  await caseyPage.goto(new URL(verifiedUrl!).pathname);
  await expect(caseyPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING", { timeout: 20_000 });

  const snap = await tableSnapshot(page);
  const members = snap.members ?? [];
  await command(page, snap.tableId, "startNewGame", {
    game: "POKER",
    savePersonalLedger: "false",
    startingJetonsPerPlayer: "100",
    participantUserIds: members.map((m) => m.userId).join(","),
    stakeType: "FUN_ONLY",
  });
  await expect.poll(async () => (await tableSnapshot(page)).poker?.seats.every((s) => s.available.label === "100")).toBe(true);
  await caseyContext.close();
});
