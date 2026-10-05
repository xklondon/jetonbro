import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, expectPokerPhase, openAs, openTableMenu, closeTableMenu, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "tabletop", "poker-final");

type Snap = {
  viewerId: string;
  poker?: {
    phase: string;
    pot: { label: string };
    potPaid?: boolean;
    toCall: { label: string };
    currentActorId: string | null;
    waitingCopy?: string | null;
    legalActions: { type: string; label: string }[];
    winners?: { userId: string; name: string; amount: { label: string } }[];
    canDealStreet?: boolean;
    available?: { label: string };
    seats: {
      userId: string;
      name: string;
      isDealer: boolean;
      isSmallBlind: boolean;
      isBigBlind: boolean;
      isActor: boolean;
      available: { label: string };
      status?: string;
    }[];
    pots?: { index: number; amount: { label: string }; eligiblePlayerIds: string[]; winnerPlayerIds: string[] }[];
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

async function shot(page: Page, name: string, size: { width: number; height: number } = { width: 390, height: 844 }) {
  await page.setViewportSize(size);
  await page.screenshot({ path: join(out, `${name}-${size.width}x${size.height}.png`) });
}

async function actorPage(owner: Page, player: Page) {
  const snap = await tableSnapshot(owner);
  return snap.poker?.currentActorId === snap.viewerId ? owner : player;
}

async function matchStreet(owner: Page, player: Page, tableId: string) {
  for (let i = 0; i < 16; i += 1) {
    await owner.reload();
    if (player.url().includes("/tables/")) await player.reload();
    for (const name of ["DEAL FLOP", "DEAL TURN", "DEAL RIVER", "SHOWDOWN"] as const) {
      const btn = owner.getByRole("button", { name, exact: true });
      if ((await btn.count()) && (await btn.isEnabled())) return;
    }
    const actor = await actorPage(owner, player);
    const legal = (await tableSnapshot(actor)).poker?.legalActions.map((action) => action.type) ?? [];
    if (legal.includes("CHECK")) await command(actor, tableId, "pokerAct", { type: "CHECK" });
    else if (legal.includes("CALL")) await command(actor, tableId, "pokerAct", { type: "CALL" });
  }
}

test("tabletop poker-final screenshot matrix and role/overflow checks", async ({ page, context, browser }) => {
  test.setTimeout(300_000);
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("pf-own");
  const samEmail = uniqueEmail("pf-sam");
  const joEmail = uniqueEmail("pf-jo");
  await openAs(context, page, ownerEmail, "Owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await createBlackjackTable(page, "Final Hold em", { starting: "100" });
  const setup = await tableSnapshot(page);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;
  const ownerId = setup.setup?.members?.find((member) => member.isOwner)?.userId ?? setup.viewerId;

  const samContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);

  await command(page, tableId, "giveJetons", { userId: ownerId, amount: "100" });
  await command(page, tableId, "switchGame", { game: "POKER" });
  await page.reload();
  await samPage.reload();
  await expect(page.getByRole("button", { name: "START HAND" })).toBeEnabled({ timeout: 20_000 });
  await shot(page, "01-poker-setup-owner");
  await shot(samPage, "02-poker-phase0-player");

  await page.getByRole("button", { name: "START HAND" }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  await samPage.reload();
  await page.reload();

  const first = await actorPage(page, samPage);
  const other = first === page ? samPage : page;
  await expect(first.getByRole("button", { name: /CALL/ })).toBeVisible({ timeout: 20_000 });
  await shot(first, "03-heads-up-preflop-acting");
  await shot(other, "04-heads-up-preflop-waiting");
  await shot(page, "05-dealer-owner-preflop");

  await matchStreet(page, samPage, tableId);
  await expect(page.getByRole("button", { name: "DEAL FLOP" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "DEAL FLOP" }).click();
  await expectPokerPhase(page, "FLOP");
  await samPage.reload();

  const flopActor = await actorPage(page, samPage);
  if (await flopActor.getByRole("button", { name: "CHECK" }).count()) {
    await shot(flopActor, "06-flop-player-check");
  } else {
    await shot(flopActor, "07-flop-player-call");
  }
  const raiseActor = await actorPage(page, samPage);
  if (await raiseActor.getByRole("button", { name: "RAISE" }).count()) {
    await raiseActor.getByRole("button", { name: "RAISE" }).click();
    await expect(raiseActor.locator("[data-raise-composer=true]")).toBeVisible();
    await shot(raiseActor, "08-raise-composer-open");
    await raiseActor.getByRole("button", { name: "CANCEL" }).click();
  } else if (await raiseActor.getByRole("button", { name: "BET" }).count()) {
    await raiseActor.getByRole("button", { name: "BET" }).click();
    await expect(raiseActor.locator("[data-raise-composer=true]")).toBeVisible();
    await shot(raiseActor, "08-raise-composer-open");
    await raiseActor.getByRole("button", { name: "CANCEL" }).click();
  }

  await matchStreet(page, samPage, tableId);
  await page.getByRole("button", { name: "DEAL TURN" }).click();
  await expectPokerPhase(page, "TURN");
  await samPage.reload();
  await shot(samPage, "09-turn");

  await matchStreet(page, samPage, tableId);
  await page.getByRole("button", { name: "DEAL RIVER" }).click();
  await expectPokerPhase(page, "RIVER");
  await samPage.reload();
  await shot(samPage, "10-river");

  await matchStreet(page, samPage, tableId);
  await page.getByRole("button", { name: "SHOWDOWN" }).click();
  await expectPokerPhase(page, "SHOWDOWN");
  await expect(page.locator("[data-award-panel=true]")).toBeVisible();
  await shot(page, "13-showdown-before-award");
  const showdown = await tableSnapshot(page);
  const winnerName = showdown.poker?.seats.find((seat) => seat.userId !== ownerId)?.name ?? "Sam";
  await page.getByRole("button", { name: winnerName, exact: true }).click();
  await page.getByRole("button", { name: "AWARD POT", exact: true }).click();
  await expectPokerPhase(page, "HAND COMPLETE");
  await samPage.reload();
  await shot(samPage, "15-hand-complete-player");
  await shot(page, "16-hand-complete-dealer");

  const wallet = await samPage.locator("[data-player-wallet]").getAttribute("data-wallet-available");
  const complete = await tableSnapshot(samPage);
  expect(wallet).toBe(complete.poker?.available?.label);
  expect(wallet).toBe(complete.poker?.seats.find((seat) => seat.userId === complete.viewerId)?.available.label);
  expect(complete.poker?.currentActorId).toBeNull();
  expect(complete.poker?.toCall.label).toBe("0");
  await expect(samPage.getByText("TO CALL")).toHaveCount(0);
  await expect(samPage.locator("[data-next-rotation=true]")).toBeVisible();
  const conserved = (complete.poker?.seats ?? []).reduce((sum, seat) => sum + Number(seat.available.label), 0);
  expect(conserved).toBe(200);

  await page.getByRole("button", { name: "NEXT HAND", exact: true }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  await page.reload();
  await samPage.reload();
  const rotated = await tableSnapshot(page);
  expect(rotated.poker?.seats.find((seat) => seat.isDealer)?.userId).not.toBe(complete.poker?.seats.find((seat) => seat.isDealer)?.userId);
  await shot(page, "17-next-hand-rotated");

  await openTableMenu(page);
  await shot(page, "18-owner-menu-safe-boundary");
  await closeTableMenu(page);

  // Reach Hand Complete, then seat Jo before NEXT HAND
  for (let i = 0; i < 8; i += 1) {
    const livePhase = (await tableSnapshot(page)).poker?.phase ?? "";
    if (livePhase === "HAND_COMPLETE" || livePhase === "POKER_SETUP") break;
    const actor = await actorPage(page, samPage);
    if (await actor.getByRole("button", { name: "FOLD" }).count()) {
      await actor.getByRole("button", { name: "FOLD" }).click();
      break;
    }
    const legal = (await tableSnapshot(actor)).poker?.legalActions.map((a) => a.type) ?? [];
    if (legal.includes("CHECK")) await command(actor, tableId, "pokerAct", { type: "CHECK" });
    else if (legal.includes("CALL")) await command(actor, tableId, "pokerAct", { type: "CALL" });
    else break;
  }
  await expectPokerPhase(page, "HAND COMPLETE");

  const joContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(joinPath);
  await expect(joPage.locator("[data-table-board]")).toBeVisible({ timeout: 20_000 });
  const joId = (await tableSnapshot(joPage)).viewerId;
  await command(page, tableId, "giveJetons", { userId: joId, amount: "100" });

  await page.getByRole("button", { name: "NEXT HAND" }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  await page.reload();
  await samPage.reload();
  await joPage.reload();
  let live = await tableSnapshot(page);
  expect(live.poker?.seats.length).toBeGreaterThanOrEqual(3);
  await expect(page.getByText("Jo").first()).toBeVisible();
  await shot(page, "11-three-player-table");

  // Drive all-ins when legal to surface side pots
  if (live.poker?.phase === "PRE_FLOP") {
    for (let i = 0; i < 12; i += 1) {
      const snap = await tableSnapshot(page);
      if (!snap.poker || !["PRE_FLOP", "FLOP", "TURN", "RIVER"].includes(snap.poker.phase)) break;
      const pages = [page, samPage, joPage];
      let actor = page;
      for (const candidate of pages) {
        const candidateSnap = await tableSnapshot(candidate);
        if (candidateSnap.poker?.currentActorId === candidateSnap.viewerId) {
          actor = candidate;
          break;
        }
      }
      const legal = (await tableSnapshot(actor)).poker?.legalActions.map((a) => a.type) ?? [];
      if (legal.includes("ALL_IN")) await command(actor, tableId, "pokerAct", { type: "ALL_IN" });
      else if (legal.includes("RAISE")) await command(actor, tableId, "pokerAct", { type: "RAISE", amount: "40" });
      else if (legal.includes("CALL")) await command(actor, tableId, "pokerAct", { type: "CALL" });
      else if (legal.includes("CHECK")) await command(actor, tableId, "pokerAct", { type: "CHECK" });
      else break;
    }
    await page.reload();
    const after = await tableSnapshot(page);
    if ((after.poker?.pots?.length ?? 0) > 1 || after.poker?.seats.some((seat) => seat.status === "ALL_IN")) {
      await shot(page, "12-all-in-side-pots");
    }
    for (let guard = 0; guard < 20; guard += 1) {
      const s = await tableSnapshot(page);
      if (s.poker?.phase === "SHOWDOWN" || s.poker?.phase === "HAND_COMPLETE") break;
      let advanced = false;
      for (const name of ["DEAL FLOP", "DEAL TURN", "DEAL RIVER", "SHOWDOWN"] as const) {
        const btn = page.getByRole("button", { name, exact: true });
        if ((await btn.count()) && (await btn.isEnabled())) {
          await btn.click();
          advanced = true;
          break;
        }
      }
      if (advanced) continue;
      let acted = false;
      for (const candidate of [page, samPage, joPage]) {
        const candidateSnap = await tableSnapshot(candidate);
        if (candidateSnap.poker?.currentActorId !== candidateSnap.viewerId) continue;
        const legal = candidateSnap.poker?.legalActions.map((a) => a.type) ?? [];
        if (legal.includes("CHECK")) await command(candidate, tableId, "pokerAct", { type: "CHECK" });
        else if (legal.includes("CALL")) await command(candidate, tableId, "pokerAct", { type: "CALL" });
        else if (legal.includes("ALL_IN")) await command(candidate, tableId, "pokerAct", { type: "ALL_IN" });
        else break;
        acted = true;
        break;
      }
      if (!acted) break;
    }
    if ((await tableSnapshot(page)).poker?.phase === "SHOWDOWN") {
      await shot(page, "14-showdown-partial-or-side");
    }
  }

  for (const size of [
    { width: 360, height: 800 },
    { width: 430, height: 932 },
  ] as const) {
    await shot(page, "responsive-owner", size);
    await shot(samPage, "responsive-player", size);
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      body: document.body.scrollWidth > document.body.clientWidth + 1,
    }));
    expect(overflow.doc || overflow.body).toBeFalsy();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(out, "responsive-owner-1440x900.png") });

  await samContext.close();
  await joContext.close();
});
