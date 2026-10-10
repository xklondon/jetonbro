import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Milestone 1 — static Premium fixture screenshots only.
 * Does not exercise live tables, commands, or ACTIVE_SKIN_ID.
 */
const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "premium-static");
const approvedPoker = join(process.cwd(), "design", "reference", "tabletop", "approved", "poker-premium-racetrack.png");
const approvedBjPlayer = join(process.cwd(), "design", "reference", "classic", "approved", "blackjack-player-phases.png");
const approvedBjDealer = join(
  process.cwd(),
  "design",
  "reference",
  "classic",
  "approved",
  "blackjack-dealer-owner-phases.png",
);

const FIXTURES = [
  "01-bj-dealer-setup-empty",
  "02-bj-dealer-setup-joined",
  "03-bj-dealer-betting-two-boxes",
  "04-bj-dealer-playing",
  "05-bj-dealer-payout",
  "06-bj-player-betting-one-box",
  "07-bj-player-betting-two-boxes",
  "08-bj-player-playing",
  "09-bj-player-payout",
  "10-poker-heads-up-preflop",
  "11-poker-three-player-flop",
  "12-poker-hand-complete",
] as const;

async function shot(page: Page, name: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(shots, `${name}-390x844.png`), fullPage: false });
}

test("Premium static fixture gallery — 12 screens + contact sheet", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(shots, { recursive: true });

  for (const id of FIXTURES) {
    await page.goto(`/dev/premium?screen=${id}`);
    await expect(page.locator("[data-skin=premium]")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`[data-premium-fixture="${id}"]`)).toBeVisible();
    await shot(page, id);
  }

  // Side-by-side contact: authorities vs selected Premium frames
  const boardPoker = (await readFile(approvedPoker)).toString("base64");
  const boardBjP = (await readFile(approvedBjPlayer)).toString("base64");
  const boardBjD = (await readFile(approvedBjDealer)).toString("base64");
  const live = async (name: string) => (await readFile(join(shots, `${name}-390x844.png`))).toString("base64");

  await page.setViewportSize({ width: 1280, height: 920 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#06140f;color:#dfbd69;font-family:Georgia,serif">
    <div style="padding:20px 24px 12px;font-size:13px;letter-spacing:.08em;text-transform:uppercase">Premium Milestone 1 — authority contact</div>
    <div style="display:grid;grid-template-columns:repeat(3,390px);gap:20px;padding:0 24px 24px">
      <figure style="margin:0">
        <figcaption style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase">Authority — BJ Player board</figcaption>
        <img src="data:image/png;base64,${boardBjP}" style="width:390px;height:844px;object-fit:cover;object-position:left center;border-radius:12px;background:#000"/>
      </figure>
      <figure style="margin:0">
        <figcaption style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase">Premium — Player betting</figcaption>
        <img src="data:image/png;base64,${await live("06-bj-player-betting-one-box")}" style="width:390px;height:844px;object-fit:cover;border-radius:12px;background:#000"/>
      </figure>
      <figure style="margin:0">
        <figcaption style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase">Premium — Dealer payout</figcaption>
        <img src="data:image/png;base64,${await live("05-bj-dealer-payout")}" style="width:390px;height:844px;object-fit:cover;border-radius:12px;background:#000"/>
      </figure>
      <figure style="margin:0">
        <figcaption style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase">Authority — BJ Dealer board</figcaption>
        <img src="data:image/png;base64,${boardBjD}" style="width:390px;height:844px;object-fit:cover;object-position:left center;border-radius:12px;background:#000"/>
      </figure>
      <figure style="margin:0">
        <figcaption style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase">Authority — Poker racetrack</figcaption>
        <img src="data:image/png;base64,${boardPoker}" style="width:390px;height:844px;object-fit:cover;object-position:center;border-radius:12px;background:#000"/>
      </figure>
      <figure style="margin:0">
        <figcaption style="margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase">Premium — Poker heads-up</figcaption>
        <img src="data:image/png;base64,${await live("10-poker-heads-up-preflop")}" style="width:390px;height:844px;object-fit:cover;border-radius:12px;background:#000"/>
      </figure>
    </div>
  </body></html>`);
  await page.screenshot({ path: join(shots, "contact-sheet-authorities.png"), fullPage: true });
});
