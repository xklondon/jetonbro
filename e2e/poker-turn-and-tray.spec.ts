import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  createBlackjackTable,
  doubleTapPayoutRow,
  openAs,
  swipePayoutRow,
  uniqueEmail,
} from "./helpers";

type Snap = {
  viewerId: string;
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

async function addJetons(page: Page, amount: "5" | "10" | "25") {
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.getByRole("button", { name: `Add ${amount} jetons` }).click({ force: true });
}

async function dragChipToPot(page: Page, amount: "5" | "10" | "25") {
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  const chip = page.getByRole("button", { name: `Add ${amount} jetons` });
  const pot = page.locator("[data-drop-pot]");
  await expect(chip).toBeEnabled({ timeout: 15_000 });
  const chipBox = await chip.boundingBox();
  const potBox = await pot.boundingBox();
  if (!chipBox || !potBox) throw new Error("chip or pot is not visible");
  await page.mouse.move(chipBox.x + chipBox.width / 2, chipBox.y + chipBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(potBox.x + potBox.width / 2, potBox.y + potBox.height / 2, { steps: 16 });
  await page.mouse.up();
}

function pageFor(owner: Page, sam: Page, jo: Page, seats: { userId: string; name: string }[], actorId: string | null) {
  const name = seats.find((seat) => seat.userId === actorId)?.name;
  if (name === "Sam") return sam;
  if (name === "Jo") return jo;
  return owner;
}

function expectYourTurn(page: Page) {
  return expect(page.locator("[data-turn-state=you]").first()).toBeVisible({ timeout: 15_000 });
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

  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
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
  test.setTimeout(180_000);
  const { tableId, samContext, samPage, joContext, joPage } = await threeSeated(page, context, browser);
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await expect(page.getByText("OPEN BANK")).toBeVisible();
  await expect(page.getByText("LIMITED BANK")).toBeVisible();
  await samPage.reload();
  await expect(samPage.getByText("YOUR JETONS")).toBeVisible();
  await expect(samPage.getByText("OPEN BANK")).toHaveCount(0);
  await expect(samPage.getByText("LIMITED BANK")).toHaveCount(0);

  await addJetons(samPage, "25");
  await samPage.getByRole("button", { name: "+ Box" }).click({ force: true });
  await samPage.getByRole("button", { name: /YOUR BOX 2/ }).click({ force: true });
  await addJetons(samPage, "10");
  await joPage.reload();
  await addJetons(joPage, "25");
  await expect
    .poll(async () => {
      const snap = await tableSnapshot(page);
      return snap.bank?.players.find((player) => player.name === "Jo")?.boxes.length ?? 0;
    })
    .toBe(1);

  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();

  const payoutSnap = await tableSnapshot(page);
  const samBoxes = payoutSnap.bank?.players.find((player) => player.name === "Sam")?.boxes ?? [];
  const joBoxes = payoutSnap.bank?.players.find((player) => player.name === "Jo")?.boxes ?? [];
  expect(samBoxes.length).toBeGreaterThanOrEqual(2);
  expect(joBoxes.length).toBe(1);

  await swipePayoutRow(page, samBoxes[0]!.id, "left");
  await swipePayoutRow(page, samBoxes[1]!.id, "right");
  await doubleTapPayoutRow(page, joBoxes[0]!.id);

  await expect
    .poll(async () => {
      const snap = await tableSnapshot(page);
      const sam = snap.bank?.players.find((player) => player.name === "Sam")?.boxes ?? [];
      const jo = snap.bank?.players.find((player) => player.name === "Jo")?.boxes ?? [];
      return [sam[0]?.outcome, sam[1]?.outcome, jo[0]?.outcome].join(",");
    })
    .toBe("LOST,WON,PUSH");

  await page.getByRole("button", { name: "NEXT ROUND NOW" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "SWITCH GAME" }).click();
  await page.getByRole("button", { name: "Texas Hold’em" }).click();
  await page.getByRole("button", { name: "START TEXAS HOLD’EM" }).click();
  await expect(page.getByText("PRE-FLOP", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("YOUR JETONS")).toBeVisible();
  await expect(page.locator("[data-player-wallet]")).toBeVisible();
  await expect(page.locator("[data-owner-controls]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add 25 jetons" })).toBeVisible();
  await expect(page.getByRole("button", { name: "DEAL FLOP" })).toBeDisabled();
  await expect(page.getByText("Waiting for bets to match")).toBeVisible();
  const feltBox = await page.locator("main.poker-felt").boundingBox();
  const walletBox = await page.locator("[data-player-wallet]").boundingBox();
  expect(feltBox && walletBox).toBeTruthy();
  expect(feltBox!.y + feltBox!.height).toBeLessThanOrEqual(walletBox!.y + 16);
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
  await expect(secondActor.getByRole("button", { name: "ALL IN" })).toBeVisible();
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
  await expect(page.getByText("FLOP", { exact: true })).toBeVisible();

  const flop = await tableSnapshot(page);
  const flopActor = pageFor(page, samPage, joPage, flop.poker!.seats, flop.poker!.currentActorId);
  await flopActor.reload();
  await expectYourTurn(flopActor);
  await flopActor.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await flopActor.getByRole("button", { name: "BET" }).click();
  await flopActor.getByRole("button", { name: "Add 5 jetons" }).click({ force: true });
  await expect(flopActor.getByLabel("Bet amount")).toBeVisible();
  await expect.poll(async () => (await tableSnapshot(page)).poker?.pot?.label).toBe(flop.poker?.pot?.label);
  await flopActor.getByRole("button", { name: "CONFIRM BET" }).click();
  await expect.poll(async () => (await tableSnapshot(page)).poker?.pot?.label).not.toBe(flop.poker?.pot?.label);

  const afterTap = await tableSnapshot(page);
  const nextFlop = pageFor(page, samPage, joPage, afterTap.poker!.seats, afterTap.poker!.currentActorId);
  await nextFlop.reload();
  await expectYourTurn(nextFlop);
  await expect(nextFlop.getByRole("button", { name: /^CALL/ })).toBeVisible();
  await nextFlop.getByRole("button", { name: "RAISE" }).click();
  await expect(nextFlop.getByRole("button", { name: /^CALL/ })).toBeVisible();
  await expect(nextFlop.getByLabel("Raise to")).toBeVisible();
  await expect(nextFlop.getByRole("button", { name: "RAISE TO 25" })).toHaveCount(0);
  await dragChipToPot(nextFlop, "5");
  await expect.poll(async () => (await tableSnapshot(page)).poker?.currentActorId).toBe(afterTap.poker?.currentActorId);
  await nextFlop.getByRole("button", { name: "CONFIRM RAISE" }).click();
  await expect
    .poll(async () => (await tableSnapshot(page)).poker?.currentActorId, { timeout: 15_000 })
    .not.toBe(afterTap.poker?.currentActorId);

  await samContext.close();
  await joContext.close();
});
