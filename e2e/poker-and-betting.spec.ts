import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, expectPokerPhase, openAs, setupJoinUrl, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

type Snap = {
  viewerId: string;
  game?: string;
  bank?: unknown;
  poker?: {
    phase: string;
    phaseLabel?: string;
    headline?: string;
    waitingCopy?: string | null;
    currentActorId: string | null;
    canDealStreet?: boolean;
    canReorderSeats?: boolean;
    canNextHand?: boolean;
    nextHandDeadlineAt?: string | null;
    seats: { userId: string; name: string; toCall?: { millis: string }; isActor?: boolean }[];
    pots: { index: number; eligiblePlayerIds: string[]; amount?: { label: string } }[];
  };
  members: { userId: string; name: string; isOwner?: boolean; available: { label: string } | null }[];
  setup?: { joinUrl: string | null; members?: { userId: string; isOwner?: boolean }[] };
};

async function tableSnapshot(page: Page): Promise<Snap> {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<Snap>;
}

async function command(page: Page, tableId: string, commandName: string, extra: Record<string, string> = {}) {
  const response = await page.request.post(`/api/tables/${tableId}/commands`, {
    data: { command: commandName, idempotencyKey: crypto.randomUUID(), ...extra },
  });
  if (!response.ok()) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`${commandName} failed: ${JSON.stringify(body)}`);
  }
}

async function threeSeated(page: Page, context: BrowserContext, browser: Browser) {
  const ownerEmail = uniqueEmail("poker-bank");
  const samEmail = uniqueEmail("poker-sam");
  const joEmail = uniqueEmail("poker-jo");
  await openAs(context, page, ownerEmail, "Owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await createBlackjackTable(page, "Hold em table", { starting: "100" });
  const setupSnap = await tableSnapshot(page);
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await samPage.setViewportSize({ width: 390, height: 844 });
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await joPage.setViewportSize({ width: 390, height: 844 });
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(joinPath);

  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  const ownerId = setupSnap.setup?.members?.find((member) => member.isOwner)?.userId ?? setupSnap.viewerId;
  await command(page, tableId, "giveJetons", { userId: ownerId, amount: "100" });
  return { tableId, samContext, samPage, joContext, joPage, ownerId };
}

function pageFor(owner: Page, sam: Page, jo: Page, seats: { userId: string; name: string }[], actorId: string | null) {
  const name = seats.find((seat) => seat.userId === actorId)?.name;
  if (name === "Sam") return sam;
  if (name === "Jo") return jo;
  return owner;
}

async function shot(page: Page, name: string) {
  await mkdir(out, { recursive: true });
  await page.screenshot({ path: join(out, name), fullPage: true });
}

test("Blackjack waits for the first bet, then switches to Hold’em with the same Players", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const { tableId, samContext, samPage, joContext, joPage } = await threeSeated(page, context, browser);
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await expect(page.getByText("WAITING FOR THE FIRST BET")).toBeVisible();
  await expect(page.locator("[data-table-name]").first()).toHaveText("Hold em table");
  await expect(page.locator("body")).not.toContainText("xklondon");
  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeDisabled();
  await expect(page.getByText("OPEN BANK")).toBeVisible();
  await expect(page.getByText("LIMITED BANK")).toBeVisible();
  await shot(page, "app-blackjack-waiting-first-bet-390x844.png");
  await shot(page, "app-blackjack-dealer-betting-390x844.png");

  const before = await tableSnapshot(page);
  await page.getByRole("button", { name: "SWITCH GAME" }).click();
  await expect(page.getByRole("button", { name: "Zilch — Coming later" })).toBeDisabled();
  await page.getByRole("button", { name: "Texas Hold’em" }).click();
  await shot(page, "app-poker-setup-sheet-390x844.png");
  await page.getByRole("button", { name: "SWITCH TO TEXAS HOLD’EM" }).click();
  await expect(page.getByText("POKER SETUP", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-table-name]").first()).toHaveText("Hold em table");
  await page.getByRole("button", { name: "DEAL CARDS", exact: true }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  await shot(page, "app-poker-dealer-preflop-390x844.png");
  await samPage.reload();
  await expect(samPage.getByText(/Waiting for/i).first()).toBeVisible();
  await shot(samPage, "app-poker-player-preflop-390x844.png");
  const after = await tableSnapshot(page);
  expect(after.poker?.phase).toBe("PRE_FLOP");
  expect(after.bank).toBeFalsy();
  expect(after.members.map((member) => member.name).sort()).toEqual(before.members.map((member) => member.name).sort());

  for (let i = 0; i < 8; i += 1) {
    const snap = await tableSnapshot(page);
    if (snap.poker?.phase === "HAND_COMPLETE") break;
    if (!snap.poker?.currentActorId) break;
    const actor = pageFor(page, samPage, joPage, snap.poker.seats, snap.poker.currentActorId);
    await command(actor, tableId, "pokerAct", { type: "FOLD" });
  }
  await page.reload();
  await expect(page.getByText("HAND COMPLETE", { exact: true })).toBeVisible({ timeout: 15_000 });
  await shot(page, "app-poker-dealer-complete-390x844.png");
  await samPage.reload();
  await shot(samPage, "app-poker-player-complete-390x844.png");
  const firstDealer = after.poker?.seats.find((seat) => seat.userId === after.poker?.seats.find((item) => item.name)?.userId);
  void firstDealer;
  await command(page, tableId, "startNextPokerHand");
  await page.reload();
  await samPage.reload();
  await expectPokerPhase(page, "PRE-FLOP");
  await shot(page, "app-poker-dealer-next-hand-390x844.png");
  await shot(samPage, "app-poker-player-next-hand-390x844.png");
  await samContext.close();
  await joContext.close();
});

test("three-player showdown split pot and street screenshots", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const { tableId, samContext, samPage, joContext, joPage } = await threeSeated(page, context, browser);
  await command(page, tableId, "startBetting");
  await command(page, tableId, "switchGame", { game: "POKER" });
  await page.reload();
  await samPage.reload();
  await expect(page.getByText("POKER SETUP", { exact: true })).toBeVisible();
  await shot(page, "app-poker-dealer-setup-390x844.png");
  await shot(samPage, "app-poker-player-setup-390x844.png");
  await command(page, tableId, "startTexasHoldem", { smallBlind: "5", bigBlind: "10" });
  await page.reload();
  await expectPokerPhase(page, "PRE-FLOP");

  async function completeStreet() {
    for (let i = 0; i < 8; i += 1) {
      const snap = await tableSnapshot(page);
      if (snap.poker?.canDealStreet || snap.poker?.phase === "SHOWDOWN" || snap.poker?.phase === "HAND_COMPLETE") return snap;
      if (!snap.poker?.currentActorId) return snap;
      const actor = pageFor(page, samPage, joPage, snap.poker.seats, snap.poker.currentActorId);
      const owed = snap.poker.seats.find((seat) => seat.userId === snap.poker?.currentActorId)?.toCall?.millis;
      await command(actor, tableId, "pokerAct", { type: owed && owed !== "0" ? "CALL" : "CHECK" });
    }
    return tableSnapshot(page);
  }

  await completeStreet();
  await command(page, tableId, "advancePokerStreet");
  await page.reload();
  await samPage.reload();
  await expectPokerPhase(page, "FLOP");
  await shot(page, "app-poker-dealer-flop-390x844.png");
  await shot(samPage, "app-poker-player-flop-390x844.png");
  await completeStreet();
  await command(page, tableId, "advancePokerStreet");
  await page.reload();
  await samPage.reload();
  await expectPokerPhase(page, "TURN");
  await shot(page, "app-poker-dealer-turn-390x844.png");
  await shot(samPage, "app-poker-player-turn-390x844.png");
  await completeStreet();
  await command(page, tableId, "advancePokerStreet");
  await page.reload();
  await samPage.reload();
  await expectPokerPhase(page, "RIVER");
  await shot(page, "app-poker-dealer-river-390x844.png");
  await shot(samPage, "app-poker-player-river-390x844.png");
  await completeStreet();
  await command(page, tableId, "advancePokerStreet");
  await page.reload();
  await samPage.reload();
  await expectPokerPhase(page, "SHOWDOWN");
  await shot(page, "app-poker-dealer-showdown-390x844.png");
  await shot(samPage, "app-poker-player-showdown-390x844.png");

  const showdown = await tableSnapshot(page);
  const samId = showdown.poker?.seats.find((seat) => seat.name === "Sam")?.userId;
  const joId = showdown.poker?.seats.find((seat) => seat.name === "Jo")?.userId;
  await command(page, tableId, "awardPokerPots", {
    pots: JSON.stringify((showdown.poker?.pots ?? []).map((pot) => ({ index: pot.index, winnerIds: [samId, joId].filter(Boolean) }))),
  });
  await page.reload();
  await samPage.reload();
  await expect(page.getByText("HAND COMPLETE", { exact: true })).toBeVisible();
  await shot(page, "app-poker-dealer-awarded-390x844.png");
  await shot(samPage, "app-poker-player-awarded-390x844.png");
  await samContext.close();
  await joContext.close();
});

async function seatedDirectPoker(
  page: Page,
  context: BrowserContext,
  browser: Browser,
  stacks: { owner: string; sam: string; jo: string } = { owner: "100", sam: "100", jo: "100" },
) {
  const ownerEmail = uniqueEmail("poker-direct");
  const samEmail = uniqueEmail("poker-direct-sam");
  const joEmail = uniqueEmail("poker-direct-jo");
  await openAs(context, page, ownerEmail, "Owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /CREATE (A|NEW) TABLE/ }).click();
  await page.getByRole("button", { name: /Texas Hold/ }).click();
  await page.locator(".setup-mask").getByLabel("Table name").fill("Direct Hold em");
  await page.locator(".setup-mask").getByLabel("Starting jetons per player").fill("0");
  const joinUrl = await setupJoinUrl(page);
  await shot(page, "app-poker-create-table-390x844.png");
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page.getByText("POKER SETUP", { exact: true })).toBeVisible();
  const joinPath = new URL(joinUrl!).pathname;
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await samPage.setViewportSize({ width: 390, height: 844 });
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await joPage.setViewportSize({ width: 390, height: 844 });
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(joinPath);

  await expect(page.getByText("Sam", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Jo", { exact: true })).toBeVisible();
  await page.reload();
  const snap = await tableSnapshot(page);
  const ownerId = snap.viewerId;
  await command(page, tableId, "giveJetons", { userId: ownerId, amount: stacks.owner });
  const samId = snap.members.find((member) => member.name === "Sam")?.userId;
  const joId = snap.members.find((member) => member.name === "Jo")?.userId;
  if (samId) await command(page, tableId, "giveJetons", { userId: samId, amount: stacks.sam });
  if (joId) await command(page, tableId, "giveJetons", { userId: joId, amount: stacks.jo });
  return { tableId, samContext, samPage, joContext, joPage, ownerId, samId, joId };
}

test("direct Poker creation, seat reorder, actor highlight, side pots, and next-hand countdown", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const { tableId, samContext, samPage, joContext, joPage, ownerId, samId, joId } = await seatedDirectPoker(
    page,
    context,
    browser,
  );
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toHaveCount(0);
  await expect(page.getByText("Texas Hold’em · POKER SETUP")).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "SEAT ORDER" }).click();
  if (joId && samId) {
    await command(page, tableId, "configurePoker", { seatOrder: `${joId},${ownerId},${samId}` });
  }
  await page.reload();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "SEAT ORDER" }).click();
  await expect(page.getByText("1. Jo")).toBeVisible();
  await expect(page.getByText("2. Owner")).toBeVisible();
  await expect(page.getByText("3. Sam")).toBeVisible();
  await shot(page, "app-poker-reordered-seats-390x844.png");

  await command(page, tableId, "startTexasHoldem", { smallBlind: "5", bigBlind: "10" });
  await page.reload();
  await samPage.reload();
  await expectPokerPhase(page, "PRE-FLOP");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("button", { name: "SEAT ORDER" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();
  const turn = await tableSnapshot(page);
  expect(turn.headline).toBe("Texas Hold’em · PRE-FLOP");
  expect(turn.poker?.seats.some((seat) => seat.isActor)).toBe(true);
  const actorPage = pageFor(page, samPage, joPage, turn.poker!.seats, turn.poker!.currentActorId);
  await actorPage.reload();
  await expect(actorPage.getByText("YOUR TURN").first()).toBeVisible();
  const waiter = actorPage === page ? samPage : page;
  await waiter.reload();
  await expect(waiter.getByText(/Waiting for /i).first()).toBeVisible();
  await shot(actorPage, "app-poker-your-turn-390x844.png");

  for (let i = 0; i < 8; i += 1) {
    const snap = await tableSnapshot(page);
    if (snap.poker?.phase === "HAND_COMPLETE") break;
    if (!snap.poker?.currentActorId) break;
    const actor = pageFor(page, samPage, joPage, snap.poker.seats, snap.poker.currentActorId);
    await command(actor, tableId, "pokerAct", { type: "FOLD" });
  }
  await page.reload();
  await expect(page.getByText("HAND COMPLETE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "NEXT HAND IN 7 SECONDS" }).click();
  await expect(page.locator(".deal-countdown")).toBeVisible();
  await shot(page, "app-poker-next-hand-countdown-390x844.png");
  await command(page, tableId, "startNextPokerHand");
  await page.reload();
  await expectPokerPhase(page, "PRE-FLOP");
  await samContext.close();
  await joContext.close();
});

test("browser All-In side-pot settlement conserves balances", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const { tableId, samContext, samPage, joContext, joPage, ownerId, samId, joId } = await seatedDirectPoker(
    page,
    context,
    browser,
    { owner: "100", sam: "15", jo: "100" },
  );
  if (!samId || !joId) throw new Error("missing players");
  await command(page, tableId, "startTexasHoldem", {
    smallBlind: "5",
    bigBlind: "10",
    seatOrder: `${ownerId},${samId},${joId}`,
  });
  await page.reload();
  await command(page, tableId, "pokerAct", { type: "RAISE", amount: "20" });
  await command(samPage, tableId, "pokerAct", { type: "ALL_IN" });
  await command(joPage, tableId, "pokerAct", { type: "CALL" });
  await page.reload();
  await expect(page.getByText("Main pot")).toBeVisible();
  await expect(page.getByText(/Side pot 1/)).toBeVisible();
  await shot(page, "app-poker-side-pots-390x844.png");
  const pots = (await tableSnapshot(page)).poker?.pots ?? [];
  expect(pots).toHaveLength(2);
  expect(pots[1]?.eligiblePlayerIds).not.toContain(samId);

  async function checkStreet() {
    for (let i = 0; i < 8; i += 1) {
      const snap = await tableSnapshot(page);
      if (snap.poker?.canDealStreet || snap.poker?.phase === "SHOWDOWN" || snap.poker?.phase === "HAND_COMPLETE") {
        return snap;
      }
      if (!snap.poker?.currentActorId) return snap;
      const actor = pageFor(page, samPage, joPage, snap.poker.seats, snap.poker.currentActorId);
      await command(actor, tableId, "pokerAct", { type: "CHECK" });
    }
    return tableSnapshot(page);
  }
  await checkStreet();
  await command(page, tableId, "advancePokerStreet");
  await checkStreet();
  await command(page, tableId, "advancePokerStreet");
  await checkStreet();
  await command(page, tableId, "advancePokerStreet");
  await checkStreet();
  await command(page, tableId, "advancePokerStreet");
  await page.reload();
  await expectPokerPhase(page, "SHOWDOWN");
  await command(page, tableId, "awardPokerPots", {
    pots: JSON.stringify([
      { index: 0, winnerIds: [samId] },
      { index: 1, winnerIds: [ownerId] },
    ]),
  });
  await command(page, tableId, "awardPokerPots", {
    pots: JSON.stringify([
      { index: 0, winnerIds: [samId] },
      { index: 1, winnerIds: [ownerId] },
    ]),
  });
  await page.reload();
  await expect(page.getByText("HAND COMPLETE", { exact: true })).toBeVisible();
  const done = await tableSnapshot(page);
  expect(done.poker?.phase).toBe("HAND_COMPLETE");
  const samAfter = done.members.find((member) => member.userId === samId)?.available?.label;
  expect(Number(samAfter ?? "0")).toBeGreaterThan(0);
  await samContext.close();
  await joContext.close();
});

