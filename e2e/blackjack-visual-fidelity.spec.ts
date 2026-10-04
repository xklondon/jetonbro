import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  addLocalPlayerFromMenu,
  createBlackjackTable,
  expectNoDocumentScroll,
  expectPlayerPayoutIdle,
  openAs,
  uniqueEmail,
} from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "blackjack-visual");
const approved = join(process.cwd(), "design", "reference", "classic", "approved");

async function snapshot(page: Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<{
    player?: { available: { label: string }; boxes: { id: string; boxNumber: number; bet: { label: string } }[] };
    bank?: { boxes: { id: string }[] };
    setup?: { joinUrl: string | null };
  }>;
}

async function overflowCheck(page: Page) {
  await page.setViewportSize({ width: 360, height: 800 });
  await expectNoDocumentScroll(page);
  await page.setViewportSize({ width: 430, height: 932 });
  await expectNoDocumentScroll(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoDocumentScroll(page);
}

async function shot(page: Page, name: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(shots, `${name}-390x844.png`) });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: join(shots, `${name}-360x800.png`) });
  await page.setViewportSize({ width: 430, height: 932 });
  await page.screenshot({ path: join(shots, `${name}-430x932.png`) });
  await page.setViewportSize({ width: 390, height: 844 });
}

async function pairSheet(
  page: Page,
  file: string,
  boardFile: string,
  position: string,
  impl: string,
  label: string,
) {
  const board = (await readFile(join(approved, boardFile))).toString("base64");
  const live = (await readFile(join(shots, impl))).toString("base64");
  await page.setViewportSize({ width: 828, height: 920 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#06140f;color:#dfbd69;font-family:Georgia,serif">
    <div style="display:grid;grid-template-columns:390px 390px;gap:24px;padding:24px 24px 20px">
      <figure style="margin:0">
        <figcaption style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Approved — ${label}</figcaption>
        <img src="data:image/png;base64,${board}" style="width:390px;height:844px;object-fit:cover;object-position:${position};border-radius:12px;background:#000"/>
      </figure>
      <figure style="margin:0">
        <figcaption style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Implementation — ${label}</figcaption>
        <img src="data:image/png;base64,${live}" style="width:390px;height:844px;object-fit:cover;border-radius:12px;background:#000"/>
      </figure>
    </div>
  </body></html>`);
  await page.screenshot({ path: join(shots, file) });
}

test("Blackjack visual fidelity screens and contact sheets", async ({ page, context, browser }) => {
  test.setTimeout(300_000);
  await mkdir(shots, { recursive: true });
  const ownerEmail = uniqueEmail("fidelity-owner");
  const playerEmail = uniqueEmail("fidelity-player");

  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "K's Table", { starting: "100" });

  const joinPath = new URL((await snapshot(page)).setup!.joinUrl!).pathname;
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(joinPath);
  await expect(playerPage.getByText(/Waiting for the table to open betting/i)).toBeVisible();
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });

  await overflowCheck(page);
  await shot(page, "07-dealer-phase0");

  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Betting open");
  await playerPage.reload();
  await expect(playerPage.locator("[data-phase-heading]")).toHaveText("Betting is open.");
  await overflowCheck(page);
  await overflowCheck(playerPage);
  await shot(page, "08-dealer-betting-one-player");
  await shot(playerPage, "01-player-betting-empty");

  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("75");
  await expect(playerPage.locator("[data-box-stage] .amount").first()).toHaveText("25");
  await shot(playerPage, "02-player-betting-25");

  await playerPage.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.length).toBe(2);
  await expect(playerPage.locator("[data-box-stage] .box")).toHaveCount(2);
  await shot(playerPage, "03-player-betting-two-boxes");

  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await playerPage.reload();
  await expect(playerPage.getByRole("button", { name: "2×" })).toBeVisible();
  await overflowCheck(page);
  await overflowCheck(playerPage);
  await shot(page, "10-dealer-playing");
  await shot(playerPage, "04-player-playing");

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await playerPage.reload();
  await shot(page, "11-dealer-insurance");
  await shot(playerPage, "05-player-insurance");
  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeDisabled();
  await overflowCheck(page);
  await shot(page, "12-dealer-payout-unresolved");
  const boxId = (await snapshot(page)).bank?.boxes[0]?.id;
  await page.locator(boxId ? `[data-box-id="${boxId}"]` : "[data-blackjack-box-row]").getByRole("button", { name: "WON" }).first().click();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 10_000 });
  await playerPage.reload();
  await expectPlayerPayoutIdle(playerPage);
  await shot(page, "13-dealer-payout-resolved");
  await shot(playerPage, "06-player-payout");
  await playerContext.close();

  await page.goto("/");
  await createBlackjackTable(page, "Four seat", { starting: "100" });
  const fourJoin = new URL((await snapshot(page)).setup!.joinUrl!).pathname;
  const fourContext = await browser.newContext();
  const fourPage = await fourContext.newPage();
  await fourPage.setViewportSize({ width: 390, height: 844 });
  await openAs(fourContext, fourPage, uniqueEmail("fidelity-four"), "Sam");
  await fourPage.goto(fourJoin);
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });
  await addLocalPlayerFromMenu(page, "Jo");
  await addLocalPlayerFromMenu(page, "Casey");
  await addLocalPlayerFromMenu(page, "Riley");
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Betting open");
  await expect(page.locator("[data-dealer-positions]")).toHaveAttribute("data-player-count", "4");
  await overflowCheck(page);
  await shot(page, "09-dealer-betting-four-players");
  await fourContext.close();

  const playerBoard = "blackjack-player-phases.png";
  const dealerBoard = "blackjack-dealer-owner-phases.png";
  await pairSheet(page, "pair-01-player-betting-empty.png", playerBoard, "0% 50%", "01-player-betting-empty-390x844.png", "Player Betting empty");
  await pairSheet(page, "pair-02-player-betting-25.png", playerBoard, "0% 50%", "02-player-betting-25-390x844.png", "Player Betting 25");
  await pairSheet(page, "pair-03-player-betting-two-boxes.png", playerBoard, "0% 50%", "03-player-betting-two-boxes-390x844.png", "Player Betting two boxes");
  await pairSheet(page, "pair-04-player-playing.png", playerBoard, "33.4% 50%", "04-player-playing-390x844.png", "Player Playing");
  await pairSheet(page, "pair-05-player-insurance.png", playerBoard, "66.6% 50%", "05-player-insurance-390x844.png", "Player Insurance");
  await pairSheet(page, "pair-06-player-payout.png", playerBoard, "100% 50%", "06-player-payout-390x844.png", "Player Payout");
  await pairSheet(page, "pair-07-dealer-phase0.png", dealerBoard, "0% 50%", "07-dealer-phase0-390x844.png", "Dealer Phase 0");
  await pairSheet(page, "pair-08-dealer-betting-one.png", dealerBoard, "0% 50%", "08-dealer-betting-one-player-390x844.png", "Dealer Betting one");
  await pairSheet(page, "pair-09-dealer-betting-four.png", dealerBoard, "0% 50%", "09-dealer-betting-four-players-390x844.png", "Dealer Betting four");
  await pairSheet(page, "pair-10-dealer-playing.png", dealerBoard, "33.4% 50%", "10-dealer-playing-390x844.png", "Dealer Playing");
  await pairSheet(page, "pair-11-dealer-insurance.png", dealerBoard, "66.6% 50%", "11-dealer-insurance-390x844.png", "Dealer Insurance");
  await pairSheet(page, "pair-12-dealer-payout-unresolved.png", dealerBoard, "100% 50%", "12-dealer-payout-unresolved-390x844.png", "Dealer Payout unresolved");
  await pairSheet(page, "pair-13-dealer-payout-resolved.png", dealerBoard, "100% 50%", "13-dealer-payout-resolved-390x844.png", "Dealer Payout resolved");
});
