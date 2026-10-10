import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const shots = join(process.cwd(), "docs", "screenshots", "tabletop", "premium-bj-authority");
const authority = join(
  process.cwd(),
  "design",
  "reference",
  "premium",
  "blackjack-player-betting-authority.png",
);

const SCREENS = [
  { screen: "14-bj-player-betting-no-stake", name: "01-player-betting-no-stake" },
  { screen: "06-bj-player-betting-one-box", name: "02-player-betting-main-25" },
  { screen: "08-bj-player-playing", name: "03-player-playing" },
  { screen: "03-bj-dealer-betting-two-boxes", name: "04-dealer-betting-two-boxes" },
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

test("Premium Blackjack rebuilt to approved composition", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(shots, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });

  const tables: Box[] = [];
  const consoles: Box[] = [];
  const wallets: Box[] = [];
  const box1Centres: { x: number; y: number }[] = [];

  for (const item of SCREENS) {
    await page.goto(`/dev/premium?screen=${item.screen}`);
    await expect(page.locator('[data-skin="premium"]')).toBeVisible({ timeout: 20_000 });
    await expectNoDocumentScroll(page);

    tables.push(await boxOf(page, "[data-bj-stage=true]"));
    consoles.push(await boxOf(page, "[data-casino-console=true]"));
    wallets.push(await boxOf(page, "[data-casino-console=true] [data-player-wallet=true]"));

    expect(await page.locator("[data-table-name]").count()).toBe(1);
    await expect(page.locator(".pm-header-title")).toHaveText("JETONBRO");
    // Rules live only on the raster — no JSX duplicates.
    expect(await page.locator("text=INSURANCE PAYS 2 TO 1").count()).toBe(0);
    expect(await page.locator("text=BLACKJACK PAYS 3 TO 2").count()).toBe(0);

    if (item.screen.includes("player")) {
      const box1 = page.locator('[data-box-number="1"]');
      await expect(box1).toBeVisible();
      const b = await box1.boundingBox();
      expect(b).toBeTruthy();
      box1Centres.push({ x: b!.x + b!.width / 2, y: b!.y + b!.height / 2 });
    }

    await page.screenshot({ path: join(shots, `${item.name}-390x844.png`), fullPage: false });
  }

  // Setup assertion via dedicated visit
  await page.goto("/dev/premium?screen=01-bj-dealer-setup-empty");
  await expect(page.locator('[data-skin="premium"]')).toBeVisible();
  expect(await page.locator("[data-table-zone=boxes]").count()).toBe(0);
  expect(await page.locator("[data-box-id]").count()).toBe(0);

  const t0 = tables[0]!;
  for (const t of tables) {
    within2(t.x, t0.x);
    within2(t.y, t0.y);
    within2(t.w, t0.w);
    within2(t.h, t0.h);
  }
  const c0 = consoles[0]!;
  for (const c of consoles) {
    within2(c.x, c0.x);
    within2(c.y, c0.y);
    within2(c.w, c0.w);
    within2(c.h, c0.h);
  }
  const w0 = wallets[0]!;
  for (const w of wallets) {
    within2(w.x, w0.x);
    within2(w.y, w0.y);
  }
  const b0 = box1Centres[0]!;
  for (const b of box1Centres) {
    within2(b.x, b0.x);
    within2(b.y, b0.y);
  }

  const sharp = (await import("sharp")).default;
  const files = SCREENS.map((item) => join(shots, `${item.name}-390x844.png`));
  const thumbs = await Promise.all(files.map((file) => sharp(file).resize(240, 520).png().toBuffer()));
  const cols = 3;
  const cellW = 240;
  const cellH = 520;
  const gap = 12;
  const rows = Math.ceil(thumbs.length / cols);
  const sheetW = cols * cellW + (cols + 1) * gap;
  const sheetH = rows * cellH + (rows + 1) * gap;
  await sharp({
    create: { width: sheetW, height: sheetH, channels: 3, background: { r: 10, g: 8, b: 6 } },
  })
    .composite(
      thumbs.map((input, index) => ({
        input,
        left: gap + (index % cols) * (cellW + gap),
        top: gap + Math.floor(index / cols) * (cellH + gap),
      })),
    )
    .png()
    .toFile(join(shots, "contact-sheet-bj-authority.png"));

  // Authority vs live Player Betting MAIN 25
  const live = await readFile(join(shots, "02-player-betting-main-25-390x844.png"));
  const authBuf = await sharp(authority).resize(390, 844, { fit: "cover" }).png().toBuffer();
  const liveBuf = await sharp(live).resize(390, 844).png().toBuffer();
  const compareW = 390 * 2 + 24;
  await sharp({
    create: { width: compareW, height: 844 + 40, channels: 3, background: { r: 10, g: 8, b: 6 } },
  })
    .composite([
      { input: authBuf, left: 8, top: 32 },
      { input: liveBuf, left: 390 + 16, top: 32 },
    ])
    .png()
    .toFile(join(shots, "authority-vs-live-player-betting.png"));

  // Keep a tiny geometry report for the commit summary
  await writeFile(
    join(shots, "geometry.json"),
    JSON.stringify(
      {
        table: t0,
        console: c0,
        wallet: w0,
        box1Centre: b0,
        tableStablePx: 2,
        consoleStablePx: 2,
        box1StablePx: 2,
        walletStablePx: 2,
      },
      null,
      2,
    ),
    "utf8",
  );
});
