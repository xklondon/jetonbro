import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  createBlackjackTable,
  expectPokerPhase,
  openAs,
  uniqueEmail,
} from "./helpers";

type Snap = {
  viewerId: string;
  player?: { boxes: { id: string; boxNumber?: number; bet?: { label: string }; outcome?: string | null }[] };
  bank?: { players: { name: string; boxes: { id: string; outcome?: string | null }[] }[] };
  poker?: {
    phase: string;
    currentActorId: string | null;
    canDealStreet?: boolean;
    streetComplete?: boolean;
    pot?: { label: string };
    legalActions?: { type: string; label: string }[];
    seats: {
      userId: string;
      name: string;
      isDealer?: boolean;
      isSmallBlind?: boolean;
      isBigBlind?: boolean;
      isActor?: boolean;
      available?: { label: string };
    }[];
  };
  members: { userId: string; name: string; isOwner?: boolean }[];
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

async function addJetons(page: Page, amount: "5" | "10" | "25") {
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.getByRole("button", { name: `Add ${amount} jetons` }).click({ force: true });
}

function pageFor(owner: Page, sam: Page, jo: Page, seats: { userId: string; name: string }[], actorId: string | null) {
  const name = seats.find((seat) => seat.userId === actorId)?.name;
  if (name === "Sam") return sam;
  if (name === "Jo") return jo;
  return owner;
}

function expectYourTurn(page: Page) {
  return expect(
    page.locator("[data-poker-turn-hint]").filter({ hasText: /YOUR TURN/i }).or(page.locator("[data-turn-state=you]")).first(),
  ).toBeVisible({ timeout: 15_000 });
}

async function callOrCheck(page: Page) {
  const call = page.getByRole("button", { name: /^CALL/ });
  const check = page.getByRole("button", { name: "CHECK" });
  await expect(call.or(check)).toBeVisible({ timeout: 20_000 });
  if (await call.isVisible()) await call.click();
  else await check.click();
}

async function threeSeated(page: Page, context: BrowserContext, browser: Browser) {
  const ownerEmail = uniqueEmail("turn-bank");
  const samEmail = uniqueEmail("turn-sam");
  const joEmail = uniqueEmail("turn-jo");
  await openAs(context, page, ownerEmail, "Owner");
  await page.setViewportSize({ width: 390, height: 844 });
  await createBlackjackTable(page, "Turn table", { starting: "100" });
  const setupSnap = await tableSnapshot(page);
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;

  const samContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);

  const joContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(joinPath);

  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  const ownerId = setupSnap.setup?.members?.find((member) => member.isOwner)?.userId ?? setupSnap.viewerId;
  await page.request.post(`/api/tables/${tableId}/commands`, {
    data: { command: "giveJetons", userId: ownerId, amount: "100", idempotencyKey: crypto.randomUUID() },
  });
  return { tableId, samContext, samPage, joContext, joPage };
}

test("mobile: payout swipes, automatic blinds, dealer acts, P1 to P2, matched street, and poker tray", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(240_000);
  const { tableId, samContext, samPage, joContext, joPage } = await threeSeated(page, context, browser);
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "ADD PLAYER" })).toBeVisible();
  // Premium bank mode lives on create / owner settings — not Classic .sheet.open menu copy.
  await samPage.reload();
  await expect(samPage.getByText(/AVAILABLE|YOUR JETONS/i).first()).toBeVisible();

  await addJetons(samPage, "25");
  await samPage.getByRole("button", { name: "ADD BOX" }).click({ force: true });
  await expect.poll(async () => {
    const snap = await tableSnapshot(samPage);
    return snap.player?.boxes.length ?? 0;
  }).toBe(2);
  const extraBox = (await tableSnapshot(samPage)).player?.boxes.find((box) => box.boxNumber === 2);
  expect(extraBox?.id).toBeTruthy();
  await samPage.locator(`[data-box-id="${extraBox!.id}"]`).click();
  await addJetons(samPage, "10");
  await expect.poll(async () => {
    const snap = await tableSnapshot(samPage);
    return snap.player?.boxes.find((box) => box.boxNumber === 2)?.bet.label ?? "";
  }).toBe("10");
  await joPage.reload();
  await addJetons(joPage, "25");
  await expect
    .poll(async () => {
      const snap = await tableSnapshot(page);
      return snap.bank?.players.find((player) => player.name === "Jo")?.boxes.length ?? 0;
    })
    .toBe(1);

  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const snap = await tableSnapshot(page);
      const sam = snap.bank?.players.find((player) => player.name === "Sam")?.boxes ?? [];
      const jo = snap.bank?.players.find((player) => player.name === "Jo")?.boxes ?? [];
      return sam.length >= 2 && jo.length === 1;
    })
    .toBe(true);

  const payoutSnap = await tableSnapshot(page);
  const samBoxes = payoutSnap.bank?.players.find((player) => player.name === "Sam")?.boxes ?? [];
  const joBoxes = payoutSnap.bank?.players.find((player) => player.name === "Jo")?.boxes ?? [];

  // Premium payout rail: LOST / WIN / DRAW (not Classic Lost/Won/Stand-off copy).
  await page.locator(`[data-box-id="${samBoxes[0]!.id}"]`).getByRole("button", { name: /Set Box .* result: LOST/ }).click();
  await page.locator(`[data-box-id="${samBoxes[1]!.id}"]`).getByRole("button", { name: /Set Box .* result: WIN/ }).click();
  await page.locator(`[data-box-id="${joBoxes[0]!.id}"]`).getByRole("button", { name: /Set Box .* result: DRAW/ }).click();

  await expect
    .poll(async () => {
      const snap = await tableSnapshot(page);
      const sam = snap.bank?.players.find((player) => player.name === "Sam")?.boxes ?? [];
      const jo = snap.bank?.players.find((player) => player.name === "Jo")?.boxes ?? [];
      return [sam[0]?.outcome, sam[1]?.outcome, jo[0]?.outcome].join(",");
    })
    .toBe("LOST,WON,PUSH");

  await command(page, tableId, "switchGame", { game: "POKER" });
  await page.reload();
  await samPage.reload();
  await joPage.reload();
  await expect(page.getByRole("button", { name: "START HAND", exact: true })).toBeVisible({ timeout: 15_000 });
  await command(page, tableId, "startTexasHoldem", { smallBlind: "5", bigBlind: "10" });
  await page.reload();
  await samPage.reload();
  await joPage.reload();
  await expectPokerPhase(page, "PRE-FLOP");
  await expect(page.locator("[data-player-wallet]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add 25 jetons" })).toBeVisible();
  // DEAL FLOP only appears when street is matched and owner is not the current actor.
  await expect(page.getByRole("button", { name: "DEAL FLOP" })).toHaveCount(0);
  const feltBox = await page.locator("[data-table-board=POKER_DEALER]").boundingBox();
  const walletBox = await page.locator("[data-player-wallet]").boundingBox();
  expect(feltBox && walletBox).toBeTruthy();
  expect(feltBox!.y + feltBox!.height).toBeLessThanOrEqual(walletBox!.y + 80);
  expect(walletBox!.y + walletBox!.height).toBeLessThanOrEqual(844);

  const preflop = await tableSnapshot(page);
  expect(preflop.poker?.seats.some((seat) => seat.isDealer)).toBe(true);
  expect(preflop.poker?.seats.some((seat) => seat.isSmallBlind)).toBe(true);
  expect(preflop.poker?.seats.some((seat) => seat.isBigBlind)).toBe(true);
  const sb = preflop.poker?.seats.find((seat) => seat.isSmallBlind);
  const bb = preflop.poker?.seats.find((seat) => seat.isBigBlind);
  expect(sb?.available?.label).not.toBe("100");
  expect(bb?.available?.label).not.toBe("100");
  expect(page.getByText("SB", { exact: false })).toBeTruthy();

  const firstActor = pageFor(page, samPage, joPage, preflop.poker!.seats, preflop.poker!.currentActorId);
  await firstActor.reload();
  await expectYourTurn(firstActor);
  await expect(firstActor.getByRole("button", { name: "FOLD" })).toBeVisible();
  await callOrCheck(firstActor);

  await expect
    .poll(async () => (await tableSnapshot(page)).poker?.currentActorId)
    .not.toBe(preflop.poker?.currentActorId);
  const afterFirst = await tableSnapshot(page);
  const secondActor = pageFor(page, samPage, joPage, afterFirst.poker!.seats, afterFirst.poker!.currentActorId);
  await secondActor.reload();
  await expectYourTurn(secondActor);
  await expect(secondActor.getByRole("button", { name: "FOLD" })).toBeVisible();
  await expect(secondActor.getByRole("button", { name: /^CALL/ }).or(secondActor.getByRole("button", { name: "CHECK" }))).toBeVisible();
  await expect(secondActor.getByRole("button", { name: "RAISE" }).or(secondActor.getByRole("button", { name: "BET" }))).toBeVisible();
  await expect(secondActor.getByRole("button", { name: /ALL.?IN/i })).toBeVisible();
  if (secondActor !== page) {
    await expect(secondActor.getByRole("button", { name: "DEAL FLOP" })).toHaveCount(0);
  }
  await callOrCheck(secondActor);

  await expect
    .poll(async () => (await tableSnapshot(page)).poker?.currentActorId)
    .not.toBe(afterFirst.poker?.currentActorId);
  const afterSecond = await tableSnapshot(page);
  const thirdActor = pageFor(page, samPage, joPage, afterSecond.poker!.seats, afterSecond.poker!.currentActorId);
  await thirdActor.reload();
  await callOrCheck(thirdActor);

  await expect.poll(async () => (await tableSnapshot(page)).poker?.canDealStreet).toBe(true);
  await expect(page.getByRole("button", { name: "DEAL FLOP" })).toBeEnabled();
  await page.getByRole("button", { name: "DEAL FLOP" }).click();
  await expectPokerPhase(page, "FLOP");

  const flop = await tableSnapshot(page);
  const flopActor = pageFor(page, samPage, joPage, flop.poker!.seats, flop.poker!.currentActorId);
  await flopActor.reload();
  await expectYourTurn(flopActor);
  await flopActor.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await flopActor.getByRole("button", { name: "BET" }).click();
  // First chip sets total street wager to 10 (min bet).
  await flopActor.getByRole("button", { name: "Add 10 jetons" }).click({ force: true });
  await expect(flopActor.getByLabel("Bet amount")).toBeVisible();
  await expect.poll(async () => (await tableSnapshot(page)).poker?.pot?.label).toBe(flop.poker?.pot?.label);
  await flopActor.getByRole("button", { name: /^CONFIRM 10$/ }).click();
  await expect.poll(async () => (await tableSnapshot(page)).poker?.pot?.label).not.toBe(flop.poker?.pot?.label);

  const afterTap = await tableSnapshot(page);
  const nextFlop = pageFor(page, samPage, joPage, afterTap.poker!.seats, afterTap.poker!.currentActorId);
  await nextFlop.reload();
  await expectYourTurn(nextFlop);
  await expect(nextFlop.getByRole("button", { name: /^CALL/ })).toBeVisible();
  await nextFlop.getByRole("button", { name: "RAISE" }).click();
  await expect(nextFlop.getByRole("button", { name: /^CALL/ })).toBeVisible();
  await expect(nextFlop.getByLabel("Raise to total")).toBeVisible();
  await expect(nextFlop.getByRole("button", { name: "RAISE TO 25" })).toHaveCount(0);
  // Facing 10: tap 25 → total 25 (not 10+25).
  await nextFlop.getByRole("button", { name: "Add 25 jetons" }).click({ force: true });
  await expect(nextFlop.locator('[data-raise-to-preview="25"]')).toBeVisible();
  await expect.poll(async () => (await tableSnapshot(page)).poker?.currentActorId).toBe(afterTap.poker?.currentActorId);
  await nextFlop.getByRole("button", { name: /^CONFIRM 25$/ }).click();
  await expect
    .poll(async () => (await tableSnapshot(page)).poker?.currentActorId, { timeout: 15_000 })
    .not.toBe(afterTap.poker?.currentActorId);

  await samContext.close();
  await joContext.close();
});
