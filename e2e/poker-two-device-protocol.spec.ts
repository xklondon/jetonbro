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
      streetContribution: { label: string };
      available: { label: string };
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

test("two devices share heads-up blinds, CALL/RAISE, and reload state", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("proto-bank");
  const samEmail = uniqueEmail("proto-sam");
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
  await expect(samPage.getByText(/Waiting for the Bank/i)).toBeVisible();
  await command(page, tableId, "giveJetons", { userId: ownerId, amount: "100" });
  await command(page, tableId, "switchGame", { game: "POKER" });
  await command(page, tableId, "startTexasHoldem", { smallBlind: "5", bigBlind: "10" });
  await page.reload();
  await samPage.reload();
  await expectPokerPhase(page, "PRE-FLOP");

  const ownerSnap = await tableSnapshot(page);
  const samSnap = await tableSnapshot(samPage);
  expect(ownerSnap.poker?.pot.label).toBe(samSnap.poker?.pot.label);
  expect(ownerSnap.poker?.currentActorId).toBe(samSnap.poker?.currentActorId);
  expect(ownerSnap.poker?.seats.find((seat) => seat.isDealer)?.isSmallBlind).toBe(true);
  expect(ownerSnap.poker?.seats.find((seat) => seat.isBigBlind)?.name).toBe("Sam");
  expect(ownerSnap.poker?.legalActions.map((action) => action.type).sort()).toEqual(["ALL_IN", "CALL", "FOLD", "RAISE"]);
  expect(ownerSnap.poker?.legalActions.some((action) => action.type === "CHECK")).toBe(false);
  await expect(page.getByRole("button", { name: /CALL / })).toBeVisible();
  await expect(page.getByRole("button", { name: "RAISE" })).toBeVisible();
  await expect(page.getByRole("button", { name: /ALL IN / })).toBeVisible();
  await expect(page.getByRole("button", { name: "FOLD" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CHECK" })).toHaveCount(0);
  await page.screenshot({ path: join(out, "app-poker-call-raise-390x844.png") });
  await samPage.screenshot({ path: join(out, "app-poker-bank-player-same-actor-390x844.png") });

  await page.getByRole("button", { name: /CALL / }).click();
  await expect.poll(async () => (await tableSnapshot(samPage)).poker?.currentActorId).toBe(samSnap.viewerId);
  await expect(samPage.getByRole("button", { name: "CHECK" })).toBeVisible();
  await expect(samPage.getByRole("button", { name: "RAISE" })).toBeVisible();
  await expect(samPage.getByRole("button", { name: /CALL / })).toHaveCount(0);
  await samPage.screenshot({ path: join(out, "app-poker-check-available-390x844.png") });

  await samPage.getByRole("button", { name: "RAISE" }).click();
  await expect(samPage.locator("[data-raise-convention]")).toContainText("Raise to");
  await samPage.getByRole("button", { name: "CONFIRM RAISE" }).click();
  await expect.poll(async () => (await tableSnapshot(page)).poker?.toCall.label).not.toBe("0");
  await expect.poll(async () => (await tableSnapshot(page)).poker?.currentActorId).toBe(ownerSnap.viewerId);

  await page.reload();
  await samPage.reload();
  const afterReload = await tableSnapshot(page);
  const samReload = await tableSnapshot(samPage);
  expect(afterReload.poker?.phase).toBe("PRE_FLOP");
  expect(afterReload.poker?.currentActorId).toBe(samReload.poker?.currentActorId);
  expect(afterReload.poker?.pot.label).toBe(samReload.poker?.pot.label);
  expect(afterReload.poker?.toCall.label).toBe(samReload.poker?.seats.find((seat) => seat.userId === afterReload.viewerId)?.streetContribution ? afterReload.poker?.toCall.label : afterReload.poker?.toCall.label);

  await samContext.close();
});
