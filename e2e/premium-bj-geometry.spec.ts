import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "premium-bj-stable");

const SCREENS = [
  { screen: "01-bj-dealer-setup-empty", name: "01-dealer-setup-empty" },
  { screen: "02-bj-dealer-setup-joined", name: "02-dealer-setup-joined" },
  { screen: "06-bj-player-betting-one-box", name: "03-player-betting-one-box" },
  { screen: "08-bj-player-playing", name: "04-player-playing" },
  { screen: "05-bj-dealer-payout", name: "05-dealer-payout-unresolved" },
] as const;

type Box = { x: number; y: number; w: number; h: number };

async function boxOf(page: Page, selector: string): Promise<Box> {
  const handle = page.locator(selector).first();
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  return { x: box!.x, y: box!.y, w: box!.width, h: box!.height };
}

function within2(a: number, b: number) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(2);
}

async function expectNoDocumentScroll(page: Page) {
  const scroll = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(scroll.x).toBeLessThanOrEqual(1);
  expect(scroll.y).toBeLessThanOrEqual(1);
}

test("Premium Blackjack geometry lock + approval screenshots", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(shots, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });

  const tables: Box[] = [];
  const dealers: Box[] = [];
  const names: Box[] = [];
  const consoles: Box[] = [];

  for (const item of SCREENS) {
    await page.goto(`/dev/premium?screen=${item.screen}`);
    await expect(page.locator('[data-skin="premium"]')).toBeVisible({ timeout: 20_000 });
    await expectNoDocumentScroll(page);

    const table = await boxOf(page, "[data-bj-stage=true]");
    const dealer = await boxOf(page, "[data-dealer-anchor=true]");
    const name = await boxOf(page, "[data-table-name-anchor=true]");
    const consoleBox = await boxOf(page, "[data-casino-console=true]");
    tables.push(table);
    dealers.push(dealer);
    names.push(name);
    consoles.push(consoleBox);

    // Table name once (felt), not also in header title as table name.
    const feltNames = await page.locator("[data-table-name]").count();
    expect(feltNames).toBe(1);
    await expect(page.locator(".pm-header-title")).toHaveText("JETONBRO");

    // Rules only on raster — no duplicate JSX rule nodes.
    expect(await page.locator("text=INSURANCE PAYS 2 TO 1").count()).toBe(0);
    expect(await page.locator("text=BLACKJACK PAYS 3 TO 2").count()).toBe(0);

    if (item.screen.includes("setup")) {
      expect(await page.locator("[data-table-zone=boxes]").count()).toBe(0);
      expect(await page.locator("[data-box-id]").count()).toBe(0);
      expect(await page.locator("text=MAIN").count()).toBe(0);
    }

    await page.screenshot({ path: join(shots, `${item.name}-390x844.png`), fullPage: false });
  }

  const ref = tables[0]!;
  for (const t of tables) {
    within2(t.x, ref.x);
    within2(t.y, ref.y);
    within2(t.w, ref.w);
    within2(t.h, ref.h);
  }
  const d0 = dealers[0]!;
  for (const d of dealers) {
    within2(d.x, d0.x);
    within2(d.y, d0.y);
    within2(d.w, d0.w);
    within2(d.h, d0.h);
  }
  const n0 = names[0]!;
  for (const n of names) {
    within2(n.x, n0.x);
    within2(n.y, n0.y);
    within2(n.w, n0.w);
    within2(n.h, n0.h);
  }
  const c0 = consoles[0]!;
  for (const c of consoles) {
    within2(c.x, c0.x);
    within2(c.y, c0.y);
    within2(c.w, c0.w);
    within2(c.h, c0.h);
  }

  // Contact sheet of the five approval shots only
  const sharp = (await import("sharp")).default;
  const files = SCREENS.map((item) => join(shots, `${item.name}-390x844.png`));
  const images = await Promise.all(files.map((file) => sharp(file).resize(260, 562).png().toBuffer()));
  const cols = 3;
  const cellW = 260;
  const cellH = 562;
  const gap = 12;
  const rows = Math.ceil(images.length / cols);
  const sheetW = cols * cellW + (cols + 1) * gap;
  const sheetH = rows * cellH + (rows + 1) * gap;
  const composites = images.map((input, index) => ({
    input,
    left: gap + (index % cols) * (cellW + gap),
    top: gap + Math.floor(index / cols) * (cellH + gap),
  }));
  await sharp({
    create: { width: sheetW, height: sheetH, channels: 3, background: { r: 10, g: 8, b: 6 } },
  })
    .composite(composites)
    .png()
    .toFile(join(shots, "contact-sheet-bj-stable.png"));
});
