import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  addLocalPlayerFromMenu,
  createBlackjackTable,
  createPokerTable,
  expectNoDocumentScroll,
  expectPlayerPayoutIdle,
  openAs,
  uniqueEmail,
} from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "classic-rebuild");
const approved = join(process.cwd(), "design", "reference", "classic", "approved");
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;

async function snapshot(page: Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<{
    player?: { available: { label: string }; boxes: { id: string; boxNumber: number; bet: { label: string }; outcome?: string | null }[] };
    bank?: { boxes: { id: string }[] };
    setup?: { joinUrl: string | null };
    phase?: string;
    poker?: { phase: string };
  }>;
}

async function capture(page: Page, name: string) {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectNoDocumentScroll(page);
    await page.screenshot({ path: join(shots, `${name}-${viewport.width}x${viewport.height}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(shots, `${name}-1440x900.png`) });
  await page.setViewportSize({ width: 390, height: 844 });
}

async function contactSheet(
  page: Page,
  file: string,
  boardFile: string,
  tiles: { src: string; label: string }[],
) {
  const board = (await readFile(join(approved, boardFile))).toString("base64");
  const images = await Promise.all(
    tiles.map(async (tile) => ({
      ...tile,
      data: (await readFile(join(shots, tile.src))).toString("base64"),
    })),
  );
  await page.setViewportSize({ width: 1480, height: 900 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#06140f;color:#f4ead5;font-family:Georgia,serif">
    <div style="padding:16px 20px;font-size:20px;letter-spacing:.08em">${file.replace(".png", "").replaceAll("-", " ").toUpperCase()}</div>
    <div style="display:grid;gap:14px;padding:0 16px 16px">
      ${images
        .map(
          (img) => `<figure style="margin:0;display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#0b241c;padding:10px;border:1px solid #dfbd69">
            <div>
              <img src="data:image/png;base64,${board}" style="width:100%;height:auto"/>
              <figcaption style="margin-top:6px;font-size:12px">APPROVED REFERENCE</figcaption>
            </div>
            <div>
              <img src="data:image/png;base64,${img.data}" style="width:100%;height:auto"/>
              <figcaption style="margin-top:6px;font-size:12px">${img.label}</figcaption>
            </div>
          </figure>`,
        )
        .join("")}
    </div>
  </body></html>`);
  await page.screenshot({ path: join(shots, file), fullPage: true });
}

test("Classic reconstruction screens and contact sheets", async ({ page, context, browser }) => {
  test.setTimeout(360_000);
  await mkdir(shots, { recursive: true });
  const ownerEmail = uniqueEmail("rebuild-home");
  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(context, page, ownerEmail, "Alex");

  await createBlackjackTable(page, "Salon one", { starting: "100" });
  await page.goto("/");
  await createBlackjackTable(page, "Salon two", { starting: "100" });
  await page.goto("/");
  await createBlackjackTable(page, "Salon three", { starting: "100" });
  await page.goto("/");
  await createBlackjackTable(page, "Salon four", { starting: "100" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SAVED TABLES" })).toBeVisible();
  await expect(page.getByText("Resume a table or create a new one.")).toBeVisible();
  await expect(page.locator("[data-table-id]")).toHaveCount(4);
  await capture(page, "01-home-four-tables");

  const card = page.locator("[data-table-id]").first();
  const box = await card.boundingBox();
  if (!box) throw new Error("saved-table card has no box");
  await page.mouse.move(box.x + box.width - 16, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(card.locator("[data-home-delete], [data-home-end-delete]").first()).toBeVisible();
  await capture(page, "02-home-swipe-reveal");

  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page.getByRole("heading", { name: "CREATE TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await capture(page, "03-create-table-collapsed");
  await page.getByRole("tab", { name: "GUEST QR" }).click();
  await expect(page.getByAltText(/Guest QR/i)).toBeVisible();
  await capture(page, "04-create-table-guest-qr");

  const playerEmail = uniqueEmail("rebuild-player");
  await page.goto("/");
  await createBlackjackTable(page, "Salon table", { starting: "100" });
  const setup = await snapshot(page);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await playerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(joinPath);
  await expect(playerPage.getByText(/Waiting for the table to open betting/i)).toBeVisible();
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });

  await capture(page, "05-dealer-phase0-one-player");
  await capture(playerPage, "12-player-waiting");

  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Betting open");
  await playerPage.reload();
  await expect(playerPage.locator("[data-phase-heading]")).toHaveText("Betting is open.");
  await capture(page, "06-dealer-betting-one-player");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(shots, "21-desktop-centred-frame-1440x900.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(playerPage, "13-player-betting-empty");

  await playerPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.available.label).toBe("75");
  await capture(playerPage, "14-player-betting-placed");

  await playerPage.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(playerPage)).player?.boxes.length).toBe(2);
  await capture(playerPage, "15-player-betting-two-boxes");

  await expect(page.getByRole("button", { name: "DEAL CARDS" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await playerPage.reload();
  await expect(playerPage.getByRole("button", { name: "2×" })).toBeVisible();
  await capture(page, "08-dealer-playing");
  await capture(playerPage, "16-player-playing");

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await capture(page, "09-dealer-insurance");
  await playerPage.reload();
  await capture(playerPage, "17-player-insurance");
  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();

  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeDisabled();
  await capture(page, "10-dealer-payout-unresolved");
  const boxId = (await snapshot(page)).bank?.boxes[0]?.id;
  await page.locator(boxId ? `[data-box-id="${boxId}"]` : "[data-blackjack-box-row]").getByRole("button", { name: "WON" }).first().click();
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 10_000 });
  await playerPage.reload();
  await expectPlayerPayoutIdle(playerPage);
  await capture(page, "11-dealer-payout-resolved");
  await capture(playerPage, "18-player-payout");
  await playerContext.close();

  await page.goto("/");
  await createBlackjackTable(page, "Four seat", { starting: "100" });
  const fourSetup = await snapshot(page);
  const fourJoin = new URL(fourSetup.setup!.joinUrl!).pathname;
  const fourContext = await browser.newContext();
  const fourPage = await fourContext.newPage();
  await fourPage.setViewportSize({ width: 390, height: 844 });
  await openAs(fourContext, fourPage, uniqueEmail("rebuild-four"), "Sam");
  await fourPage.goto(fourJoin);
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });
  await addLocalPlayerFromMenu(page, "Jo");
  await addLocalPlayerFromMenu(page, "Casey");
  await addLocalPlayerFromMenu(page, "Riley");
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("Betting open");
  await expect(page.locator("[data-dealer-positions]")).toHaveAttribute("data-player-count", "4");
  await capture(page, "07-dealer-betting-four-players");
  await fourContext.close();

  await page.goto("/");
  await createPokerTable(page, "Poker felt", { starting: "100" });
  const pokerSetup = await snapshot(page);
  const pokerJoin = new URL(pokerSetup.setup!.joinUrl!).pathname;
  const pokerContext = await browser.newContext();
  const pokerPage = await pokerContext.newPage();
  await pokerPage.setViewportSize({ width: 390, height: 844 });
  await openAs(pokerContext, pokerPage, uniqueEmail("rebuild-poker"), "Sam");
  await pokerPage.goto(pokerJoin);
  await expect(page.getByText("Sam").first()).toBeVisible({ timeout: 20_000 });
  const startHand = page.getByRole("button", { name: "START HAND", exact: true });
  if (await startHand.isEnabled()) {
    await startHand.click();
    await expect(page.locator("[data-phase-heading]")).not.toHaveText("Table setup", { timeout: 20_000 });
    await pokerPage.reload();
  }
  await capture(page, "19-poker-dealer");
  await capture(pokerPage, "20-poker-player");
  await pokerContext.close();

  await contactSheet(page, "contact-home-create.png", "table-owner-setup.png", [
    { src: "01-home-four-tables-390x844.png", label: "1 Home four tables" },
    { src: "02-home-swipe-reveal-390x844.png", label: "2 Home swipe reveal" },
    { src: "03-create-table-collapsed-390x844.png", label: "3 Create Table collapsed" },
    { src: "04-create-table-guest-qr-390x844.png", label: "4 Create Table Guest QR" },
  ]);
  await contactSheet(page, "contact-dealer.png", "blackjack-dealer-owner-phases.png", [
    { src: "05-dealer-phase0-one-player-390x844.png", label: "5 Dealer Phase 0" },
    { src: "06-dealer-betting-one-player-390x844.png", label: "6 Dealer Betting 1" },
    { src: "07-dealer-betting-four-players-390x844.png", label: "7 Dealer Betting 4" },
    { src: "08-dealer-playing-390x844.png", label: "8 Dealer Playing" },
    { src: "09-dealer-insurance-390x844.png", label: "9 Dealer Insurance" },
    { src: "10-dealer-payout-unresolved-390x844.png", label: "10 Dealer Payout unresolved" },
    { src: "11-dealer-payout-resolved-390x844.png", label: "11 Dealer Payout resolved" },
    { src: "21-desktop-centred-frame-1440x900.png", label: "21 Desktop centred frame" },
  ]);
  await contactSheet(page, "contact-player.png", "blackjack-player-phases.png", [
    { src: "12-player-waiting-390x844.png", label: "12 Player Waiting" },
    { src: "13-player-betting-empty-390x844.png", label: "13 Player Betting empty" },
    { src: "14-player-betting-placed-390x844.png", label: "14 Player Betting placed" },
    { src: "15-player-betting-two-boxes-390x844.png", label: "15 Player two boxes" },
    { src: "16-player-playing-390x844.png", label: "16 Player Playing" },
    { src: "17-player-insurance-390x844.png", label: "17 Player Insurance" },
    { src: "18-player-payout-390x844.png", label: "18 Player Payout" },
  ]);
  await contactSheet(page, "contact-poker.png", "blackjack-player-phases.png", [
    { src: "19-poker-dealer-390x844.png", label: "19 Poker Dealer" },
    { src: "20-poker-player-390x844.png", label: "20 Poker Player" },
  ]);
});
