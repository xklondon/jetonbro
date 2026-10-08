import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createBlackjackTable,
  expectNoDocumentScroll,
  openAs,
  uniqueEmail,
} from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "tabletop", "poker-racetrack-rebuild");
const authority = join(process.cwd(), "design", "reference", "tabletop", "approved", "poker-premium-racetrack.png");

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;

type Box = { x: number; y: number; width: number; height: number };
type Snap = {
  viewerId: string;
  poker?: {
    phase: string;
    currentActorId: string | null;
    legalActions: { type: string }[];
    seats: { userId: string; name: string }[];
  };
  setup?: { joinUrl: string | null; members?: { userId: string; isOwner?: boolean }[] };
};

function intersects(a: Box, b: Box, pad = 0) {
  return a.x < b.x + b.width - pad && a.x + a.width > b.x + pad && a.y < b.y + b.height - pad && a.y + a.height > b.y + pad;
}

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

async function joinPlayer(browser: Browser, joinPath: string, name: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await openAs(context, page, uniqueEmail(`rr-${name.toLowerCase()}`), name);
  await page.goto(joinPath);
  await expect(page.locator("[data-table-board]")).toBeVisible({ timeout: 20_000 });
  return { context, page };
}

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, selector).toBeTruthy();
  return box!;
}

async function assertPortraitComposition(page: Page, seatCount: number) {
  await expect(page.locator('[data-poker-surface="racetrack"]')).toBeVisible();
  await expect(page.locator("[data-poker-stage=true]")).toBeVisible();
  await expect(page.locator("[data-poker-centre=true]")).toBeVisible();
  await expect(page.locator('[data-poker-track="felt"]')).toBeVisible();
  await expect(page.locator('[data-rail-label="SHUFFLE"]')).toBeVisible();
  await expect(page.locator("[data-seat-initials=true]")).toHaveCount(seatCount);
  await expect(page.locator(".tt-seat img")).toHaveCount(0);
  await expect(page.locator(".tt-poker-oval")).toHaveCount(0);

  const stage = await boxOf(page, "[data-poker-stage=true]");
  const ratio = stage.width / stage.height;
  expect(ratio, `portrait stage ratio ${ratio}`).toBeLessThan(0.9);
  expect(ratio).toBeGreaterThan(0.55);

  const pot = await boxOf(page, '[data-poker-zone="pot"]');
  const track = await boxOf(page, '[data-poker-zone="track"]');
  const name = await boxOf(page, '[data-poker-zone="name"]');
  expect(intersects(name, pot, 2)).toBe(false);
  expect(intersects(pot, track, 2)).toBe(false);
  expect(intersects(name, track, 2)).toBe(false);

  const seats = page.locator(".tt-seat");
  expect(await seats.count()).toBe(seatCount);
  for (let i = 0; i < seatCount; i += 1) {
    const seat = (await seats.nth(i).boundingBox())!;
    expect(intersects(seat, pot, 4), `seat ${i} overlaps pot`).toBe(false);
    expect(intersects(seat, track, 4), `seat ${i} overlaps track`).toBe(false);
  }

  const viewer = page.locator('[data-viewer-seat="true"]');
  if (await viewer.count()) {
    const vb = (await viewer.boundingBox())!;
    expect(vb.y + vb.height).toBeLessThanOrEqual(stage.y + stage.height + 28);
    expect(vb.y).toBeGreaterThan(stage.y + stage.height * 0.55);
  }
  await expectNoDocumentScroll(page);
}

async function actorPage(owner: Page, players: Page[]) {
  const snap = await tableSnapshot(owner);
  if (snap.poker?.currentActorId === snap.viewerId) return owner;
  for (const p of players) {
    const s = await tableSnapshot(p);
    if (s.poker?.currentActorId === s.viewerId) return p;
  }
  return owner;
}

async function openPokerTable(browser: Browser, tag: string, playerNames: string[]) {
  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ownerPage = await ownerContext.newPage();
  await openAs(ownerContext, ownerPage, uniqueEmail(`rr-${tag}-own`), "Owner");
  await createBlackjackTable(ownerPage, `${tag} Hold em`, { starting: "100" });
  const snap = await tableSnapshot(ownerPage);
  const path = new URL(snap.setup!.joinUrl!).pathname;
  const tid = ownerPage.url().split("/tables/")[1]!.split("?")[0]!;
  const oid = snap.setup?.members?.find((m) => m.isOwner)?.userId ?? snap.viewerId;
  const joined: { context: BrowserContext; page: Page }[] = [];
  for (const name of playerNames) {
    const guest = await joinPlayer(browser, path, name);
    joined.push(guest);
    await command(ownerPage, tid, "giveJetons", { userId: (await tableSnapshot(guest.page)).viewerId, amount: "100" });
  }
  await command(ownerPage, tid, "giveJetons", { userId: oid, amount: "100" });
  await command(ownerPage, tid, "switchGame", { game: "POKER" });
  await ownerPage.reload();
  for (const g of joined) await g.page.reload();
  await expect(ownerPage.getByRole("button", { name: "START HAND" })).toBeEnabled({ timeout: 20_000 });
  return { ownerContext, ownerPage, joined, tid, oid, expected: playerNames.length + 1 };
}

async function contactSheet(page: Page, file: string, tiles: { src: string; label: string }[]) {
  const board = (await readFile(authority)).toString("base64");
  const images = await Promise.all(
    tiles.map(async (tile) => ({
      ...tile,
      data: (await readFile(join(out, tile.src))).toString("base64"),
    })),
  );
  await page.setViewportSize({ width: 1680, height: 1200 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0a0806;color:#f4ead5;font-family:Georgia,serif">
    <div style="padding:16px 20px;font-size:20px;letter-spacing:.14em">POKER RACETRACK REBUILD — AUTHORITY vs LIVE</div>
    <div style="display:grid;grid-template-columns:300px 1fr;gap:14px;padding:0 14px 14px">
      <figure style="margin:0;background:#14100c;padding:10px;border:1px solid #dfbd69">
        <img src="data:image/png;base64,${board}" style="width:100%;height:auto"/>
        <figcaption style="margin-top:8px;font-size:12px">AUTHORITY PNG</figcaption>
      </figure>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">
        ${images
          .map(
            (img) => `<figure style="margin:0;background:#14100c;padding:6px;border:1px solid rgba(223,189,105,.45)">
              <img src="data:image/png;base64,${img.data}" style="width:100%;height:auto"/>
              <figcaption style="margin-top:4px;font-size:10px">${img.label}</figcaption>
            </figure>`,
          )
          .join("")}
      </div>
    </div>
  </body></html>`);
  await page.screenshot({ path: join(out, file), fullPage: true });
}

test("premium Poker racetrack rebuild visual acceptance", async ({ page, browser }) => {
  test.setTimeout(420_000);
  await mkdir(out, { recursive: true });

  // Heads-up: setup, acting, fold-to-complete, raise composer, docks
  {
    const hu = await openPokerTable(browser, "hu", ["Sam"]);
    await assertPortraitComposition(hu.ownerPage, 2);
    for (const size of VIEWPORTS) await shot(hu.ownerPage, "01-setup-shuffle-owner", size);

    await hu.ownerPage.getByRole("button", { name: "START HAND" }).click();
    await expect(hu.ownerPage.locator("[data-poker-phase]")).not.toHaveAttribute("data-poker-phase", "POKER_SETUP", {
      timeout: 20_000,
    });
    await hu.ownerPage.reload();
    await hu.joined[0]!.page.reload();
    await assertPortraitComposition(hu.ownerPage, 2);

    const actor = await actorPage(hu.ownerPage, hu.joined.map((g) => g.page));
    const waiting = actor === hu.ownerPage ? hu.joined[0]!.page : hu.ownerPage;
    await expect(actor.getByRole("button", { name: /CALL|CHECK|BET|RAISE|FOLD/ }).first()).toBeVisible({
      timeout: 20_000,
    });
    for (const size of VIEWPORTS) {
      await shot(actor, "02-hu-preflop-viewer-acting", size);
      await shot(waiting, "03-hu-preflop-waiting", size);
      await shot(hu.ownerPage, "08-owner-street-control", size);
      await shot(hu.joined[0]!.page, "09-player-action-dock", size);
    }

    if (await actor.getByRole("button", { name: "RAISE" }).count()) {
      await actor.getByRole("button", { name: "RAISE" }).click();
      await expect(actor.locator("[data-raise-composer=true]")).toBeVisible();
      for (const size of VIEWPORTS) await shot(actor, "10-raise-composer", size);
      await actor.getByRole("button", { name: "CANCEL" }).click();
    } else if (await actor.getByRole("button", { name: "BET" }).count()) {
      await actor.getByRole("button", { name: "BET" }).click();
      await expect(actor.locator("[data-raise-composer=true]")).toBeVisible();
      for (const size of VIEWPORTS) await shot(actor, "10-raise-composer", size);
      await actor.getByRole("button", { name: "CANCEL" }).click();
    }

    // Fast fold path → HAND COMPLETE (covers complete state without street marathon)
    for (let i = 0; i < 6; i += 1) {
      const phase = (await tableSnapshot(hu.ownerPage)).poker?.phase ?? "";
      if (phase === "HAND_COMPLETE" || phase === "SHOWDOWN") break;
      const current = await actorPage(hu.ownerPage, hu.joined.map((g) => g.page));
      if (await current.getByRole("button", { name: "FOLD" }).count()) {
        await command(current, hu.tid, "pokerAct", { type: "FOLD" });
        break;
      }
      const legal = (await tableSnapshot(current)).poker?.legalActions.map((a) => a.type) ?? [];
      if (legal.includes("CHECK")) await command(current, hu.tid, "pokerAct", { type: "CHECK" });
      else if (legal.includes("CALL")) await command(current, hu.tid, "pokerAct", { type: "CALL" });
      else break;
    }
    await hu.ownerPage.reload();
    await hu.joined[0]!.page.reload();
    const endPhase = (await tableSnapshot(hu.ownerPage)).poker?.phase;
    if (endPhase === "SHOWDOWN") {
      for (const size of VIEWPORTS) await shot(hu.ownerPage, "06-showdown", size);
      const winnerName = (await tableSnapshot(hu.ownerPage)).poker?.seats.find((s) => s.userId !== hu.oid)?.name ?? "Sam";
      await hu.ownerPage.getByRole("button", { name: winnerName, exact: true }).click();
      await hu.ownerPage.getByRole("button", { name: "AWARD POT", exact: true }).click();
    }
    await expect(hu.ownerPage.locator("[data-poker-phase]")).toHaveAttribute("data-poker-phase", "HAND_COMPLETE", {
      timeout: 20_000,
    });
    await hu.joined[0]!.page.reload();
    await expect(hu.joined[0]!.page.getByText("TO CALL")).toHaveCount(0);
    for (const size of VIEWPORTS) await shot(hu.joined[0]!.page, "07-hand-complete", size);

    // Flop other-acting capture: start next hand, check once, deal flop
    await hu.ownerPage.getByRole("button", { name: "NEXT HAND" }).click();
    await expect(hu.ownerPage.locator("[data-poker-phase]")).toHaveAttribute("data-poker-phase", "PRE_FLOP", {
      timeout: 20_000,
    });
    for (let i = 0; i < 8; i += 1) {
      const btn = hu.ownerPage.getByRole("button", { name: "DEAL FLOP", exact: true });
      if ((await btn.count()) && (await btn.isEnabled())) {
        await btn.click();
        break;
      }
      const current = await actorPage(hu.ownerPage, hu.joined.map((g) => g.page));
      const legal = (await tableSnapshot(current)).poker?.legalActions.map((a) => a.type) ?? [];
      if (legal.includes("CHECK")) await command(current, hu.tid, "pokerAct", { type: "CHECK" });
      else if (legal.includes("CALL")) await command(current, hu.tid, "pokerAct", { type: "CALL" });
      else break;
    }
    if ((await tableSnapshot(hu.ownerPage)).poker?.phase === "FLOP") {
      const flopActor = await actorPage(hu.ownerPage, hu.joined.map((g) => g.page));
      for (const size of VIEWPORTS) await shot(flopActor, "04-hu-flop-other-acting", size);
    }

    for (const g of hu.joined) await g.context.close();
    await hu.ownerContext.close();
  }

  // Seat-count matrix: 3 / 4 / 6 at setup+preflop
  for (const [names, tag] of [
    [["Sam", "Jo"], "03-three"],
    [["Sam", "Jo", "Lee"], "05-four"],
    [["Sam", "Jo", "Lee", "Pat", "Kim"], "05b-six"],
  ] as const) {
    const table = await openPokerTable(browser, tag, [...names]);
    await assertPortraitComposition(table.ownerPage, table.expected);
    for (const size of VIEWPORTS) await shot(table.ownerPage, `${tag}-setup-owner`, size);
    await table.ownerPage.getByRole("button", { name: "START HAND" }).click();
    await expect(table.ownerPage.locator("[data-poker-phase]")).not.toHaveAttribute("data-poker-phase", "POKER_SETUP", {
      timeout: 20_000,
    });
    await table.ownerPage.reload();
    for (const g of table.joined) await g.page.reload();
    await assertPortraitComposition(table.ownerPage, table.expected);
    const shotBase = tag === "05-four" ? "05-four-player-turn" : tag === "05b-six" ? "05b-six-player-preflop" : `${tag}-preflop`;
    for (const size of VIEWPORTS) {
      await shot(table.ownerPage, shotBase, size);
      await shot(table.joined[0]!.page, `${shotBase}-player`, size);
    }
    for (const g of table.joined) await g.context.close();
    await table.ownerContext.close();
  }

  await contactSheet(page, "contact-sheet-authority-vs-live.png", [
    { src: "01-setup-shuffle-owner-390x844.png", label: "1 Setup" },
    { src: "02-hu-preflop-viewer-acting-390x844.png", label: "2 HU acting" },
    { src: "04-hu-flop-other-acting-390x844.png", label: "3 HU flop" },
    { src: "05-four-player-turn-390x844.png", label: "4 Four" },
    { src: "05b-six-player-preflop-390x844.png", label: "5 Six" },
    { src: "06-showdown-390x844.png", label: "6 Showdown" },
    { src: "07-hand-complete-390x844.png", label: "7 Complete" },
    { src: "08-owner-street-control-390x844.png", label: "8 Owner" },
    { src: "09-player-action-dock-390x844.png", label: "9 Player" },
    { src: "10-raise-composer-390x844.png", label: "10 Raise" },
    { src: "02-hu-preflop-viewer-acting-360x800.png", label: "360" },
    { src: "05-four-player-turn-430x932.png", label: "430" },
  ]);
});
