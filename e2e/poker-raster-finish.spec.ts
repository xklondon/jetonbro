import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, expectNoDocumentScroll, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "tabletop", "poker-raster-base");
const authority = join(process.cwd(), "design", "reference", "tabletop", "approved", "poker-premium-racetrack.png");
const baseAsset = join(process.cwd(), "design", "reference", "tabletop", "approved", "poker-premium-racetrack-base.png");

type Snap = {
  viewerId: string;
  poker?: { phase: string; currentActorId: string | null; legalActions: { type: string }[] };
  setup?: { joinUrl: string | null; members?: { userId: string; isOwner?: boolean }[] };
};

async function snapshot(page: Page): Promise<Snap> {
  const response = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  if (!response.ok()) throw new Error(`snapshot ${response.status()}`);
  return (await response.json()) as Snap;
}

async function command(page: Page, tableId: string, commandName: string, extra: Record<string, string> = {}) {
  const response = await page.request.post(`/api/tables/${tableId}/commands`, {
    data: { command: commandName, idempotencyKey: crypto.randomUUID(), ...extra },
  });
  if (!response.ok()) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`${commandName} failed: ${JSON.stringify(body)}`);
  }
}

async function joinPlayer(browser: Browser, joinPath: string, name: string) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await openAs(context, page, uniqueEmail(`rastf-${name.toLowerCase()}`), name);
  await page.goto(joinPath);
  await expect(page.locator("[data-table-board]")).toBeVisible({ timeout: 20_000 });
  return { context, page };
}

async function actorPage(owner: Page, players: Page[]) {
  const snap = await snapshot(owner);
  if (snap.poker?.currentActorId === snap.viewerId) return owner;
  for (const p of players) {
    const s = await snapshot(p);
    if (s.poker?.currentActorId === s.viewerId) return p;
  }
  return owner;
}

async function matchAndDeal(owner: Page, players: Page[], tid: string, dealLabel: string) {
  for (let i = 0; i < 24; i += 1) {
    await owner.reload();
    const btn = owner.getByRole("button", { name: dealLabel, exact: true });
    if ((await btn.count()) && (await btn.isEnabled())) {
      await btn.click();
      await owner.waitForTimeout(350);
      return true;
    }
    const current = await actorPage(owner, players);
    const legal = (await snapshot(current)).poker?.legalActions.map((a) => a.type) ?? [];
    const type = legal.includes("CHECK") ? "CHECK" : legal.includes("CALL") ? "CALL" : null;
    if (!type) return false;
    const response = await current.request.post(`/api/tables/${tid}/commands`, {
      data: { command: "pokerAct", idempotencyKey: crypto.randomUUID(), type },
    });
    if (!response.ok()) return false;
  }
  return false;
}

test("raster six + contact sheet", async ({ page, browser }) => {
  test.setTimeout(300_000);
  await mkdir(out, { recursive: true });

  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ownerPage = await ownerContext.newPage();
  await openAs(ownerContext, ownerPage, uniqueEmail("rastf-own"), "Owner");
  await createBlackjackTable(ownerPage, "six Hold em", { starting: "100" });
  const snap = await snapshot(ownerPage);
  const path = new URL(snap.setup!.joinUrl!).pathname;
  const tid = ownerPage.url().split("/tables/")[1]!.split("?")[0]!;
  const oid = snap.setup?.members?.find((m) => m.isOwner)?.userId ?? snap.viewerId;
  const joined: { context: BrowserContext; page: Page }[] = [];
  for (const name of ["Sam", "Jo", "Lee", "Pat", "Kim"]) {
    const g = await joinPlayer(browser, path, name);
    joined.push(g);
    await command(ownerPage, tid, "giveJetons", { userId: (await snapshot(g.page)).viewerId, amount: "100" });
  }
  await command(ownerPage, tid, "giveJetons", { userId: oid, amount: "100" });
  await command(ownerPage, tid, "switchGame", { game: "POKER" });
  await ownerPage.reload();
  for (const g of joined) await g.page.reload();
  await expect(ownerPage.getByRole("button", { name: "START HAND" })).toBeEnabled({ timeout: 25_000 });
  await command(ownerPage, tid, "startTexasHoldem");
  await ownerPage.reload();
  await expect(ownerPage.locator("[data-poker-phase]")).not.toHaveAttribute("data-poker-phase", "POKER_SETUP", {
    timeout: 20_000,
  });
  const pages = joined.map((g) => g.page);
  await matchAndDeal(ownerPage, pages, tid, "DEAL FLOP");
  await matchAndDeal(ownerPage, pages, tid, "DEAL TURN");
  await matchAndDeal(ownerPage, pages, tid, "DEAL RIVER");
  await ownerPage.reload();
  await expect(ownerPage.locator('[data-poker-base-img="true"]')).toBeVisible();
  await expect(ownerPage.locator(".tt-poker-wood")).toHaveCount(0);
  await expect(ownerPage.locator(".tt-seat")).toHaveCount(6);
  await ownerPage.setViewportSize({ width: 390, height: 844 });
  await expectNoDocumentScroll(ownerPage);
  await ownerPage.screenshot({ path: join(out, "05-six-river-390x844.png"), fullPage: false });

  for (const g of joined) await g.context.close();
  await ownerContext.close();

  const board = (await readFile(authority)).toString("base64");
  const raster = (await readFile(baseAsset)).toString("base64");
  const liveHu = (await readFile(join(out, "01-hu-preflop-390x844.png"))).toString("base64");
  const liveThree = (await readFile(join(out, "03-three-flop-390x844.png"))).toString("base64");
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0a0806;color:#f4ead5;font-family:Georgia,serif">
    <div style="padding:14px 18px;font-size:18px;letter-spacing:.12em">POKER RASTER BASE — AUTHORITY · BASE · LIVE</div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:0 14px 14px">
      <figure style="margin:0;background:#14100c;padding:8px;border:1px solid #dfbd69">
        <img src="data:image/png;base64,${board}" style="width:100%;height:auto"/>
        <figcaption style="margin-top:6px;font-size:11px">AUTHORITY</figcaption>
      </figure>
      <figure style="margin:0;background:#14100c;padding:8px;border:1px solid #dfbd69">
        <img src="data:image/png;base64,${raster}" style="width:100%;height:auto"/>
        <figcaption style="margin-top:6px;font-size:11px">RASTER BASE</figcaption>
      </figure>
      <figure style="margin:0;background:#14100c;padding:8px;border:1px solid rgba(223,189,105,.45)">
        <img src="data:image/png;base64,${liveHu}" style="width:100%;height:auto"/>
        <figcaption style="margin-top:6px;font-size:11px">LIVE HEADS-UP</figcaption>
      </figure>
      <figure style="margin:0;background:#14100c;padding:8px;border:1px solid rgba(223,189,105,.45)">
        <img src="data:image/png;base64,${liveThree}" style="width:100%;height:auto"/>
        <figcaption style="margin-top:6px;font-size:11px">LIVE THREE</figcaption>
      </figure>
    </div>
  </body></html>`);
  await page.screenshot({ path: join(out, "contact-sheet-raster.png"), fullPage: true });
});
