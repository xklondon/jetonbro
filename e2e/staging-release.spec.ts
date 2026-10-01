import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expectPokerPhase, expectPlayerPayoutIdle, noHorizontalOverflow, openTableMenu, addLocalPlayerFromMenu } from "./helpers";
import { currentMailId, requestStagingMagicLink, waitForStagingMagicLink } from "./staging-login";

const origin = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ?? "";
const out = join(process.cwd(), "docs", "screenshots", "classic");
const prod = join(process.cwd(), "docs", "screenshots", "production");

test.skip(!origin.includes("railway.app"), "staging-only: set PLAYWRIGHT_BASE_URL to the JetBro II Railway origin");

type Snap = {
  tableId: string;
  viewerId: string;
  isOwner: boolean;
  isBank: boolean;
  game: string;
  phase: string;
  members: {
    userId: string;
    name: string;
    isOwner: boolean;
    isBankDealer: boolean;
    available: { millis: string; label: string } | null;
  }[];
  setup?: { joinUrl: string | null; tableName: string; bankName: string; ownerName: string };
  player?: {
    available: { label: string };
    boxes: { id: string; playerId: string; boxNumber: number; bet: { label: string } }[];
  };
  poker?: {
    phase: string;
    tableName: string;
    pot: { label: string };
    toCall: { label: string };
    currentActorId: string | null;
    legalActions: { type: string; label: string }[];
    seats: {
      userId: string;
      name: string;
      isDealer: boolean;
      isSmallBlind: boolean;
      isBigBlind: boolean;
      available: { label: string };
      contribution: { label: string };
    }[];
    winners?: { userId: string; amount: { label: string } }[];
  };
};

async function signIn(page: Page, email: string) {
  const previous = currentMailId();
  await requestStagingMagicLink(email);
  const { url } = await waitForStagingMagicLink(previous);
  expect(url.startsWith(origin)).toBe(true);
  expect(url).not.toMatch(/localhost|127\.0\.0\.1/i);
  await page.goto(url);
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 20_000 });
}

async function tableSnapshot(page: Page): Promise<Snap> {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<Snap>;
}

async function command(page: Page, tableId: string, commandName: string, extra: Record<string, string> = {}) {
  const response = await page.request.post(`/api/tables/${tableId}/commands`, {
    data: { command: commandName, idempotencyKey: crypto.randomUUID(), ...extra },
  });
  return { ok: response.ok(), status: response.status(), body: await response.json().catch(() => ({})) };
}

async function expectRejected(page: Page, tableId: string, commandName: string, extra: Record<string, string> = {}) {
  const result = await command(page, tableId, commandName, extra);
  expect(result.ok, `${commandName} should be rejected`).toBe(false);
  expect(result.status).toBeGreaterThanOrEqual(400);
}

function tableStack(snap: Snap): number {
  const available = snap.members.reduce((sum, member) => sum + Number(member.available?.label ?? 0), 0);
  if (snap.poker?.phase === "HAND_COMPLETE") return available;
  return available + (snap.poker?.seats ?? []).reduce((sum, seat) => sum + Number(seat.contribution.label), 0);
}

test("staging release: three roles, Blackjack, Poker, save and resume", async ({ page, context, browser }) => {
  test.setTimeout(420_000);
  await mkdir(out, { recursive: true });
  await mkdir(prod, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });

  const stamp = Date.now();
  const tableName = `RC-STAGING-${stamp}`;
  const alexEmail = `Alex.rc${stamp}@jetonbro.test`;
  const blairEmail = `Blair.rc${stamp}@jetonbro.test`;
  const caseyEmail = `Casey.rc${stamp}@jetonbro.test`;

  await signIn(page, alexEmail);
  await expect(page.getByRole("button", { name: "CREATE TABLE" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-staging-home-390x844.png") });
  await page.screenshot({ path: join(prod, "01-home-390x844.png") });

  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await expect(page).toHaveURL(/\/tables\/(?!new(?:\?|$))/);
  await page.getByLabel("Table name").fill(tableName);
  await page.getByLabel("Starting jetons per player").fill("100");
  if (await page.getByLabel("Owner / host name").count()) {
    await page.getByLabel("Owner / host name").fill("Alex");
  }
  await page.screenshot({ path: join(out, "app-staging-create-390x844.png") });
  await page.screenshot({ path: join(prod, "02-create-table-390x844.png") });
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page).toHaveURL(/\/tables\/(?!new(?:\?|$))/);
  await expect(page.locator("[data-phase-heading]")).toHaveText("WAITING FOR PLAYERS");
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;
  await expect(page.locator("[data-table-name]")).toHaveCount(1);
  await expect(page.locator("[data-table-name]")).toHaveText(tableName);
  await page.screenshot({ path: join(out, "app-staging-setup-390x844.png") });
  await page.screenshot({ path: join(prod, "03-phase0-waiting-390x844.png") });
  await noHorizontalOverflow(page);

  await addLocalPlayerFromMenu(page, "Drew");
  await expect(page.getByText("Drew").first()).toBeVisible({ timeout: 15_000 });
  const drew = (await tableSnapshot(page)).members.find((member) => member.name === "Drew");
  expect(drew?.available?.label).toBe("100");
  const remove = await command(page, tableId, "removePlayer", { userId: drew!.userId });
  expect(remove.ok).toBe(true);

  const setup = await tableSnapshot(page);
  expect(setup.setup!.joinUrl).toContain(`${origin}/join/`);
  expect(setup.setup!.joinUrl).not.toMatch(/localhost|127\.0\.0\.1|railway\.internal/i);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;

  const blairContext = await browser.newContext();
  const blairPage = await blairContext.newPage();
  await blairPage.setViewportSize({ width: 390, height: 844 });
  await signIn(blairPage, blairEmail);
  await blairPage.goto(joinPath);
  await expect(blairPage.getByText(/Waiting for the Bank|WAITING FOR PLAYERS|TABLE SETUP|POKER/i).first()).toBeVisible({ timeout: 20_000 });

  const caseyContext = await browser.newContext();
  const caseyPage = await caseyContext.newPage();
  await caseyPage.setViewportSize({ width: 390, height: 844 });
  await signIn(caseyPage, caseyEmail);
  await caseyPage.goto(joinPath);
  await expect(caseyPage.getByText("100").first()).toBeVisible({ timeout: 20_000 });

  await expect(page.getByText(/Blair/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Casey/i).first()).toBeVisible();
  if (await page.locator(".sheet.open").count()) {
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.locator(".sheet.open")).toHaveCount(0);
  }
  await page.screenshot({ path: join(prod, "04-phase0-joined-390x844.png") });

  await page.reload();
  await blairPage.reload();
  await caseyPage.reload();
  expect((await tableSnapshot(caseyPage)).members.find((member) => member.name.toLowerCase().includes("casey"))?.available?.label).toBe("100");
  expect((await tableSnapshot(caseyPage)).members.filter((member) => member.name.toLowerCase().includes("casey"))).toHaveLength(1);

  await openTableMenu(page);
  await page.getByRole("button", { name: "ASSIGN DEALER" }).click();
  const dealerLabels = await page.getByLabel("Dealer").locator("option").allTextContents();
  const blairLabel = dealerLabels.find((label) => /Blair/i.test(label));
  expect(blairLabel, "Blair should be a dealer candidate").toBeTruthy();
  await page.getByLabel("Dealer").selectOption({ label: blairLabel! });
  await page.getByRole("button", { name: "Confirm dealer" }).click();
  await expect(page.getByText(/DEALER · Blair/i)).toBeVisible({ timeout: 15_000 });

  const afterAssign = await tableSnapshot(page);
  expect(afterAssign.members.find((member) => member.isOwner)?.name).toMatch(/Alex/i);
  expect(afterAssign.members.find((member) => member.isBankDealer)?.name).toMatch(/Blair/i);
  await expectRejected(blairPage, tableId, "switchGame", { game: "POKER" });
  await expectRejected(blairPage, tableId, "saveTable");
  await expectRejected(blairPage, tableId, "assignBank", { userId: afterAssign.viewerId });
  await expectRejected(caseyPage, tableId, "dealCards");
  await expectRejected(caseyPage, tableId, "giveJetons", { userId: (await tableSnapshot(caseyPage)).viewerId, amount: "10" });

  await blairPage.getByRole("button", { name: "OPEN BETTING" }).click();
  await expect(blairPage.locator("[data-phase-heading]")).toHaveText("BETTING");
  await blairPage.screenshot({ path: join(prod, "09-bj-dealer-betting-390x844.png") });
  await caseyPage.reload();
  await expect(caseyPage.getByRole("button", { name: "CLOSE BETTING" })).toHaveCount(0);

  await caseyPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await tableSnapshot(caseyPage)).player?.available.label).toBe("75");
  await expect(caseyPage.locator("[data-player-wallet] .wallet-available strong")).toHaveText("75", { timeout: 10_000 });
  await expect(caseyPage.getByText("MAIN").first()).toBeVisible();
  await expect(caseyPage.locator(".felt").getByText("25", { exact: true }).first()).toBeVisible();
  await caseyPage.screenshot({ path: join(out, "app-staging-bj-player-betting-390x844.png") });
  await caseyPage.screenshot({ path: join(prod, "05-bj-player-betting-390x844.png") });
  await caseyPage.reload();
  expect((await tableSnapshot(caseyPage)).player?.available.label).toBe("75");
  await expect(caseyPage.locator("[data-player-wallet] .wallet-available strong")).toHaveText("75");

  const caseyBox = (await tableSnapshot(caseyPage)).player?.boxes[0];
  expect(caseyBox?.bet.label).toBe("25");

  await blairPage.getByRole("button", { name: "CLOSE BETTING" }).click();
  await expect(blairPage.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await blairPage.screenshot({ path: join(out, "app-staging-bj-dealer-playing-390x844.png") });
  await caseyPage.reload();
  await expect(caseyPage.getByRole("button", { name: "DOUBLE" })).toBeVisible();
  await expect(caseyPage.getByRole("button", { name: "INSURANCE", exact: true })).toHaveCount(0);
  await caseyPage.screenshot({ path: join(prod, "06-bj-player-playing-390x844.png") });
  await blairPage.getByRole("button", { name: "Open Insurance" }).click();
  await expect(blairPage.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await caseyPage.reload();
  await expect(caseyPage.getByRole("button", { name: "PLACE INSURANCE" })).toBeVisible();
  await caseyPage.screenshot({ path: join(prod, "07-bj-player-insurance-390x844.png") });
  await blairPage.getByRole("button", { name: "Close Insurance" }).click();
  await expectRejected(page, tableId, "doubleBox", { boxId: caseyBox!.id });
  await expectRejected(blairPage, tableId, "doubleBox", { boxId: caseyBox!.id });
  await expectRejected(page, tableId, "switchGame", { game: "POKER" });

  await blairPage.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(blairPage.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await blairPage.screenshot({ path: join(out, "app-staging-bj-payout-390x844.png") });
  await blairPage.screenshot({ path: join(prod, "10-bj-dealer-payout-390x844.png") });
  await caseyPage.reload();
  await expectPlayerPayoutIdle(caseyPage);
  await blairPage.locator(`[data-box-id="${caseyBox!.id}"]`).getByRole("button", { name: "LOST" }).click();
  await caseyPage.reload();
  await expectPlayerPayoutIdle(caseyPage);
  await expect(caseyPage.getByText("Lost").first()).toBeVisible();
  await caseyPage.screenshot({ path: join(prod, "08-bj-player-payout-390x844.png") });
  await blairPage.getByRole("button", { name: "START NEXT ROUND" }).click();
  await expect(blairPage.locator("[data-phase-heading]")).toHaveText("BETTING");
  expect((await tableSnapshot(caseyPage)).player?.available.label).toBe("75");

  await openTableMenu(page);
  await page.getByRole("button", { name: "SWITCH GAME" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  expect((await tableSnapshot(page)).game).toBe("BLACKJACK");
  await openTableMenu(page);
  await page.getByRole("button", { name: "SWITCH GAME" }).click();
  await page.getByRole("button", { name: "Texas Hold’em" }).click();
  await page.getByRole("button", { name: "SWITCH TO TEXAS HOLD’EM" }).click();
  await expectPokerPhase(page, "POKER SETUP");
  await blairPage.reload();
  await caseyPage.reload();
  expect((await tableSnapshot(page)).members.find((member) => member.isBankDealer)?.name).toMatch(/Blair/i);

  const alexId = (await tableSnapshot(page)).viewerId;
  await command(page, tableId, "giveJetons", { userId: alexId, amount: "100" });
  await page.getByRole("button", { name: "START HAND", exact: true }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  await blairPage.reload();
  await caseyPage.reload();
  const blairId = (await tableSnapshot(blairPage)).viewerId;
  const caseyId = (await tableSnapshot(caseyPage)).viewerId;
  function actingPageFor(actorId: string | null) {
    if (actorId === blairId) return blairPage;
    if (actorId === caseyId) return caseyPage;
    return page;
  }
  const pokerStart = await tableSnapshot(page);
  expect(pokerStart.poker?.pot.label).toBe("15");
  const firstActor = actingPageFor(pokerStart.poker?.currentActorId ?? null);
  await expect(firstActor.getByRole("button", { name: "FOLD" })).toBeVisible();
  await expect(firstActor.getByText("YOUR TURN").first()).toBeVisible();
  await firstActor.screenshot({ path: join(out, "app-staging-poker-player-action-390x844.png") });
  await firstActor.screenshot({ path: join(prod, "11-poker-player-action-390x844.png") });
  await expect(page.getByRole("button", { name: "DEAL FLOP" })).toBeDisabled();
  await page.screenshot({ path: join(out, "app-staging-poker-dealer-street-390x844.png") });
  await page.screenshot({ path: join(prod, "12-poker-dealer-street-390x844.png") });
  await expect(caseyPage.getByRole("button", { name: "DEAL FLOP" })).toHaveCount(0);
  expect(pokerStart.poker?.legalActions.some((action) => action.label === "CALL 0")).toBeFalsy();

  const before = tableStack(pokerStart);
  for (let step = 0; step < 6; step += 1) {
    const live = await tableSnapshot(page);
    if (live.poker?.phase === "HAND_COMPLETE") break;
    const actorId = live.poker?.currentActorId;
    const acting = actingPageFor(actorId);
    await expect(acting.getByRole("button", { name: "FOLD" })).toBeVisible({ timeout: 15_000 });
    await acting.getByRole("button", { name: "FOLD" }).click();
    await expect.poll(async () => {
      const next = await tableSnapshot(page);
      return next.poker?.phase === "HAND_COMPLETE" || next.poker?.currentActorId !== actorId;
    }).toBe(true);
  }
  await expect.poll(async () => (await tableSnapshot(page)).poker?.phase).toBe("HAND_COMPLETE");
  const complete = await tableSnapshot(page);
  expect(complete.poker?.winners?.length).toBe(1);
  expect(tableStack(complete)).toBe(before);
  await expect(page.getByText("POT PAID")).toBeVisible();
  await expect(page.getByText(/TO CALL/i)).toHaveCount(0);
  await page.screenshot({ path: join(out, "app-staging-poker-hand-complete-390x844.png") });
  await page.screenshot({ path: join(prod, "13-poker-hand-complete-390x844.png") });
  const firstDealer = complete.poker?.seats.find((seat) => seat.isDealer)?.userId;
  await page.getByRole("button", { name: "NEXT HAND", exact: true }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  await blairPage.reload();
  await caseyPage.reload();
  expect((await tableSnapshot(page)).poker?.seats.find((seat) => seat.isDealer)?.userId).not.toBe(firstDealer);
  expect(tableStack(await tableSnapshot(page))).toBe(before);
  for (let step = 0; step < 6; step += 1) {
    const live = await tableSnapshot(page);
    if (live.poker?.phase === "HAND_COMPLETE") break;
    const actorId = live.poker?.currentActorId;
    const acting = actingPageFor(actorId);
    await expect(acting.getByRole("button", { name: "FOLD" })).toBeVisible({ timeout: 15_000 });
    await acting.getByRole("button", { name: "FOLD" }).click();
    await expect.poll(async () => {
      const next = await tableSnapshot(page);
      return next.poker?.phase === "HAND_COMPLETE" || next.poker?.currentActorId !== actorId;
    }).toBe(true);
  }
  await expect.poll(async () => (await tableSnapshot(page)).poker?.phase).toBe("HAND_COMPLETE");
  expect(tableStack(await tableSnapshot(page))).toBe(before);

  await openTableMenu(page);
  await page.getByRole("button", { name: "SAVE TABLE" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(tableName)).toBeVisible();
  await expect(page.getByRole("button", { name: "RESUME" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-staging-home-saved-390x844.png") });
  await page.screenshot({ path: join(prod, "14-save-resume-home-390x844.png") });
  await page.getByRole("button", { name: "RESUME" }).click();
  await expectPokerPhase(page, "HAND COMPLETE");
  await expect(page.locator("[data-table-name]")).toHaveText(tableName);
  await blairPage.reload();
  await caseyPage.reload();
  expect((await tableSnapshot(page)).members.find((member) => member.isBankDealer)?.name).toMatch(/Blair/i);
  expect((await tableSnapshot(page)).members.find((member) => member.isOwner)?.name).toMatch(/Alex/i);
  await page.screenshot({ path: join(out, "app-staging-reopened-390x844.png") });
  await noHorizontalOverflow(page);

  await openTableMenu(page);
  await page.getByRole("button", { name: "CLOSE TABLE & SAVE BALANCES" }).click();
  await expect(page.getByRole("button", { name: "Confirm close" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm close" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await expect(page.getByText("Closed · balances saved")).toBeVisible({ timeout: 20_000 });
  const card = page.locator("[data-table-id]").filter({ hasText: tableName }).first();
  await expect(card).toHaveAttribute("data-closed", "true");
  await card.getByRole("button", { name: "Table menu" }).click();
  await page.getByRole("button", { name: "DELETE" }).click();
  await expect(page.getByText("Closed table removal. Ledger and rounds are kept.")).toBeVisible();
  await page.screenshot({ path: join(prod, "15-owner-delete-confirm-390x844.png") });
  await expectRejected(caseyPage, tableId, "deleteTable");
  await page.getByRole("button", { name: "Confirm" }).click();

  await blairContext.close();
  await caseyContext.close();
});
