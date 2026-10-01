import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, expectPokerPhase, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

type Snap = {
  viewerId: string;
  poker?: {
    phase: string;
    pot: { label: string };
    potPaid?: boolean;
    toCall: { label: string };
    currentActorId: string | null;
    waitingCopy?: string | null;
    copy?: string;
    legalActions: { type: string; label: string }[];
    winners?: { userId: string; name: string; amount: { label: string } }[];
    seats: {
      userId: string;
      name: string;
      isDealer: boolean;
      isSmallBlind: boolean;
      isBigBlind: boolean;
      isActor: boolean;
      streetContribution: { label: string };
      available: { label: string };
      toCall?: { label: string };
    }[];
  };
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
    throw new Error(`${commandName} failed: ${JSON.stringify(await response.json().catch(() => ({})))}`);
  }
}

test("two devices share a fold-complete hand and a rotated next hand", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("hand-bank");
  const samEmail = uniqueEmail("hand-sam");
  await openAs(context, page, ownerEmail, "Owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await createBlackjackTable(page, "Protocol table", { starting: "100" });
  const setup = await tableSnapshot(page);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;
  const ownerId = setup.setup?.members?.find((member) => member.isOwner)?.userId ?? setup.viewerId;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await samPage.setViewportSize({ width: 390, height: 844 });
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();
  await command(page, tableId, "giveJetons", { userId: ownerId, amount: "100" });
  await command(page, tableId, "switchGame", { game: "POKER" });
  await command(page, tableId, "startTexasHoldem", { smallBlind: "5", bigBlind: "10" });
  await page.reload();
  await samPage.reload();
  await expectPokerPhase(page, "PRE-FLOP");

  const ownerSnap = await tableSnapshot(page);
  const samSnap = await tableSnapshot(samPage);
  expect(ownerSnap.poker?.pot.label).toBe("15");
  expect(samSnap.poker?.pot.label).toBe("15");
  expect(ownerSnap.poker?.toCall.label).toBe("5");
  expect(ownerSnap.poker?.currentActorId).toBe(samSnap.poker?.currentActorId);
  expect(ownerSnap.poker?.legalActions.map((action) => action.type).sort()).toEqual(["ALL_IN", "CALL", "FOLD", "RAISE"]);
  await expect(page.getByRole("button", { name: /CALL 5/ })).toBeVisible();
  await expect(page.getByText("POT", { exact: true })).toBeVisible();
  await expect(page.getByText("15", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: join(out, "app-poker-blinds-pot-15-390x844.png") });
  await page.screenshot({ path: join(out, "app-poker-sb-call-5-390x844.png") });

  await page.getByRole("button", { name: "FOLD" }).click();
  await expect.poll(async () => (await tableSnapshot(page)).poker?.phase).toBe("HAND_COMPLETE");
  const folded = await tableSnapshot(page);
  const foldedSam = await tableSnapshot(samPage);
  expect(folded.poker?.toCall.label).toBe("0");
  expect(folded.poker?.currentActorId).toBeNull();
  expect(folded.poker?.waitingCopy).toBeNull();
  expect(folded.poker?.potPaid).toBe(true);
  expect(folded.poker?.winners?.[0]?.amount.label).toBe("15");
  expect(foldedSam.poker?.currentActorId).toBeNull();
  expect(foldedSam.poker?.toCall.label).toBe("0");
  await expect(page.getByText("POT PAID")).toBeVisible();
  await expect(page.getByText(/WON 15/)).toBeVisible();
  await expect(page.getByRole("button", { name: "FOLD" })).toHaveCount(0);
  await expect(page.getByText("TO CALL")).toHaveCount(0);
  await page.screenshot({ path: join(out, "app-poker-fold-winner-390x844.png") });

  await command(page, tableId, "startNextPokerHand");
  await page.reload();
  await samPage.reload();
  await expectPokerPhase(page, "PRE-FLOP");
  const next = await tableSnapshot(page);
  expect(next.poker?.pot.label).toBe("15");
  expect(next.poker?.seats.find((seat) => seat.isDealer)?.name).toBe("Sam");
  expect(next.poker?.seats.find((seat) => seat.isSmallBlind)?.name).toBe("Sam");
  expect(next.poker?.seats.find((seat) => seat.isBigBlind)?.name).toBe("Owner");
  await page.screenshot({ path: join(out, "app-poker-next-hand-rotated-390x844.png") });

  await expect(samPage.getByRole("button", { name: /CALL 5/ })).toBeVisible();
  await samPage.getByRole("button", { name: /CALL 5/ }).click();
  await expect.poll(async () => (await tableSnapshot(page)).poker?.currentActorId).toBe(ownerSnap.viewerId);
  await expect(page.getByRole("button", { name: "CHECK" })).toBeVisible();
  await expect(page.getByRole("button", { name: "RAISE" })).toBeVisible();
  await expect(page.getByRole("button", { name: /CALL / })).toHaveCount(0);
  await page.screenshot({ path: join(out, "app-poker-bb-check-raise-390x844.png") });

  await page.getByRole("button", { name: "CHECK" }).click();
  await command(page, tableId, "advancePokerStreet");
  await expect.poll(async () => (await tableSnapshot(page)).poker?.phase).toBe("FLOP");
  await expect(page.getByRole("button", { name: "CHECK" })).toBeVisible();
  await page.getByRole("button", { name: "CHECK" }).click();
  await expect.poll(async () => (await tableSnapshot(samPage)).poker?.currentActorId).toBe(samSnap.viewerId);
  await samPage.getByRole("button", { name: "BET" }).click();
  await samPage.getByRole("button", { name: "CONFIRM BET" }).click();
  await expect.poll(async () => (await tableSnapshot(page)).poker?.toCall.label).toBe("10");
  await expect(page.getByRole("button", { name: /CALL 10/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "RAISE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "FOLD" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CHECK" })).toHaveCount(0);
  await page.screenshot({ path: join(out, "app-poker-facing-bet-call-raise-390x844.png") });

  await samContext.close();
});

test("two-player complete hand conserves 200, pays once, and rotates", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("full-bank");
  const samEmail = uniqueEmail("full-sam");
  await openAs(context, page, ownerEmail, "Owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await createBlackjackTable(page, "High Roller", { starting: "100" });
  const setup = await tableSnapshot(page);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;
  const ownerId = setup.setup?.members?.find((member) => member.isOwner)?.userId ?? setup.viewerId;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await samPage.setViewportSize({ width: 390, height: 844 });
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();
  await command(page, tableId, "giveJetons", { userId: ownerId, amount: "100" });
  await command(page, tableId, "switchGame", { game: "POKER" });
  await page.reload();
  await samPage.reload();
  await expect(page.getByRole("button", { name: "START HAND", exact: true })).toBeVisible();
  await page.screenshot({ path: join(out, "app-poker-setup-owner-390x844.png") });
  await command(page, tableId, "startTexasHoldem", { smallBlind: "5", bigBlind: "10" });
  await page.reload();
  await samPage.reload();
  await expectPokerPhase(page, "PRE-FLOP");

  const opened = await tableSnapshot(page);
  expect(opened.poker?.pot.label).toBe("15");
  const actorPage = opened.poker?.currentActorId === opened.viewerId ? page : samPage;
  const otherPage = actorPage === page ? samPage : page;
  await actorPage.screenshot({ path: join(out, "app-poker-preflop-player-call-390x844.png") });
  await page.screenshot({ path: join(out, "app-poker-preflop-owner-390x844.png") });
  await actorPage.getByRole("button", { name: /CALL 5/ }).click();
  await expect(otherPage.getByRole("button", { name: "CHECK" })).toBeVisible({ timeout: 15_000 });
  await otherPage.getByRole("button", { name: "CHECK" }).click();
  await expect(page.getByRole("button", { name: "DEAL FLOP" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL FLOP" }).click();
  await expectPokerPhase(page, "FLOP");

  async function act(type: "CHECK" | "CALL" | "BET") {
    await expect.poll(async () => (await tableSnapshot(page)).poker?.currentActorId ?? "").not.toBe("");
    const snap = await tableSnapshot(page);
    const current = snap.poker?.currentActorId === snap.viewerId ? page : samPage;
    await expect.poll(async () => {
      const actor = await tableSnapshot(current);
      return actor.poker?.legalActions.some((action) => action.type === type) ?? false;
    }).toBe(true);
    if (type === "BET") {
      if (!(await current.getByRole("button", { name: "BET" }).count())) await current.reload();
      await expect(current.getByRole("button", { name: "BET" })).toBeVisible({ timeout: 15_000 });
      await current.getByRole("button", { name: "BET" }).click();
      await expect(current.getByRole("button", { name: "CONFIRM BET" })).toBeVisible();
      await current.getByRole("button", { name: "CONFIRM BET" }).click();
      return;
    }
    if (type === "CALL") {
      if (!(await current.getByRole("button", { name: /CALL / }).count())) await current.reload();
      await expect(current.getByRole("button", { name: /CALL / })).toBeVisible({ timeout: 15_000 });
      await current.getByRole("button", { name: /CALL / }).click();
      return;
    }
    if (!(await current.getByRole("button", { name: "CHECK" }).count())) await current.reload();
    await expect(current.getByRole("button", { name: "CHECK" })).toBeVisible({ timeout: 15_000 });
    await current.getByRole("button", { name: "CHECK" }).click();
  }

  const flopActor = (await tableSnapshot(page)).poker?.currentActorId;
  await act("CHECK");
  await expect.poll(async () => (await tableSnapshot(page)).poker?.currentActorId).not.toBe(flopActor);
  await samPage.screenshot({ path: join(out, "app-poker-flop-player-390x844.png") });
  await page.screenshot({ path: join(out, "app-poker-owner-betting-street-390x844.png") });
  await act("BET");
  await expect.poll(async () => {
    const snap = await tableSnapshot(page);
    return snap.poker?.seats.find((seat) => seat.userId === snap.poker?.currentActorId)?.toCall?.label ?? "0";
  }).toBe("10");
  const facingSnap = await tableSnapshot(page);
  const facing = facingSnap.poker?.currentActorId === facingSnap.viewerId ? page : samPage;
  await facing.reload();
  await expect(facing.getByRole("button", { name: /CALL 10/ })).toBeVisible();
  await expect(facing.getByRole("button", { name: "RAISE" })).toBeVisible();
  await expect(facing.getByRole("button", { name: /ALL IN/ })).toBeVisible();
  await expect(facing.getByRole("button", { name: "FOLD" })).toBeVisible();
  await act("CALL");
  await expect.poll(async () => (await tableSnapshot(page)).poker?.pot.label).toBe("40");
  await expect.poll(async () => (await tableSnapshot(page)).poker?.canDealStreet).toBe(true);
  await page.getByRole("button", { name: "DEAL TURN" }).click();
  await expectPokerPhase(page, "TURN");
  await samPage.screenshot({ path: join(out, "app-poker-turn-player-390x844.png") });
  await act("CHECK");
  await act("CHECK");
  await expect.poll(async () => (await tableSnapshot(page)).poker?.canDealStreet).toBe(true);
  await page.getByRole("button", { name: "DEAL RIVER" }).click();
  await expectPokerPhase(page, "RIVER");
  await act("CHECK");
  await act("CHECK");
  await expect.poll(async () => (await tableSnapshot(page)).poker?.canDealStreet).toBe(true);
  await page.getByRole("button", { name: "SHOWDOWN" }).click();
  await expectPokerPhase(page, "SHOWDOWN");
  await expect(page.locator("[data-turn-state]")).toHaveCount(0);
  await expect(page.getByText("TO CALL")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "FOLD" })).toHaveCount(0);
  await page.screenshot({ path: join(out, "app-poker-showdown-owner-390x844.png") });
  const showdown = await tableSnapshot(page);
  const winnerName = showdown.poker?.seats.find((seat) => seat.userId !== ownerId)?.name ?? "Sam";
  await page.getByRole("button", { name: winnerName, exact: true }).click();
  await page.getByRole("button", { name: "AWARD POT", exact: true }).click();
  await expect(page.getByText("HAND COMPLETE", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("POT PAID")).toBeVisible();
  await expect(page.locator("[data-turn-state]")).toHaveCount(0);
  await expect(page.getByText("TO CALL")).toHaveCount(0);
  await expect(page.getByText("Waiting", { exact: true })).toHaveCount(0);
  const done = await tableSnapshot(page);
  expect(done.poker?.currentActorId).toBeNull();
  expect(done.poker?.toCall.label).toBe("0");
  expect(done.poker?.potPaid).toBe(true);
  const total = (done.poker?.seats ?? []).reduce((sum, seat) => sum + Number(seat.available.label), 0);
  expect(total).toBe(200);
  await page.screenshot({ path: join(out, "app-poker-complete-owner-390x844.png") });
  await samPage.reload();
  await samPage.screenshot({ path: join(out, "app-poker-complete-player-390x844.png") });
  const firstDealer = done.poker?.seats.find((seat) => seat.isDealer)?.name;
  await page.getByRole("button", { name: "NEXT HAND", exact: true }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  await page.reload();
  await samPage.reload();
  const next = await tableSnapshot(page);
  const samNext = await tableSnapshot(samPage);
  expect(next.poker?.phase).toBe(samNext.poker?.phase);
  expect(next.poker?.pot.label).toBe("15");
  expect(next.poker?.pot.label).toBe(samNext.poker?.pot.label);
  expect(next.poker?.currentActorId).toBe(samNext.poker?.currentActorId);
  expect(next.poker?.seats.find((seat) => seat.isDealer)?.name).not.toBe(firstDealer);
  await samContext.close();
});
