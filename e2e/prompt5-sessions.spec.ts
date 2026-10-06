import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, noHorizontalOverflow, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "prompt5-acceptance");

type Snap = {
  tableId: string;
  isOwner?: boolean;
  bank?: {
    phase: string;
    boxes?: { id: string; boxNumber: number; outcome: string | null }[];
    players?: { userId: string; name: string; boxes: { id: string; boxNumber: number; outcome: string | null }[] }[];
  };
  setup?: { joinUrl: string | null };
  members?: { userId: string; name: string; available: { label: string }; isOwner?: boolean; isBankDealer?: boolean }[];
  poker?: { phase: string; seats: { userId: string; available: { label: string }; isDealer: boolean }[] };
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

test("prompt 5 payout row, betting copy, session switch, ledger, wipe privacy", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("p5-owner");
  const caseyEmail = uniqueEmail("p5-casey");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Prompt 5 table", { starting: "100" });
  const setup = await tableSnapshot(page);
  const verifiedUrl = await page.locator("[data-verified-join-url]").getAttribute("data-verified-join-url");
  const joinPath = new URL(verifiedUrl!).pathname;
  const tableId = setup.tableId;

  await expect(page.getByRole("button", { name: "DEALER" })).toBeVisible();
  await expect(page.getByRole("button", { name: "BLACKJACK" })).toBeVisible();
  await shot(page, "04-owner-safe-boundary-badges-390x844");
  await page.getByRole("button", { name: "DEALER" }).click();
  await expect(page.getByText(/Assign dealer|Change dealer|Dealer/i).first()).toBeVisible();
  await shot(page, "05-change-dealer-sheet-390x844");
  await page.locator(".tt-sheet.sheet.open").click({ position: { x: 8, y: 8 } });
  await expect(page.locator(".sheet.open")).toHaveCount(0);

  const caseyContext = await browser.newContext();
  const caseyPage = await caseyContext.newPage();
  await openAs(caseyContext, caseyPage, caseyEmail, "Casey");
  await caseyPage.goto(joinPath);
  await expect(caseyPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING", { timeout: 20_000 });
  await expect(page.getByText("Betting open")).toHaveCount(0);
  await shot(page, "03-blackjack-betting-only-390x844");
  for (const width of [360, 390, 430] as const) {
    await page.setViewportSize({ width, height: 844 });
    await noHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  await caseyPage.reload();
  await expect(caseyPage.getByRole("button", { name: "Add 25 jetons" })).toBeEnabled();
  await caseyPage.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await caseyPage.getByRole("button", { name: "Add 25 jetons" }).click({ force: true });
  await expect.poll(async () => {
    const snap = (await caseyPage.request.get(`${caseyPage.url().replace("/tables/", "/api/tables/")}/snapshot`).then((r) => r.json())) as {
      player?: { boxes: { boxNumber: number; bet: { label: string } }[] };
    };
    return snap.player?.boxes.find((box) => box.boxNumber === 1)?.bet.label ?? "";
  }).toBe("25");

  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.getByRole("button", { name: /Set Box 1 result: Lost/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Set Box 1 result: Stand-off/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Set Box 1 result: Blackjack/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Set Box 1 result: Won/ })).toBeVisible();
  const row = page.locator(".tt-ledger-results").first();
  const box = await row.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await shot(page, "01-blackjack-unresolved-payout-row-390x844");

  await page.getByRole("button", { name: "Set Box 1 result: Won" }).click();
  await expect(page.locator('[data-box-result="WON"]')).toBeVisible();
  await shot(page, "02-blackjack-settled-payout-390x844");

  await page.getByRole("button", { name: "BLACKJACK" }).click();
  await expect(page.getByRole("button", { name: "SAVE RESULTS & START NEW GAME" })).toBeVisible();
  await shot(page, "06-save-previous-game-sheet-390x844");
  await page.getByRole("button", { name: "SAVE RESULTS & START NEW GAME" }).click();
  await page.getByRole("button", { name: /Texas Hold/ }).click();
  await expect(page.locator("[data-new-session-setup]")).toBeVisible();
  await page.getByLabel("Starting jetons per player").fill("100");
  await shot(page, "07-new-poker-setup-390x844");
  await expect(page.getByText("PLAYING FOR")).toBeVisible();
  await shot(page, "08-playing-for-money-390x844");
  await page.getByRole("button", { name: "Something else" }).click();
  await page.getByLabel("Custom unit label").fill("Dinner");
  await shot(page, "09-playing-for-dinner-390x844");
  await page.getByRole("button", { name: "START NEW GAME" }).click();

  await expect.poll(async () => (await tableSnapshot(page)).poker?.seats.every((seat) => seat.available.label === "100")).toBe(true);
  await shot(page, "10-new-poker-session-funded-390x844");

  const members = (await tableSnapshot(page)).members ?? [];
  const ids = members.map((member) => member.userId).join(",");
  await command(page, tableId, "saveGameSessionResults", {});
  await page.goto("/ledger");
  await expect(page.locator("[data-game-ledger]")).toBeVisible();
  await shot(page, "11-personal-ledger-money-390x844");

  await page.goto("/");
  await expect(page.getByRole("link", { name: "GAME LEDGER" })).toBeVisible();
  await expect(page.getByRole("button", { name: "WIPE ALL MY TABLES" })).toHaveCount(0);

  await caseyPage.goto("/ledger");
  await expect(caseyPage.locator("[data-ledger-entry]").first()).toBeVisible();
  await expect(caseyPage.getByText("Prompt 5 table").first()).toBeVisible();

  await command(page, tableId, "startNewGame", {
    game: "POKER",
    savePersonalLedger: "false",
    startingJetonsPerPlayer: "100",
    participantUserIds: ids,
    stakeType: "CUSTOM",
    customUnitLabel: "Dinner",
    jetonsPerCustomUnit: "50",
  });
  await command(page, tableId, "saveGameSessionResults", {});
  await page.goto("/ledger");
  await shot(page, "12-personal-ledger-custom-390x844");

  await caseyContext.close();
});
