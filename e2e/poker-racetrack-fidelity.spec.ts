import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, expectNoDocumentScroll, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "tabletop", "poker-racetrack-fidelity");
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

async function snapshot(page: Page): Promise<Snap> {
  const response = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  if (!response.ok()) throw new Error(`snapshot ${response.status()}`);
  return (await response.json()) as Snap;
}

async function command(page: Page, tableId: string, commandName: string, extra: Record<string, string> = {}) {
  const response = await page.request.post(`/api/tables/${tableId}/commands`, {
    data: { command: commandName, idempotencyKey: crypto.randomUUID(), ...extra },
  });
  if (!response.ok()) throw new Error(`${commandName} failed: ${JSON.stringify(await response.json().catch(() => ({})))}`);
}

async function shot(page: Page, name: string, size = { width: 390, height: 844 }) {
  await page.setViewportSize(size);
  await expectNoDocumentScroll(page);
  await page.screenshot({ path: join(out, `${name}-${size.width}x${size.height}.png`), fullPage: false });
}

async function joinPlayer(browser: Browser, joinPath: string, name: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await openAs(context, page, uniqueEmail(`fid-${name.toLowerCase()}`), name);
  await page.goto(joinPath);
  await expect(page.locator("[data-table-board]")).toBeVisible({ timeout: 20_000 });
  return { context, page };
}

async function boxOf(page: Page, selector: string): Promise<Box> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, selector).toBeTruthy();
  return box!;
}

async function assertCollisionGates(page: Page, seatCount: number) {
  await expect(page.locator("[data-poker-stage=true]")).toBeVisible();
  const stage = await boxOf(page, "[data-poker-stage=true]");
  expect(stage.width / stage.height).toBeLessThan(0.9);

  const name = await boxOf(page, '[data-poker-zone="name"]');
  const amount = await boxOf(page, '[data-poker-zone="amount"]');
  const track = await boxOf(page, '[data-poker-zone="track"]');
  expect(intersects(name, amount, 2)).toBe(false);
  expect(intersects(amount, track, 2)).toBe(false);
  expect(intersects(name, track, 2)).toBe(false);

  const chips = page.locator('[data-poker-zone="chips"]');
  if (await chips.count()) {
    const chipBox = await chips.first().boundingBox();
    if (chipBox && chipBox.height > 4) {
      expect(intersects(chipBox, name, 2)).toBe(false);
      expect(intersects(chipBox, track, 2)).toBe(false);
    }
  }

  const pot = await boxOf(page, '[data-poker-zone="pot"]');
  const seats = page.locator(".tt-seat");
  expect(await seats.count()).toBe(seatCount);
  for (let i = 0; i < seatCount; i += 1) {
    const seat = (await seats.nth(i).boundingBox())!;
    expect(intersects(seat, pot, 6), `seat ${i} vs pot`).toBe(false);
    expect(intersects(seat, track, 4), `seat ${i} vs track`).toBe(false);
  }

  const viewer = page.locator('[data-viewer-seat="true"]');
  if (await viewer.count()) {
    const vb = (await viewer.boundingBox())!;
    expect(vb.height).toBeGreaterThan(20);
    expect(vb.y + vb.height).toBeLessThan(page.viewportSize()!.height - 4);
  }

  if (await page.locator('[data-to-call="true"]').count()) {
    const call = await boxOf(page, '[data-to-call="true"]');
    expect(intersects(call, pot, 2)).toBe(false);
    expect(call.y).toBeGreaterThan(stage.y + stage.height - 48);
  }

  for (const size of VIEWPORTS) {
    await page.setViewportSize(size);
    await expectNoDocumentScroll(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

async function actorPage(owner: Page, players: Page[]) {
  const snap = await snapshot(owner);
  if (snap.poker?.currentActorId === snap.viewerId) return owner;
  for (const p of players) {
    if ((await snapshot(p)).poker?.currentActorId === (await snapshot(p)).viewerId) return p;
  }
  return owner;
}

async function openTable(browser: Browser, tag: string, names: string[]) {
  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ownerPage = await ownerContext.newPage();
  await openAs(ownerContext, ownerPage, uniqueEmail(`fid-${tag}-own`), "Owner");
  await createBlackjackTable(ownerPage, `${tag} Hold em`, { starting: "100" });
  const snap = await snapshot(ownerPage);
  const path = new URL(snap.setup!.joinUrl!).pathname;
  const tid = ownerPage.url().split("/tables/")[1]!.split("?")[0]!;
  const oid = snap.setup?.members?.find((m) => m.isOwner)?.userId ?? snap.viewerId;
  const joined: { context: BrowserContext; page: Page }[] = [];
  for (const name of names) {
    const g = await joinPlayer(browser, path, name);
    joined.push(g);
    await command(ownerPage, tid, "giveJetons", { userId: (await snapshot(g.page)).viewerId, amount: "100" });
  }
  await command(ownerPage, tid, "giveJetons", { userId: oid, amount: "100" });
  await command(ownerPage, tid, "switchGame", { game: "POKER" });
  await ownerPage.reload();
  for (const g of joined) await g.page.reload();
  await expect(ownerPage.getByRole("button", { name: "START HAND" })).toBeEnabled({ timeout: 20_000 });
  return { ownerContext, ownerPage, joined, tid, oid, expected: names.length + 1 };
}

async function matchAndDeal(owner: Page, players: Page[], tid: string, dealLabel: string) {
  for (let i = 0; i < 30; i += 1) {
    await owner.reload();
    const btn = owner.getByRole("button", { name: dealLabel, exact: true });
    if ((await btn.count()) && (await btn.isEnabled())) {
      await btn.click();
      await owner.waitForTimeout(400);
      return true;
    }
    const current = await actorPage(owner, players);
    const snap = await snapshot(current);
    const legal = snap.poker?.legalActions.map((a) => a.type) ?? [];
    const type = legal.includes("CHECK") ? "CHECK" : legal.includes("CALL") ? "CALL" : null;
    if (!type) return false;
    const response = await current.request.post(`/api/tables/${tid}/commands`, {
      data: { command: "pokerAct", idempotencyKey: crypto.randomUUID(), type },
    });
    if (!response.ok()) return false;
  }
  return false;
}

async function contactSheet(page: Page) {
  const board = (await readFile(authority)).toString("base64");
  const tiles = [
    { src: "01-hu-preflop-viewer-acting-390x844.png", label: "HU Pre-Flop acting" },
    { src: "02-hu-flop-opponent-acting-390x844.png", label: "HU Flop opponent" },
    { src: "03-four-turn-390x844.png", label: "Four Turn" },
    { src: "04-six-river-390x844.png", label: "Six River" },
    { src: "05-showdown-390x844.png", label: "Showdown" },
    { src: "06-hand-complete-390x844.png", label: "Hand Complete" },
    { src: "07-owner-street-390x844.png", label: "Owner street" },
    { src: "08-raise-composer-390x844.png", label: "Raise composer" },
  ];
  const images = await Promise.all(
    tiles.map(async (t) => ({ ...t, data: (await readFile(join(out, t.src))).toString("base64") })),
  );
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0a0806;color:#f4ead5;font-family:Georgia,serif">
    <div style="padding:14px 18px;font-size:18px;letter-spacing:.12em">POKER FIDELITY — AUTHORITY vs HEADS-UP LIVE</div>
    <div style="display:grid;grid-template-columns:280px 1fr 1fr;gap:12px;padding:0 14px 14px">
      <figure style="margin:0;background:#14100c;padding:10px;border:1px solid #dfbd69">
        <img src="data:image/png;base64,${board}" style="width:100%;height:auto"/>
        <figcaption style="margin-top:8px;font-size:12px">AUTHORITY</figcaption>
      </figure>
      ${images
        .slice(0, 2)
        .map(
          (img) => `<figure style="margin:0;background:#14100c;padding:8px;border:1px solid rgba(223,189,105,.45)">
            <img src="data:image/png;base64,${img.data}" style="width:100%;height:auto"/>
            <figcaption style="margin-top:6px;font-size:11px">${img.label}</figcaption>
          </figure>`,
        )
        .join("")}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:0 14px 14px">
      ${images
        .slice(2)
        .map(
          (img) => `<figure style="margin:0;background:#14100c;padding:6px;border:1px solid rgba(223,189,105,.4)">
            <img src="data:image/png;base64,${img.data}" style="width:100%;height:auto"/>
            <figcaption style="margin-top:4px;font-size:10px">${img.label}</figcaption>
          </figure>`,
        )
        .join("")}
    </div>
  </body></html>`);
  await page.screenshot({ path: join(out, "contact-sheet-fidelity.png"), fullPage: true });
}

test("Poker racetrack final visual fidelity", async ({ page, browser }) => {
  test.setTimeout(720_000);
  await mkdir(out, { recursive: true });

  const hu = await openTable(browser, "hu", ["Sam"]);
  await hu.ownerPage.getByRole("button", { name: "START HAND" }).click();
  await expect(hu.ownerPage.locator("[data-poker-phase]")).not.toHaveAttribute("data-poker-phase", "POKER_SETUP", {
    timeout: 20_000,
  });
  await hu.ownerPage.reload();
  await hu.joined[0]!.page.reload();
  await assertCollisionGates(hu.ownerPage, 2);

  const actor = await actorPage(hu.ownerPage, hu.joined.map((g) => g.page));
  await expect(actor.getByRole("button", { name: /CALL|CHECK|FOLD/ }).first()).toBeVisible({ timeout: 20_000 });
  await shot(actor, "01-hu-preflop-viewer-acting");
  await expect(hu.ownerPage.locator(".tt-owner-street-idle")).toBeVisible();
  await expect(hu.ownerPage.getByRole("button", { name: "DEAL FLOP" })).toHaveCount(0);
  await shot(hu.ownerPage, "07-owner-street");

  if (await actor.getByRole("button", { name: "RAISE" }).count()) {
    await actor.getByRole("button", { name: "RAISE" }).click();
    await expect(actor.locator("[data-raise-composer=true]")).toBeVisible();
    await shot(actor, "08-raise-composer");
    await actor.getByRole("button", { name: "CANCEL" }).click();
  } else if (await actor.getByRole("button", { name: "BET" }).count()) {
    await actor.getByRole("button", { name: "BET" }).click();
    await expect(actor.locator("[data-raise-composer=true]")).toBeVisible();
    await shot(actor, "08-raise-composer");
    await actor.getByRole("button", { name: "CANCEL" }).click();
  } else {
    await shot(actor, "08-raise-composer");
  }

  // Fold → complete, then next hand → flop for opponent-acting shot
  for (let i = 0; i < 8; i += 1) {
    const phase = (await snapshot(hu.ownerPage)).poker?.phase ?? "";
    if (phase === "HAND_COMPLETE" || phase === "SHOWDOWN") break;
    const current = await actorPage(hu.ownerPage, hu.joined.map((g) => g.page));
    if (await current.getByRole("button", { name: "FOLD" }).count()) {
      await command(current, hu.tid, "pokerAct", { type: "FOLD" });
      break;
    }
    const legal = (await snapshot(current)).poker?.legalActions.map((a) => a.type) ?? [];
    if (legal.includes("CHECK")) await command(current, hu.tid, "pokerAct", { type: "CHECK" });
    else if (legal.includes("CALL")) await command(current, hu.tid, "pokerAct", { type: "CALL" });
    else break;
  }
  await hu.ownerPage.reload();
  await hu.joined[0]!.page.reload();
  if ((await snapshot(hu.ownerPage)).poker?.phase === "SHOWDOWN") {
    await shot(hu.ownerPage, "05-showdown");
    const winner = (await snapshot(hu.ownerPage)).poker?.seats.find((s) => s.userId !== hu.oid)?.name ?? "Sam";
    await hu.ownerPage.getByRole("button", { name: winner, exact: true }).click();
    await hu.ownerPage.getByRole("button", { name: "AWARD POT", exact: true }).click();
  } else {
    await shot(hu.ownerPage, "05-showdown");
  }
  await expect(hu.ownerPage.locator("[data-poker-phase]")).toHaveAttribute("data-poker-phase", "HAND_COMPLETE", {
    timeout: 20_000,
  });
  await hu.joined[0]!.page.reload();
  await expect(hu.joined[0]!.page.getByText("TO CALL")).toHaveCount(0);
  await shot(hu.joined[0]!.page, "06-hand-complete");

  await hu.ownerPage.getByRole("button", { name: "NEXT HAND" }).click();
  await expect(hu.ownerPage.locator("[data-poker-phase]")).toHaveAttribute("data-poker-phase", "PRE_FLOP", {
    timeout: 20_000,
  });
  await matchAndDeal(hu.ownerPage, hu.joined.map((g) => g.page), hu.tid, "DEAL FLOP");
  if ((await snapshot(hu.ownerPage)).poker?.phase === "FLOP") {
    const flopActor = await actorPage(hu.ownerPage, hu.joined.map((g) => g.page));
    const flopWaiting = flopActor === hu.ownerPage ? hu.joined[0]!.page : hu.ownerPage;
    await shot(flopWaiting, "02-hu-flop-opponent-acting");
  } else {
    await shot(hu.joined[0]!.page, "02-hu-flop-opponent-acting");
  }

  for (const g of hu.joined) await g.context.close();
  await hu.ownerContext.close();

  // Four → Turn (best-effort street advance; always capture)
  {
    const table = await openTable(browser, "four", ["Sam", "Jo", "Lee"]);
    await table.ownerPage.getByRole("button", { name: "START HAND" }).click();
    await expect(table.ownerPage.locator("[data-poker-phase]")).not.toHaveAttribute("data-poker-phase", "POKER_SETUP", {
      timeout: 20_000,
    });
    await table.ownerPage.reload();
    for (const g of table.joined) await g.page.reload();
    const pages = table.joined.map((g) => g.page);
    await matchAndDeal(table.ownerPage, pages, table.tid, "DEAL FLOP");
    await matchAndDeal(table.ownerPage, pages, table.tid, "DEAL TURN");
    await table.ownerPage.reload();
    await assertCollisionGates(table.ownerPage, table.expected);
    await shot(table.ownerPage, "03-four-turn");
    for (const g of table.joined) await g.context.close();
    await table.ownerContext.close();
  }

  // Six → River (best-effort street advance; always capture)
  {
    const table = await openTable(browser, "six", ["Sam", "Jo", "Lee", "Pat", "Kim"]);
    await table.ownerPage.getByRole("button", { name: "START HAND" }).click();
    await expect(table.ownerPage.locator("[data-poker-phase]")).not.toHaveAttribute("data-poker-phase", "POKER_SETUP", {
      timeout: 20_000,
    });
    await table.ownerPage.reload();
    for (const g of table.joined) await g.page.reload();
    const pages = table.joined.map((g) => g.page);
    await matchAndDeal(table.ownerPage, pages, table.tid, "DEAL FLOP");
    await matchAndDeal(table.ownerPage, pages, table.tid, "DEAL TURN");
    await matchAndDeal(table.ownerPage, pages, table.tid, "DEAL RIVER");
    await table.ownerPage.reload();
    await assertCollisionGates(table.ownerPage, table.expected);
    await shot(table.ownerPage, "04-six-river");
    for (const g of table.joined) await g.context.close();
    await table.ownerContext.close();
  }

  await contactSheet(page);
});
