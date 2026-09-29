import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  expectPokerPhase,
  noHorizontalOverflow,
  openAs,
  openTableMenu,
  uniqueEmail,
} from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

type Snap = {
  tableId: string;
  viewerId: string;
  isOwner: boolean;
  isBank: boolean;
  game: string;
  phase: string;
  tableClosed?: boolean;
  members: {
    userId: string;
    name: string;
    isOwner: boolean;
    isBankDealer: boolean;
    available: { millis: string; label: string } | null;
  }[];
  setup?: { joinUrl: string | null; tableName: string; bankName: string; ownerName: string };
  bank?: { phase: string; tableName: string; isOwner: boolean };
  player?: {
    available: { label: string };
    boxes: { id: string; playerId: string; boxNumber: number; bet: { label: string } }[];
    isOwner?: boolean;
  };
  poker?: {
    phase: string;
    tableName: string;
    isOwner: boolean;
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
      isActor: boolean;
      available: { millis?: string; label: string };
      contribution: { millis?: string; label: string };
    }[];
    winners?: { userId: string; name: string; amount: { label: string } }[];
  };
};

async function tableSnapshot(page: Page): Promise<Snap> {
  return page.request
    .get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`)
    .then((response) => response.json()) as Promise<Snap>;
}

async function command(
  page: Page,
  tableId: string,
  commandName: string,
  extra: Record<string, string> = {},
) {
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

test("release candidate: three roles, Blackjack, Poker, save and reopen", async ({ page, context, browser }) => {
  test.setTimeout(240_000);
  await mkdir(out, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });

  const alexEmail = uniqueEmail("alex");
  const blairEmail = uniqueEmail("blair");
  const caseyEmail = uniqueEmail("casey");
  await openAs(context, page, alexEmail, "Alex");
  await createBlackjackTable(page, "FINAL TABLE", { starting: "100" });
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;

  await expect(page.locator("[data-table-name]")).toHaveCount(1);
  await expect(page.locator("[data-table-name]")).toHaveText("FINAL TABLE");
  await expect(page.getByRole("button", { name: "START BLACKJACK" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-release-setup-390x844.png") });
  await noHorizontalOverflow(page);

  await openTableMenu(page);
  await expect(page.getByRole("button", { name: "ASSIGN DEALER" })).toBeVisible();
  await expect(page.getByRole("button", { name: "RENAME TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "SAVE TABLE" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-release-owner-admin-390x844.png") });
  await page.keyboard.press("Escape");
  await expect(page.locator(".sheet.open")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();

  await page.getByRole("button", { name: "ADD PLAYER" }).first().click();
  await expect(page.getByLabel("Player name")).toBeVisible();
  await expect(page.getByLabel("Player email")).toBeVisible();
  await page.screenshot({ path: join(out, "app-release-invite-390x844.png") });
  await page.getByRole("button", { name: "Add local player" }).click();
  await expect(page.getByRole("dialog").getByText(/Enter a player name/i)).toBeVisible();
  await page.getByLabel("Player name").fill("Drew");
  await page.getByLabel("Starting jetons").fill("100");
  await page.getByRole("button", { name: "Add local player" }).click();
  await expect(page.getByText("Drew").first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "ADD PLAYER" }).first().click();
  await page.getByLabel("Player name").fill("Drew");
  await page.getByRole("button", { name: "Add local player" }).click();
  await expect(page.getByRole("dialog").getByText(/already at this table/i)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  const setup = await tableSnapshot(page);
  const drew = setup.members.find((member) => member.name === "Drew");
  expect(drew?.available?.label).toBe("100");
  const remove = await command(page, tableId, "removePlayer", { userId: drew!.userId });
  expect(remove.ok).toBe(true);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;
  expect(setup.setup!.joinUrl).toContain("/join/");

  const blairContext = await browser.newContext();
  const blairPage = await blairContext.newPage();
  await blairPage.setViewportSize({ width: 390, height: 844 });
  await openAs(blairContext, blairPage, blairEmail, "Blair");
  await blairPage.goto(joinPath);
  await expect(blairPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  const caseyContext = await browser.newContext();
  const caseyPage = await caseyContext.newPage();
  await caseyPage.setViewportSize({ width: 390, height: 844 });
  await openAs(caseyContext, caseyPage, caseyEmail, "Casey");
  await caseyPage.goto(joinPath);
  await expect(caseyPage.getByText(/Waiting for the Bank/i)).toBeVisible();
  await expect(caseyPage.getByText("100").first()).toBeVisible();

  await expect(page.getByText("Blair").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Casey").first()).toBeVisible();

  await openTableMenu(page);
  await page.getByRole("button", { name: "ASSIGN DEALER" }).click();
  await page.getByLabel("Dealer").selectOption({ label: "Blair" });
  await page.getByRole("button", { name: "Confirm dealer" }).click();
  await expect(page.getByText("DEALER · Blair")).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await blairPage.reload();
  await caseyPage.reload();
  const afterAssign = await tableSnapshot(page);
  const blairAssigned = await tableSnapshot(blairPage);
  const caseyAssigned = await tableSnapshot(caseyPage);
  expect(afterAssign.members.find((member) => member.isOwner)?.name).toBe("Alex");
  expect(afterAssign.members.find((member) => member.isBankDealer)?.name).toBe("Blair");
  expect(blairAssigned.isBank).toBe(true);
  expect(blairAssigned.isOwner).toBe(false);
  expect(caseyAssigned.isBank).toBe(false);
  expect(caseyAssigned.isOwner).toBe(false);
  expect(caseyAssigned.members.find((member) => member.name === "Casey")?.available?.label).toBe("100");
  expect(blairAssigned.members.find((member) => member.name === "Blair")?.available?.label).toBe("100");

  await expectRejected(blairPage, tableId, "switchGame", { game: "POKER" });
  await expectRejected(blairPage, tableId, "saveTable");
  await expectRejected(blairPage, tableId, "assignBank", { userId: afterAssign.viewerId });
  await expectRejected(blairPage, tableId, "updateSettings", { name: "Hijacked" });
  await expectRejected(caseyPage, tableId, "switchGame", { game: "POKER" });
  await expectRejected(caseyPage, tableId, "dealCards");
  await expectRejected(caseyPage, tableId, "giveJetons", { userId: caseyAssigned.viewerId, amount: "10" });

  await blairPage.getByRole("button", { name: "START BLACKJACK" }).click();
  await expect(blairPage.locator("[data-phase-heading]")).toHaveText("BETTING");
  await page.reload();
  await caseyPage.reload();
  await expect(blairPage.getByRole("button", { name: "CLOSE BETTING" })).toBeVisible();
  await expect(caseyPage.getByRole("button", { name: "CLOSE BETTING" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CLOSE BETTING" })).toHaveCount(0);

  await caseyPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await tableSnapshot(caseyPage)).player?.available.label).toBe("75");
  await caseyPage.screenshot({ path: join(out, "app-release-bj-player-betting-390x844.png") });
  await page.reload();
  await blairPage.reload();
  await caseyPage.reload();
  expect((await tableSnapshot(caseyPage)).phase).toBe("BETTING");
  expect((await tableSnapshot(caseyPage)).player?.available.label).toBe("75");

  const caseyBox = (await tableSnapshot(caseyPage)).player?.boxes[0];
  expect(caseyBox).toBeTruthy();

  await expect(blairPage.getByRole("button", { name: "CLOSE BETTING" })).toBeEnabled({ timeout: 15_000 });
  await blairPage.getByRole("button", { name: "CLOSE BETTING" }).click();
  await expect(blairPage.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await blairPage.screenshot({ path: join(out, "app-release-bj-dealer-playing-390x844.png") });
  await page.reload();
  await caseyPage.reload();
  expect((await tableSnapshot(page)).phase).toBe("PLAYING");
  expect((await tableSnapshot(caseyPage)).phase).toBe("PLAYING");
  await expect(caseyPage.getByRole("button", { name: "DOUBLE" })).toBeVisible();
  await expect(caseyPage.getByRole("button", { name: "DOUBLE" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "DOUBLE" })).toBeDisabled();
  await expectRejected(page, tableId, "doubleBox", { boxId: caseyBox!.id });
  await expectRejected(blairPage, tableId, "doubleBox", { boxId: caseyBox!.id });
  await expectRejected(page, tableId, "splitBox", { boxId: caseyBox!.id });
  await expectRejected(blairPage, tableId, "buyInsurance", { boxId: caseyBox!.id, amount: "10" });
  await expectRejected(page, tableId, "switchGame", { game: "POKER" });

  await blairPage.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(blairPage.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await blairPage.locator(`[data-box-id="${caseyBox!.id}"]`).getByRole("button", { name: "LOST" }).click();
  await expect(blairPage.getByRole("button", { name: "START NEXT ROUND" })).toBeEnabled({ timeout: 10_000 });
  await blairPage.getByRole("button", { name: "START NEXT ROUND" }).click();
  await expect(blairPage.locator("[data-phase-heading]")).toHaveText("BETTING");
  await page.reload();
  await caseyPage.reload();
  expect((await tableSnapshot(page)).phase).toBe("BETTING");
  expect((await tableSnapshot(caseyPage)).phase).toBe("BETTING");
  expect((await tableSnapshot(caseyPage)).player?.available.label).toBe("75");

  await openTableMenu(page);
  await page.getByRole("button", { name: "SWITCH GAME" }).click();
  await expect(page.getByRole("button", { name: "Texas Hold’em" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-release-game-change-390x844.png") });
  await page.getByRole("button", { name: "Cancel" }).click();
  expect((await tableSnapshot(page)).game).toBe("BLACKJACK");
  await openTableMenu(page);
  await page.getByRole("button", { name: "SWITCH GAME" }).click();
  await page.getByRole("button", { name: "Texas Hold’em" }).click();
  await page.getByRole("button", { name: "SWITCH TO TEXAS HOLD’EM" }).click();
  await expectPokerPhase(page, "POKER SETUP");
  await blairPage.reload();
  await caseyPage.reload();
  await expectPokerPhase(blairPage, "POKER SETUP");
  await expectPokerPhase(caseyPage, "POKER SETUP");
  expect((await tableSnapshot(page)).members.find((member) => member.isOwner)?.name).toBe("Alex");
  expect((await tableSnapshot(page)).members.find((member) => member.isBankDealer)?.name).toBe("Blair");
  expect((await tableSnapshot(caseyPage)).poker?.seats.find((seat) => seat.name === "Casey")?.available.label).toBe("75");

  const alexId = (await tableSnapshot(page)).viewerId;
  const blairId = (await tableSnapshot(blairPage)).viewerId;
  const caseyId = (await tableSnapshot(caseyPage)).viewerId;
  const funded = await command(page, tableId, "giveJetons", { userId: alexId, amount: "100" });
  expect(funded.ok).toBe(true);
  await page.getByRole("button", { name: "START HAND", exact: true }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  await blairPage.reload();
  await caseyPage.reload();
  const pokerStart = await tableSnapshot(page);
  expect(pokerStart.poker?.pot.label).toBe("15");
  expect(pokerStart.poker?.currentActorId).toBeTruthy();
  expect(pokerStart.poker?.seats.some((seat) => seat.isDealer)).toBe(true);
  expect(pokerStart.poker?.seats.some((seat) => seat.isSmallBlind)).toBe(true);
  expect(pokerStart.poker?.seats.some((seat) => seat.isBigBlind)).toBe(true);

  function actingPageFor(actorId: string | null) {
    if (actorId === blairId) return blairPage;
    if (actorId === caseyId) return caseyPage;
    return page;
  }

  const firstActor = actingPageFor(pokerStart.poker?.currentActorId ?? null);
  await expect(firstActor.getByRole("button", { name: "FOLD" })).toBeVisible();
  await firstActor.screenshot({ path: join(out, "app-release-poker-player-action-390x844.png") });
  await expect(page.getByRole("button", { name: "DEAL FLOP" })).toBeVisible();
  await expect(page.getByRole("button", { name: "DEAL FLOP" })).toBeDisabled();
  await page.screenshot({ path: join(out, "app-release-poker-dealer-street-390x844.png") });
  await expect(caseyPage.getByRole("button", { name: "DEAL FLOP" })).toHaveCount(0);
  await expect(blairPage.getByRole("button", { name: "START HAND", exact: true })).toHaveCount(0);

  const before = tableStack(pokerStart);
  for (let step = 0; step < 6; step += 1) {
    const live = await tableSnapshot(page);
    if (live.poker?.phase === "HAND_COMPLETE") break;
    const actorId = live.poker?.currentActorId;
    const acting = actingPageFor(actorId);
    await expect(acting.getByRole("button", { name: "FOLD" })).toBeVisible();
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
  const firstDealer = complete.poker?.seats.find((seat) => seat.isDealer)?.userId;
  await page.getByRole("button", { name: "NEXT HAND", exact: true }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  const nextHand = await tableSnapshot(page);
  expect(nextHand.poker?.seats.find((seat) => seat.isDealer)?.userId).not.toBe(firstDealer);
  expect(tableStack(nextHand)).toBe(before);
  for (let step = 0; step < 6; step += 1) {
    const live = await tableSnapshot(page);
    if (live.poker?.phase === "HAND_COMPLETE") break;
    const actorId = live.poker?.currentActorId;
    const acting = actingPageFor(actorId);
    await expect(acting.getByRole("button", { name: "FOLD" })).toBeVisible();
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
  await expect(page.getByText("FINAL TABLE")).toBeVisible();
  await expect(page.getByRole("button", { name: "RESUME" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-release-home-saved-390x844.png") });
  await page.getByRole("button", { name: "RESUME" }).click();
  await expectPokerPhase(page, "HAND COMPLETE");
  await expect(page.locator("[data-table-name]")).toHaveText("FINAL TABLE");
  await blairPage.reload();
  await caseyPage.reload();
  expect((await tableSnapshot(page)).members.find((member) => member.isBankDealer)?.name).toBe("Blair");
  expect((await tableSnapshot(page)).members.find((member) => member.isOwner)?.name).toBe("Alex");
  await page.screenshot({ path: join(out, "app-release-reopened-390x844.png") });
  await noHorizontalOverflow(page);
  await noHorizontalOverflow(caseyPage);

  await blairContext.close();
  await caseyContext.close();
});
