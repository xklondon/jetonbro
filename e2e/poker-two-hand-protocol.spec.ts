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
  await expect(samPage.getByText(/Waiting for the Bank/i)).toBeVisible();
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
