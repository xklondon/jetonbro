import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  createPokerTable,
  expectPlayerPayoutIdle,
  expectPokerPhase,
  openAs,
  openSetupSheet,
  uniqueEmail,
} from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "approval");
const boards = join(process.cwd(), "docs", "design-reference");

type Snap = {
  viewerId: string;
  tableId?: string;
  setup?: { joinUrl: string | null; members?: { userId: string; isOwner?: boolean }[] };
  player?: { boxes: { id: string; boxNumber: number }[]; available?: { label: string } };
  poker?: {
    phase: string;
    currentActorId: string | null;
    legalActions: { type: string; label: string }[];
    viewerId?: string;
    available?: { label: string; millis: string };
    seats?: { userId: string; available: { label: string } }[];
    winners?: { userId: string; name: string; amount: { label: string } }[];
  };
  members?: { userId: string; available: { label: string } | null }[];
};

async function snapshot(page: Page): Promise<Snap> {
  const match = page.url().match(/\/tables\/([^/?#]+)/);
  if (!match) throw new Error(`Expected a table URL, received ${page.url()}`);
  const response = await page.request.get(`/api/tables/${match[1]}/snapshot`);
  if (!response.ok()) {
    throw new Error(`snapshot ${response.status()} from ${page.url()}`);
  }
  return response.json() as Promise<Snap>;
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, name) });
}

async function contactSheet(page: Page, file: string, boardFile: string, tiles: { src: string; label: string }[]) {
  const board = (await readFile(join(boards, boardFile))).toString("base64");
  const mime = boardFile.endsWith(".jpg") ? "image/jpeg" : "image/png";
  const images = await Promise.all(
    tiles.map(async (tile) => ({
      ...tile,
      data: (await readFile(join(out, tile.src))).toString("base64"),
    })),
  );
  await page.setViewportSize({ width: 1400, height: 900 });
  const cols = tiles.length > 4 ? 3 : 2;
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#06140f;color:#f4ead5;font-family:Georgia,serif">
    <div style="padding:16px 20px;font-size:22px;letter-spacing:.12em">${file.replace(".png", "").replaceAll("-", " ").toUpperCase()}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:0 16px 16px">
      <figure style="margin:0;background:#0b241c;padding:12px;border:1px solid #dfbd69">
        <img src="data:${mime};base64,${board}" style="width:100%;height:auto"/>
        <figcaption style="margin-top:8px">AUTHORITY BOARD</figcaption>
      </figure>
      <div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:10px">
        ${images
          .map(
            (img) => `<figure style="margin:0;background:#0b241c;padding:8px;border:1px solid #dfbd69">
              <img src="data:image/png;base64,${img.data}" style="width:100%;height:auto"/>
              <figcaption style="margin-top:6px;font-size:12px">${img.label}</figcaption>
            </figure>`,
          )
          .join("")}
      </div>
    </div>
  </body></html>`);
  await page.screenshot({ path: join(out, file), fullPage: true });
}

test("approved setup, blackjack, poker screens and owner delete", async ({ page, context, browser }) => {
  test.setTimeout(240_000);
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("p7-own");
  const samEmail = uniqueEmail("p7-sam");
  await openAs(context, page, ownerEmail, "Owner");
  await page.setViewportSize({ width: 390, height: 844 });

  await openSetupSheet(page);
  await page.getByLabel("Table name").fill("Approval table");
  await shot(page, "02-create-table-390x844.png");

  await createBlackjackTable(page, "K's Table", { starting: "200" });
  await shot(page, "03-phase0-blackjack-390x844.png");
  const tableId = page.url().split("/tables/")[1]!.split("?")[0]!;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await samPage.setViewportSize({ width: 390, height: 844 });
  await openAs(samContext, samPage, samEmail, "Sam");
  const setup = await snapshot(page);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/WAITING FOR PLAYERS|Waiting for the Bank/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await shot(page, "03-phase0-blackjack-joined-390x844.png");

  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await samPage.reload();
  await expect(samPage.getByText("YOUR JETONS")).toBeVisible();
  await samPage.getByRole("button", { name: "START ADDITIONAL BOX" }).click();
  await samPage.getByRole("button", { name: /YOUR BOX 1/ }).click();
  await samPage.getByPlaceholder("Amount").fill("25");
  await samPage.getByRole("button", { name: "PLACE BET", exact: true }).click();
  await expect(samPage.getByRole("button", { name: /YOUR BOX 1/ })).toContainText("25");
  await samPage.getByRole("button", { name: /YOUR BOX 2/ }).click();
  await samPage.getByPlaceholder("Amount").fill("10");
  await samPage.getByRole("button", { name: "PLACE BET", exact: true }).click();
  await expect(samPage.getByRole("button", { name: /YOUR BOX 2/ })).toContainText("10");
  await shot(samPage, "06-bj-player-betting-390x844.png");
  await shot(page, "10-bj-dealer-betting-390x844.png");

  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await samPage.reload();
  await shot(samPage, "07-bj-player-playing-390x844.png");
  await shot(page, "11-bj-dealer-playing-390x844.png");

  await page.getByRole("button", { name: "Open Insurance" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await samPage.reload();
  await shot(samPage, "08-bj-player-insurance-390x844.png");
  await shot(page, "12-bj-dealer-insurance-390x844.png");
  const boxes = (await snapshot(samPage)).player?.boxes ?? [];
  await samPage.locator(`[data-box-id="${boxes[0]!.id}"]`).click();
  await samPage.getByRole("button", { name: "PLACE INSURANCE" }).click();
  await page.getByRole("button", { name: "Close Insurance" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await page.locator(`[data-box-id="${boxes[0]!.id}"]`).getByRole("button", { name: "WON" }).click();
  await page.locator(`[data-box-id="${boxes[1]!.id}"]`).getByRole("button", { name: "LOST" }).click();
  await page.getByRole("button", { name: "INS LOST" }).click();
  await samPage.reload();
  await expect(samPage.locator("[data-payout-box=true]").first()).toBeVisible();
  await expect(samPage.locator("[data-payout-main=true]").first()).toBeVisible();
  await expectPlayerPayoutIdle(samPage);
  await shot(samPage, "09-bj-player-payout-390x844.png");
  await shot(samPage, "09-bj-player-payout-insurance-lost-390x844.png");
  await shot(page, "13-bj-dealer-payout-390x844.png");

  await page.getByRole("button", { name: "START NEXT ROUND" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await samPage.reload();
  await samPage.getByRole("button", { name: /YOUR BOX 1/ }).click();
  await samPage.getByPlaceholder("Amount").fill("10");
  await samPage.getByRole("button", { name: "PLACE BET", exact: true }).click();
  await expect(samPage.getByRole("button", { name: /YOUR BOX 1/ })).toContainText("10");
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  const noInsBoxes = (await snapshot(samPage)).player?.boxes ?? [];
  await page.locator(`[data-box-id="${noInsBoxes[0]!.id}"]`).getByRole("button", { name: "LOST" }).click();
  await samPage.reload();
  await expect(samPage.locator("[data-payout-insurance]")).toHaveCount(0);
  await expectPlayerPayoutIdle(samPage);
  await shot(samPage, "09-bj-player-payout-no-insurance-390x844.png");

  await page.getByRole("button", { name: "START NEXT ROUND" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await samPage.reload();
  await samPage.getByRole("button", { name: /YOUR BOX 1/ }).click();
  await samPage.getByPlaceholder("Amount").fill("20");
  await samPage.getByRole("button", { name: "PLACE BET", exact: true }).click();
  await expect(samPage.getByRole("button", { name: /YOUR BOX 1/ })).toContainText("20");
  await page.getByRole("button", { name: "CLOSE BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await page.getByRole("button", { name: "Open Insurance" }).click();
  await samPage.reload();
  const wonBoxes = (await snapshot(samPage)).player?.boxes ?? [];
  await samPage.locator(`[data-box-id="${wonBoxes[0]!.id}"]`).click();
  await samPage.getByRole("button", { name: "PLACE INSURANCE" }).click();
  await page.getByRole("button", { name: "Close Insurance" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await page.locator(`[data-box-id="${wonBoxes[0]!.id}"]`).getByRole("button", { name: "LOST" }).click();
  await page.getByRole("button", { name: "INS WON" }).click();
  await samPage.reload();
  await expect(samPage.locator("[data-insurance-result*='INSURANCE WON']")).toBeVisible();
  await expectPlayerPayoutIdle(samPage);
  await shot(samPage, "09-bj-player-payout-insurance-won-390x844.png");

  await page.goto("/");
  await shot(page, "01-home-390x844.png");

  await createPokerTable(page, "Hold em table", { starting: "200" });
  const pokerId = page.url().split("/tables/")[1]!.split("?")[0]!;
  const pokerSetup = await snapshot(page);
  const pokerJoin = new URL(pokerSetup.setup!.joinUrl!).pathname;
  const ownerId = pokerSetup.setup?.members?.find((m) => m.isOwner)?.userId ?? pokerSetup.viewerId;
  await samPage.goto(pokerJoin);
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });
  await command(page, pokerId, "giveJetons", { userId: ownerId, amount: "200" });
  await expect(page.getByRole("button", { name: "START HAND" })).toBeEnabled({ timeout: 20_000 });
  await shot(page, "04-phase0-poker-390x844.png");
  await shot(page, "20-poker-dealer-setup-390x844.png");
  await page.getByRole("button", { name: "START HAND" }).click();
  await expectPokerPhase(page, "PRE-FLOP");
  await samPage.reload();
  await shot(page, "21-poker-dealer-preflop-390x844.png");

  async function actorPage() {
    const snap = await snapshot(page);
    return snap.poker?.currentActorId === snap.viewerId ? page : samPage;
  }
  async function matchStreet() {
    for (let i = 0; i < 16; i++) {
      await page.reload();
      if (samPage.url().includes("/tables/")) await samPage.reload();
      const ready = ["DEAL FLOP", "DEAL TURN", "DEAL RIVER", "SHOWDOWN"];
      for (const name of ready) {
        const btn = page.getByRole("button", { name, exact: true });
        if ((await btn.count()) && (await btn.isEnabled())) return;
      }
      const actor = await actorPage();
      const legal = (await snapshot(actor)).poker?.legalActions.map((action) => action.type) ?? [];
      if (legal.includes("CHECK")) await command(actor, pokerId, "pokerAct", { type: "CHECK" });
      else if (legal.includes("CALL")) await command(actor, pokerId, "pokerAct", { type: "CALL" });
    }
  }

  const first = await actorPage();
  await expect(first.getByRole("button", { name: /CALL/ })).toBeVisible();
  await shot(first, "14-poker-player-call-390x844.png");
  await first.getByRole("button", { name: "RAISE" }).click();
  await shot(first, "16-poker-player-raise-composer-390x844.png");
  await command(first, pokerId, "pokerAct", { type: "CALL" });
  await page.reload();
  await samPage.reload();
  const second = await actorPage();
  if (await second.getByRole("button", { name: "CHECK" }).count()) {
    await shot(second, "15-poker-player-check-390x844.png");
  } else {
    await shot(page, "15-poker-player-check-390x844.png");
  }
  await matchStreet();
  await expect(page.getByRole("button", { name: "DEAL FLOP" })).toBeEnabled({ timeout: 20_000 });
  await shot(page, "22-poker-dealer-street-390x844.png");
  await page.getByRole("button", { name: "DEAL FLOP" }).click();
  await expectPokerPhase(page, "FLOP");
  await samPage.reload();
  await shot(samPage, "17-poker-player-street-390x844.png");
  for (const deal of ["DEAL TURN", "DEAL RIVER", "SHOWDOWN"] as const) {
    await matchStreet();
    await expect(page.getByRole("button", { name: deal })).toBeEnabled({ timeout: 20_000 });
    await page.getByRole("button", { name: deal }).click();
  }
  await expectPokerPhase(page, "SHOWDOWN");
  await shot(page, "23-poker-dealer-showdown-390x844.png");
  await shot(samPage, "18-poker-player-showdown-390x844.png");
  const winnerBtn = page.locator(".poker-pot-assign button").first();
  if (await winnerBtn.count()) await winnerBtn.click();
  await page.getByRole("button", { name: "AWARD POT" }).click();
  await expectPokerPhase(page, "HAND COMPLETE");
  await samPage.reload();
  await shot(page, "24-poker-dealer-complete-390x844.png");
  await shot(samPage, "19-poker-player-complete-390x844.png");
  const complete = await snapshot(samPage);
  const wallet = samPage.locator("[data-player-wallet]");
  const walletLabel = await wallet.getAttribute("data-wallet-available");
  const viewerSeat = complete.poker?.seats?.find((seat) => seat.userId === complete.viewerId);
  expect(walletLabel).toBe(complete.poker?.available?.label);
  expect(walletLabel).toBe(viewerSeat?.available.label);
  await expect(samPage.locator("[data-viewer-seat=true]")).toHaveAttribute("data-seat-available", walletLabel ?? "");
  await expect(samPage.getByText(/WON \d+/)).toHaveCount(1);
  const seatTotal = (complete.poker?.seats ?? []).reduce((sum, seat) => sum + Number(seat.available.label), 0);
  expect(seatTotal).toBeGreaterThan(0);
  await samPage.reload();
  await expect(samPage.locator("[data-player-wallet]")).toHaveAttribute("data-wallet-available", walletLabel ?? "");
  const again = await snapshot(samPage);
  const seatTotalAfter = (again.poker?.seats ?? []).reduce((sum, seat) => sum + Number(seat.available.label), 0);
  expect(seatTotalAfter).toBe(seatTotal);

  await page.goto("/");
  const card = page.locator("[data-table-id]").filter({ hasText: "K's Table" }).first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Table menu" }).click();
  await page.getByRole("button", { name: "CLOSE TABLE" }).click();
  await expect(page.getByText("Historical archival.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(card).toHaveAttribute("data-closed", "true");
  await expect(card.getByText("Closed · balances saved")).toBeVisible();
  await card.getByRole("button", { name: "Table menu" }).click();
  await page.getByRole("button", { name: "DELETE" }).click();
  await expect(page.getByText("Closed table removal. Ledger and rounds are kept.")).toBeVisible();
  await shot(page, "05-closed-delete-390x844.png");
  await page.getByRole("button", { name: "Cancel" }).click();

  await contactSheet(page, "setup-contact-sheet.png", "table-owner-setup.jpg", [
    { src: "01-home-390x844.png", label: "1 Home" },
    { src: "02-create-table-390x844.png", label: "2 Create Table" },
    { src: "03-phase0-blackjack-390x844.png", label: "3 Phase 0 empty" },
    { src: "03-phase0-blackjack-joined-390x844.png", label: "3b Phase 0 joined" },
    { src: "04-phase0-poker-390x844.png", label: "4 Phase 0 Poker ready" },
    { src: "05-closed-delete-390x844.png", label: "5 Closed Owner Delete" },
  ]);
  await contactSheet(page, "blackjack-player-contact-sheet.png", "blackjack-player-phases.jpg", [
    { src: "06-bj-player-betting-390x844.png", label: "Player Betting" },
    { src: "07-bj-player-playing-390x844.png", label: "Player Playing" },
    { src: "08-bj-player-insurance-390x844.png", label: "Player Insurance" },
    { src: "09-bj-player-payout-insurance-lost-390x844.png", label: "Payout insurance lost" },
    { src: "09-bj-player-payout-no-insurance-390x844.png", label: "Payout no insurance" },
    { src: "09-bj-player-payout-insurance-won-390x844.png", label: "Payout insurance won" },
  ]);
  await contactSheet(page, "blackjack-dealer-contact-sheet.png", "blackjack-dealer-owner-phases.jpg", [
    { src: "10-bj-dealer-betting-390x844.png", label: "Dealer Betting" },
    { src: "11-bj-dealer-playing-390x844.png", label: "Dealer Playing" },
    { src: "12-bj-dealer-insurance-390x844.png", label: "Dealer Insurance" },
    { src: "13-bj-dealer-payout-390x844.png", label: "Dealer Payout" },
  ]);
  await contactSheet(page, "poker-player-contact-sheet.png", "poker-player-phases.jpg", [
    { src: "14-poker-player-call-390x844.png", label: "Player Call" },
    { src: "15-poker-player-check-390x844.png", label: "Player Check" },
    { src: "16-poker-player-raise-composer-390x844.png", label: "Player Raise Composer" },
    { src: "17-poker-player-street-390x844.png", label: "Player Street" },
    { src: "18-poker-player-showdown-390x844.png", label: "Player Showdown" },
    { src: "19-poker-player-complete-390x844.png", label: "Player Complete" },
  ]);
  await contactSheet(page, "poker-dealer-contact-sheet.png", "poker-dealer-owner-phases.jpg", [
    { src: "20-poker-dealer-setup-390x844.png", label: "Dealer Setup" },
    { src: "21-poker-dealer-preflop-390x844.png", label: "Dealer Pre-Flop" },
    { src: "22-poker-dealer-street-390x844.png", label: "Dealer Street Ready" },
    { src: "23-poker-dealer-showdown-390x844.png", label: "Dealer Showdown" },
    { src: "24-poker-dealer-complete-390x844.png", label: "Dealer Complete" },
  ]);

  await samContext.close();
});
