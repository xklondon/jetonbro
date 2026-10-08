import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  expectNoDocumentScroll,
  openAs,
  uniqueEmail,
} from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "tabletop", "poker-racetrack-composition");
const authority = join(process.cwd(), "design", "reference", "tabletop", "approved", "poker-premium-racetrack.png");

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;

type Snap = {
  viewerId: string;
  poker?: {
    phase: string;
    pot: { label: string };
    currentActorId: string | null;
    seats: { userId: string; name: string; isActor: boolean; available: { label: string } }[];
  };
  setup?: { joinUrl: string | null; members?: { userId: string; isOwner?: boolean }[] };
};

async function tableSnapshot(page: Page): Promise<Snap> {
  const response = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  if (!response.ok()) throw new Error(`snapshot ${response.status()}`);
  return (await response.json()) as Snap;
}

async function command(page: Page, tableId: string, commandName: string, extra: Record<string, string> = {}) {
  const response = await page.request.post(`/api/tables/${tableId}/commands`, {
    data: { command: commandName, idempotencyKey: crypto.randomUUID(), ...extra },
  });
  if (!response.ok()) {
    throw new Error(`${commandName} failed: ${JSON.stringify(await response.json().catch(() => ({})))}`);
  }
}

async function shot(page: Page, name: string, size: { width: number; height: number }) {
  await page.setViewportSize(size);
  await expectNoDocumentScroll(page);
  await page.screenshot({ path: join(out, `${name}-${size.width}x${size.height}.png`), fullPage: false });
}

async function joinPlayer(browser: Browser, joinPath: string, name: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await openAs(context, page, uniqueEmail(`rt-${name.toLowerCase()}`), name);
  await page.goto(joinPath);
  await expect(page.locator("[data-table-board]")).toBeVisible({ timeout: 20_000 });
  return { context, page };
}

async function assertPremiumSurface(page: Page, seatCount: number) {
  await expect(page.locator('[data-poker-rail="oval"]')).toBeVisible();
  await expect(page.locator('[data-poker-surface="racetrack"]')).toBeVisible();
  await expect(page.locator(".tt-poker-racetrack")).toBeVisible();
  await expect(page.locator('[data-poker-track="felt"]')).toBeVisible();
  await expect(page.locator('[data-rail-label="SHUFFLE"]')).toBeVisible();
  await expect(page.locator('[data-rail-label="PRE-FLOP"]')).toBeVisible();
  await expect(page.locator('[data-rail-label="SHOWDOWN"]')).toBeVisible();
  await expect(page.locator("[data-seat-initials=true]")).toHaveCount(seatCount);
  await expect(page.locator(".tt-seat img")).toHaveCount(0);
  await expect(page.locator(".tt-poker-oval")).toHaveCount(0);
  await expect(page.getByText(/STREET\s+\d/i)).toHaveCount(0);
}

async function contactSheet(page: Page, file: string, tiles: { src: string; label: string }[]) {
  const board = (await readFile(authority)).toString("base64");
  const images = await Promise.all(
    tiles.map(async (tile) => ({
      ...tile,
      data: (await readFile(join(out, tile.src))).toString("base64"),
    })),
  );
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0a0806;color:#f4ead5;font-family:Georgia,serif">
    <div style="padding:16px 20px;font-size:20px;letter-spacing:.14em">POKER PREMIUM RACETRACK MATRIX</div>
    <div style="display:grid;grid-template-columns:320px 1fr;gap:16px;padding:0 16px 16px">
      <figure style="margin:0;background:#14100c;padding:12px;border:1px solid #dfbd69">
        <img src="data:image/png;base64,${board}" style="width:100%;height:auto"/>
        <figcaption style="margin-top:8px;font-size:12px;letter-spacing:.08em">AUTHORITY PNG</figcaption>
      </figure>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">
        ${images
          .map(
            (img) => `<figure style="margin:0;background:#14100c;padding:8px;border:1px solid rgba(223,189,105,.45)">
              <img src="data:image/png;base64,${img.data}" style="width:100%;height:auto"/>
              <figcaption style="margin-top:6px;font-size:11px">${img.label}</figcaption>
            </figure>`,
          )
          .join("")}
      </div>
    </div>
  </body></html>`);
  await page.screenshot({ path: join(out, file), fullPage: true });
}

test("premium Poker racetrack composition matrix 2/3/4/6 players", async ({ page, context, browser }) => {
  test.setTimeout(420_000);
  await mkdir(out, { recursive: true });

  async function matrixTable(playerNames: string[], tag: string, captureSetup = false) {
    const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const ownerPage = await ownerContext.newPage();
    await openAs(ownerContext, ownerPage, uniqueEmail(`rt-${tag}-own`), "Owner");
    await createBlackjackTable(ownerPage, `${tag} Hold em`, { starting: "100" });
    const snap = await tableSnapshot(ownerPage);
    const path = new URL(snap.setup!.joinUrl!).pathname;
    const tid = ownerPage.url().split("/tables/")[1]!.split("?")[0]!;
    const oid = snap.setup?.members?.find((m) => m.isOwner)?.userId ?? snap.viewerId;

    const joined: { context: BrowserContext; page: Page }[] = [];
    for (const name of playerNames) {
      const guest = await joinPlayer(browser, path, name);
      joined.push(guest);
      const id = (await tableSnapshot(guest.page)).viewerId;
      await command(ownerPage, tid, "giveJetons", { userId: id, amount: "100" });
    }
    await command(ownerPage, tid, "giveJetons", { userId: oid, amount: "100" });
    await command(ownerPage, tid, "switchGame", { game: "POKER" });
    await ownerPage.reload();
    for (const g of joined) await g.page.reload();

    const expected = playerNames.length + 1;
    await expect(ownerPage.getByRole("button", { name: "START HAND" })).toBeEnabled({ timeout: 20_000 });
    await expect(ownerPage.locator("[data-seat-count]")).toHaveAttribute("data-seat-count", String(expected), {
      timeout: 30_000,
    });
    await assertPremiumSurface(ownerPage, expected);
    if (captureSetup) {
      for (const size of VIEWPORTS) await shot(ownerPage, `${tag}-setup-owner`, size);
    }

    await ownerPage.getByRole("button", { name: "START HAND" }).click();
    await expect(ownerPage.locator("[data-poker-phase]")).not.toHaveAttribute("data-poker-phase", "POKER_SETUP", {
      timeout: 20_000,
    });
    await ownerPage.reload();
    for (const g of joined) await g.page.reload();
    await assertPremiumSurface(ownerPage, expected);
    for (const size of VIEWPORTS) {
      await shot(ownerPage, `${tag}-preflop-owner`, size);
      await shot(joined[0]!.page, `${tag}-preflop-player`, size);
    }

    for (const g of joined) await g.context.close();
    await ownerContext.close();
  }

  await matrixTable(["Sam"], "02-players");
  await matrixTable(["Sam", "Jo"], "03-players");
  await matrixTable(["Sam", "Jo", "Lee"], "04-players");
  await matrixTable(["Sam", "Jo", "Lee", "Pat", "Kim"], "06-players", true);

  await contactSheet(page, "contact-sheet-poker-racetrack.png", [
    { src: "02-players-preflop-owner-390x844.png", label: "2P owner 390" },
    { src: "02-players-preflop-player-390x844.png", label: "2P player 390" },
    { src: "03-players-preflop-owner-390x844.png", label: "3P owner 390" },
    { src: "03-players-preflop-player-390x844.png", label: "3P player 390" },
    { src: "04-players-preflop-owner-390x844.png", label: "4P owner 390" },
    { src: "04-players-preflop-player-390x844.png", label: "4P player 390" },
    { src: "06-players-preflop-owner-390x844.png", label: "6P owner 390" },
    { src: "06-players-preflop-player-390x844.png", label: "6P player 390" },
    { src: "06-players-preflop-owner-360x800.png", label: "6P 360" },
    { src: "06-players-preflop-owner-430x932.png", label: "6P 430" },
    { src: "02-players-preflop-owner-360x800.png", label: "2P 360" },
    { src: "04-players-preflop-owner-430x932.png", label: "4P 430" },
  ]);
});
