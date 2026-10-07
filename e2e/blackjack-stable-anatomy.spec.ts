import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  expectNoDocumentScroll,
  openAs,
  setupJoinUrl,
  uniqueEmail,
} from "./helpers";

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "blackjack-stable-anatomy");

type Snap = {
  player?: {
    available: { label: string };
    boxes: { id: string; boxNumber: number; bet: { label: string }; playerId?: string }[];
  };
  bank?: { phase: string; boxes: { id: string; boxNumber: number }[] };
  phase?: string;
};

async function snapshot(page: Page): Promise<Snap> {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((r) => r.json());
}

async function shot(page: Page, name: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(shots, `${name}-390x844.png`), fullPage: false });
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const felt = document.querySelector("[data-bj-felt]") as HTMLElement | null;
    const dealer = document.querySelector("[data-dealer-slot]") as HTMLElement | null;
    const name = document.querySelector("[data-table-name]") as HTMLElement | null;
    const boxes = document.querySelector("[data-dealer-boxes]") as HTMLElement | null;
    const box = (el: HTMLElement | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return { felt: box(felt), dealer: box(dealer), name: box(name), boxes: box(boxes) };
  });
}

function delta(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return {
    x: Math.abs(a.x - b.x),
    y: Math.abs(a.y - b.y),
    w: Math.abs(a.w - b.w),
    h: Math.abs(a.h - b.h),
  };
}

test("Blackjack stable dealer anatomy + retract X + screenshots", async ({ page, context, browser }) => {
  test.setTimeout(240_000);
  await mkdir(shots, { recursive: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(context, page, uniqueEmail("anat-own"), "Dee");
  await createBlackjackTable(page, "Anatomy Salon", { starting: "100" });

  await expect(page.locator('[data-table-board="BLACKJACK_DEALER"]')).toBeVisible();
  await expect(page.locator('[data-bj-felt="true"]')).toBeVisible();
  await expect(page.locator('[data-dealer-slot="true"]')).toBeVisible();
  await expect(page.locator("[data-dealer-boxes]")).toBeVisible();
  await expect(page.locator("[data-phase-heading]")).toHaveText("TABLE SETUP");
  await expect(page.getByText("Invite a Player to begin.")).toBeVisible();
  await expect(page.locator("[data-table-name]")).toHaveCount(1);
  await expect(page.locator(".tt-setup-ledger")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeDisabled();
  await expectNoDocumentScroll(page);
  await shot(page, "01-dealer-phase0-empty");
  const g0 = await geometry(page);
  expect(g0.dealer).toBeTruthy();
  expect(g0.felt).toBeTruthy();

  const guestUrl = await setupJoinUrl(page, "guest");
  async function joinGuest(name: string) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(new URL(guestUrl, page.url()).pathname);
    await p.getByLabel("Play name").fill(name);
    await p.getByRole("button", { name: "Join table" }).click();
    return { ctx, page: p };
  }

  const casey = await joinGuest("Casey");
  await expect(casey.page.getByText(/Waiting for the (Dealer|table) to open betting/i)).toBeVisible({ timeout: 20_000 });
  const riley = await joinGuest("Riley");
  await expect(riley.page.getByText(/Waiting for the (Dealer|table) to open betting/i)).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByText("Casey")).toBeVisible();
  await expect(page.locator('[data-dealer-slot="true"]')).toBeVisible();
  await shot(page, "02-dealer-phase0-joined");
  const g1 = await geometry(page);
  expect(delta(g0.dealer!, g1.dealer!).x).toBeLessThanOrEqual(8);
  expect(delta(g0.dealer!, g1.dealer!).y).toBeLessThanOrEqual(8);
  expect(delta(g0.dealer!, g1.dealer!).w).toBeLessThanOrEqual(8);
  expect(delta(g0.dealer!, g1.dealer!).h).toBeLessThanOrEqual(8);
  expect(delta(g0.felt!, g1.felt!).w).toBeLessThanOrEqual(8);

  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");

  await casey.page.reload();
  await expect(casey.page.getByText("YOUR JETONS")).toBeVisible();
  await casey.page.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.available.label).toBe("75");
  await expect(casey.page.getByRole("button", { name: "Retract Box 1 wager" })).toBeVisible();
  const chip = await casey.page.locator(".tt-pbox-chips .tt-jeton-lg").first().boundingBox();
  expect(chip).toBeTruthy();
  expect(chip!.width).toBeGreaterThanOrEqual(46);
  expect(chip!.width).toBeLessThanOrEqual(56);
  await shot(casey.page, "09-player-betting-one-wager-retract-x");

  await expect(page.locator("[data-box-id]").first()).toBeVisible();
  await shot(page, "03-dealer-betting-one-wager");
  const gBet = await geometry(page);
  expect(delta(g0.dealer!, gBet.dealer!).x).toBeLessThanOrEqual(8);
  expect(delta(g0.dealer!, gBet.dealer!).y).toBeLessThanOrEqual(8);
  expect(delta(g0.dealer!, gBet.dealer!).w).toBeLessThanOrEqual(8);
  expect(delta(g0.dealer!, gBet.dealer!).h).toBeLessThanOrEqual(8);

  // Retract X: available returns, MAIN clears, other boxes unaffected
  await casey.page.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.boxes.length).toBe(2);
  const boxes = (await snapshot(casey.page)).player!.boxes;
  const b1 = boxes.find((b) => b.boxNumber === 1)!;
  const b2 = boxes.find((b) => b.boxNumber === 2)!;
  await casey.page.locator(`[data-box-id="${b2.id}"]`).click();
  await casey.page.getByRole("button", { name: "Add 10 jetons" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.available.label).toBe("65");
  await shot(casey.page, "10-player-betting-two-boxes");

  await casey.page.getByRole("button", { name: "Retract Box 1 wager" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.available.label).toBe("90");
  await expect.poll(async () => {
    const snap = await snapshot(casey.page);
    const one = snap.player?.boxes.find((b) => b.boxNumber === 1);
    const two = snap.player?.boxes.find((b) => b.boxNumber === 2);
    return `${one?.bet.label}:${two?.bet.label}`;
  }).toBe("0:10");
  await expect(casey.page.getByRole("button", { name: "Retract Box 1 wager" })).toHaveCount(0);
  await expect(casey.page.getByRole("button", { name: "Retract Box 2 wager" })).toBeVisible();

  await casey.page.reload();
  await expect.poll(async () => {
    const snap = await snapshot(casey.page);
    return `${snap.player?.available.label}:${snap.player?.boxes.find((b) => b.boxNumber === 1)?.bet.label}:${snap.player?.boxes.find((b) => b.boxNumber === 2)?.bet.label}`;
  }).toBe("90:0:10");

  // Restore Casey box 1; Riley adds two boxes → four dealer wager boxes
  await casey.page.locator(`[data-box-id="${b1.id}"]`).click();
  await casey.page.getByRole("button", { name: "Add 25 jetons" }).click();
  await expect.poll(async () => (await snapshot(casey.page)).player?.available.label).toBe("65");

  await riley.page.reload();
  await expect(riley.page.getByText("YOUR JETONS")).toBeVisible();
  await riley.page.getByRole("button", { name: "Add 25 jetons" }).click();
  await riley.page.getByRole("button", { name: "ADD BOX" }).click();
  await expect.poll(async () => (await snapshot(riley.page)).player?.boxes.length).toBe(2);
  const rileyBoxes = (await snapshot(riley.page)).player!.boxes;
  const r2 = rileyBoxes.find((b) => b.boxNumber === 2)!;
  await riley.page.locator(`[data-box-id="${r2.id}"]`).click();
  await riley.page.getByRole("button", { name: "Add 10 jetons" }).click();
  await expect.poll(async () => (await snapshot(page)).bank?.boxes.length ?? 0).toBe(4);
  await shot(page, "04-dealer-betting-four-wagers");

  // Dealer must not see player retract X; Riley must not see Casey's X
  await expect(page.getByRole("button", { name: /Retract Box/i })).toHaveCount(0);
  await expect(riley.page.getByRole("button", { name: "Retract Box 1 wager" })).toBeVisible();
  await expect(casey.page.getByRole("button", { name: /Retract Box/i })).not.toHaveCount(0);

  await page.getByRole("button", { name: "DEAL CARDS" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await expect(page.locator('[data-dealer-slot="true"]')).toBeVisible();
  await expect(casey.page.getByRole("button", { name: /Retract Box/i })).toHaveCount(0);
  await shot(page, "05-dealer-playing");
  await casey.page.reload();
  await expect(casey.page.locator(".tt-pbox-chips .tt-jeton-lg").first()).toBeVisible();
  await shot(casey.page, "11-player-playing");
  const gPlay = await geometry(page);
  expect(delta(g0.dealer!, gPlay.dealer!).x).toBeLessThanOrEqual(8);
  expect(delta(g0.dealer!, gPlay.dealer!).y).toBeLessThanOrEqual(8);
  expect(delta(g0.dealer!, gPlay.dealer!).w).toBeLessThanOrEqual(8);
  expect(delta(g0.dealer!, gPlay.dealer!).h).toBeLessThanOrEqual(8);

  await page.getByRole("button", { name: "OPEN INSURANCE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("INSURANCE");
  await expect(casey.page.getByRole("button", { name: /Retract Box/i })).toHaveCount(0);
  await shot(page, "06-dealer-insurance");
  await casey.page.reload();
  await shot(casey.page, "12-player-insurance");
  const gIns = await geometry(page);
  expect(delta(g0.dealer!, gIns.dealer!).h).toBeLessThanOrEqual(8);

  await page.getByRole("button", { name: "CLOSE INSURANCE" }).click();
  await page.getByRole("button", { name: "ENTER PAYOUT" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.locator('[data-dealer-boxes="true"]')).toBeVisible();
  await expect(page.locator(".tt-setup-ledger")).toHaveCount(0);
  await expect(casey.page.getByRole("button", { name: /Retract Box/i })).toHaveCount(0);
  await shot(page, "07-dealer-payout-unresolved");
  const gPayU = await geometry(page);
  expect(delta(g0.dealer!, gPayU.dealer!).x).toBeLessThanOrEqual(8);
  expect(delta(g0.dealer!, gPayU.dealer!).y).toBeLessThanOrEqual(8);

  const bankBoxes = (await snapshot(page)).bank?.boxes ?? [];
  for (const box of bankBoxes) {
    const slot = page.locator(`[data-settle-box="${box.id}"]`);
    await slot.locator('[data-payout-action="true"]').filter({ hasText: /^LOST$/ }).click();
  }
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeEnabled({ timeout: 15_000 });
  await shot(page, "08-dealer-payout-resolved");
  await casey.page.reload();
  await shot(casey.page, "13-player-payout");
  const gPayR = await geometry(page);
  expect(delta(g0.dealer!, gPayR.dealer!).w).toBeLessThanOrEqual(8);
  expect(delta(g0.felt!, gPayR.felt!).w).toBeLessThanOrEqual(8);

  // Responsive overflow
  for (const [w, h] of [
    [360, 800],
    [390, 844],
    [430, 932],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expectNoDocumentScroll(page);
    await casey.page.setViewportSize({ width: w, height: h });
    await expectNoDocumentScroll(casey.page);
  }

  // Contact sheet of dealer states 1–8
  const { readFileSync } = await import("node:fs");
  const names = [
    "01-dealer-phase0-empty",
    "02-dealer-phase0-joined",
    "03-dealer-betting-one-wager",
    "04-dealer-betting-four-wagers",
    "05-dealer-playing",
    "06-dealer-insurance",
    "07-dealer-payout-unresolved",
    "08-dealer-payout-resolved",
  ];
  const sheet = await browser.newPage();
  await sheet.setViewportSize({ width: 390 * 4 + 48, height: 844 * 2 + 80 });
  const imgs = names
    .map((n, i) => {
      const b64 = readFileSync(join(shots, `${n}-390x844.png`)).toString("base64");
      return `<figure style="margin:0"><img src="data:image/png;base64,${b64}" width="390" height="844"/><figcaption>${i + 1}. ${n}</figcaption></figure>`;
    })
    .join("");
  await sheet.setContent(
    `<html><body style="margin:0;background:#111;color:#eee;font:12px sans-serif">
      <div style="display:grid;grid-template-columns:repeat(4,390px);gap:12px;padding:16px">${imgs}</div>
    </body></html>`,
  );
  await sheet.screenshot({ path: join(shots, "contact-sheet-dealer-1-8.png"), fullPage: true });
  await writeFile(join(shots, "README.txt"), `Blackjack stable anatomy shots\n${names.join("\n")}\n`, "utf8");
  await sheet.close();

  await casey.ctx.close();
  await riley.ctx.close();
});
