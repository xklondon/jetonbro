import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { noHorizontalOverflow } from "./helpers";
import { currentMailId, requestStagingMagicLink, waitForStagingMagicLink } from "./staging-login";

const origin = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ?? "";
const out = join(process.cwd(), "docs", "screenshots", "prompt7-production");

test.skip(!origin.includes("railway.app"), "production-only: set PLAYWRIGHT_BASE_URL to JetBro II Web");

type Snap = {
  tableId: string;
  members?: { userId: string; available: { label: string } }[];
  poker?: { seats: { available: { label: string } }[] };
  gameSession?: { stakeType: string; stakeExample: string };
  phase?: string;
};

async function signIn(page: Page, email: string) {
  const previous = currentMailId();
  await requestStagingMagicLink(email);
  const { url } = await waitForStagingMagicLink(previous);
  expect(url.startsWith(origin)).toBe(true);
  await page.goto(url);
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 20_000 });
  await page.waitForTimeout(12_000);
}

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

test("Prompt 7 live: FUN ONLY / Money custom / Dinner / Poker switch", async ({ page, context, browser }) => {
  test.setTimeout(420_000);
  const stamp = Date.now();
  const ownerEmail = `p7-live-owner-${stamp}@jetonbro.test`;
  const caseyEmail = `p7-live-casey-${stamp}@jetonbro.test`;
  await signIn(page, ownerEmail);

  await page.goto(`${origin}/`);
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Table name").fill(`P7 Live ${stamp}`);
  await page.getByLabel("Table name").blur();
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();

  await expect(page.getByRole("button", { name: "Fun only" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Currency")).toHaveCount(0);
  await expect(page.getByLabel("Money buy-in for starting jetons")).toHaveCount(0);
  await noHorizontalOverflow(page);
  await shot(page, "01-live-fun-only");

  await page.getByRole("button", { name: "Money" }).click();
  await expect(page.getByLabel("Currency")).toHaveValue("USD");
  await expect(page.getByText("1 jeton = $1")).toBeVisible();
  await shot(page, "02-live-money-default");

  await page.getByLabel("Use a custom jeton-to-money rate").check();
  await page.getByLabel("Money buy-in for starting jetons").fill("10.00");
  await page.getByLabel("Money buy-in for starting jetons").blur();
  await expect(page.getByText(/100 jetons = \$/)).toBeVisible();
  await shot(page, "03-live-custom-rate");

  await page.getByRole("button", { name: "Something else" }).click();
  await page.getByLabel("Custom unit label").fill("Dinner");
  await expect(page.getByText(/jetons = 1 Dinner/)).toBeVisible();
  await shot(page, "04-live-dinner");

  await page.getByRole("button", { name: "Fun only" }).click();
  await expect(page.getByRole("button", { name: "Fun only" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Table setup", { timeout: 30_000 });
  const snap = await tableSnapshot(page);
  expect(snap.gameSession?.stakeType).toBe("FUN_ONLY");
  const tableId = snap.tableId;
  const verifiedUrl = await page.locator("[data-verified-join-url]").getAttribute("data-verified-join-url");
  expect(verifiedUrl).toBeTruthy();

  const caseyContext = await browser.newContext();
  const caseyPage = await caseyContext.newPage();
  await signIn(caseyPage, caseyEmail);
  await caseyPage.goto(verifiedUrl!);
  await expect(caseyPage).toHaveURL(/\/tables\//, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING", { timeout: 30_000 });

  // Money custom rate result via save after switch
  const ids = ((await tableSnapshot(page)).members ?? []).map((m) => m.userId).join(",");
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
  await page.goto(`${origin}/ledger`);
  await expect(page.getByText(/100 jetons = \$10|Money · USD/).first()).toBeVisible({ timeout: 20_000 });
  await shot(page, "05-live-ledger-custom");

  await page.goto(`${origin}/tables/${tableId}`);
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
  await page.goto(`${origin}/ledger`);
  await expect(page.getByText(/Dinner|50 jetons/).first()).toBeVisible();

  await page.goto(`${origin}/tables/${tableId}`);
  await command(page, tableId, "startNewGame", {
    game: "POKER",
    savePersonalLedger: "false",
    startingJetonsPerPlayer: "100",
    participantUserIds: ids,
    stakeType: "FUN_ONLY",
  });
  await expect.poll(async () => (await tableSnapshot(page)).poker?.seats.every((s) => s.available.label === "100")).toBe(true);
  await expect(page.getByRole("button", { name: "START HAND", exact: true })).toBeVisible();
  await shot(page, "06-live-poker-fresh");

  // Gameplay chrome unchanged smoke
  await expect(page.locator("[data-phase-heading]")).toBeVisible();
  await caseyContext.close();
});
