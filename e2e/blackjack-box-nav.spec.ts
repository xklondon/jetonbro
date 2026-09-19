import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, openAs, swipePlayerBoxes, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

async function tableSnapshot(page: import("@playwright/test").Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<{
    player?: { boxes: { id: string; boxNumber: number; bet: { label: string } }[] };
    setup?: { joinUrl: string | null };
  }>;
}

test("player box swipe changes the selected box and targets its controls", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("nav-bank");
  const samEmail = uniqueEmail("nav-sam");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Swipe table", { starting: "100" });
  const setup = await tableSnapshot(page);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;

  const samContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator("[data-phase-heading]")).toHaveText("TABLE SETUP");
  await expect(page.locator("[data-table-name]")).toHaveCount(1);
  await expect(page.locator("[data-table-name]")).toHaveText("Swipe table");
  await expect(page.locator(".phase-head")).not.toContainText("Swipe table");
  await expect(page.locator("[data-phase-controls]").getByRole("button", { name: "OPEN BETTING" })).toBeVisible();
  await expect(page.locator(".dealer-list [data-dealer-box=true]")).toBeVisible();
  await expect(page.locator(".dealer-player")).toHaveCount(1);
  await page.screenshot({ path: join(out, "app-blackjack-header-setup-390x844.png") });

  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await expect(page.locator("[data-table-name]")).toHaveCount(1);
  await expect(page.locator(".phase-head")).not.toContainText("Swipe table");
  await expect(page.locator("[data-phase-controls]").getByRole("button", { name: "DEAL CARDS NOW" })).toBeVisible();
  await expect(page.locator("[data-phase-controls]").getByRole("button", { name: "IN 7 SECONDS" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-blackjack-header-betting-390x844.png") });

  await samPage.reload();
  await expect(samPage.getByRole("button", { name: "+ Box" })).toBeVisible();
  await samPage.getByRole("button", { name: "Add 25 jetons" }).click();
  await samPage.getByRole("button", { name: "+ Box" }).click();
  await expect(samPage.locator("[data-box-nav=true]")).toBeVisible();
  await expect(samPage.locator("[data-box-count]")).toHaveAttribute("data-box-count", "2");
  await expect(samPage.locator("[data-box-id]")).toHaveCount(2);

  const firstSelected = await samPage.locator("[data-selected-box]").getAttribute("data-selected-box");
  expect(firstSelected).toBeTruthy();
  await expect(samPage.locator(`[data-box-id="${firstSelected}"]`)).toHaveClass(/selected/);
  await swipePlayerBoxes(samPage, "left");
  const secondSelected = await samPage.locator("[data-selected-box]").getAttribute("data-selected-box");
  expect(secondSelected).toBeTruthy();
  expect(secondSelected).not.toBe(firstSelected);
  await samPage.getByRole("button", { name: "Add 10 jetons" }).click({ force: true });
  await expect.poll(async () => {
    const snap = await tableSnapshot(samPage);
    return snap.player?.boxes.find((item) => item.id === secondSelected)?.bet.label;
  }).toBe("10");
  await swipePlayerBoxes(samPage, "right");
  await expect(samPage.locator("[data-selected-box]")).toHaveAttribute("data-selected-box", firstSelected!);

  await expect(samPage.locator(`[data-box-id="${firstSelected}"]`)).toHaveClass(/selected/);
  await samPage.screenshot({ path: join(out, "app-blackjack-box-swipe-before-390x844.png") });

  await swipePlayerBoxes(samPage, "left");
  await expect(samPage.locator("[data-selected-box]")).toHaveAttribute("data-selected-box", secondSelected!);
  await expect(samPage.locator(`[data-box-id="${secondSelected}"]`)).toHaveClass(/selected/);
  await samPage.screenshot({ path: join(out, "app-blackjack-box-swipe-after-390x844.png") });

  await swipePlayerBoxes(samPage, "right");
  await expect(samPage.locator("[data-selected-box]")).toHaveAttribute("data-selected-box", firstSelected!);
  await expect(samPage.locator(`[data-box-id="${firstSelected}"]`)).toHaveClass(/selected/);
  await samPage.screenshot({ path: join(out, "app-blackjack-box-swipe-return-390x844.png") });

  const area = samPage.locator("[data-box-nav=true]");
  const box = await area.boundingBox();
  if (!box) throw new Error("missing boxes");
  await samPage.locator(`[data-box-id="${secondSelected}"]`).click();
  await expect(samPage.locator("[data-selected-box]")).toHaveAttribute("data-selected-box", secondSelected!);
  await samPage.locator(`[data-box-id="${firstSelected}"]`).click();
  await expect(samPage.locator("[data-selected-box]")).toHaveAttribute("data-selected-box", firstSelected!);

  await samPage.mouse.move(box.x + box.width / 2, box.y + 20);
  await samPage.mouse.down();
  await samPage.mouse.move(box.x + box.width / 2, box.y + 140, { steps: 8 });
  await samPage.mouse.up();
  await expect(samPage.locator("[data-selected-box]")).toHaveAttribute("data-selected-box", firstSelected!);

  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PLAYING");
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("PAYOUT");
  await expect(page.locator("[data-table-name]")).toHaveCount(1);
  await expect(page.locator(".phase-head")).not.toContainText("Swipe table");
  await expect(page.locator("[data-phase-controls]").getByRole("button", { name: "NEXT ROUND NOW" })).toBeVisible();
  await expect(page.locator("[data-phase-controls]").getByRole("button", { name: "IN 7 SECONDS" })).toBeVisible();
  await page.screenshot({ path: join(out, "app-blackjack-header-payout-390x844.png") });

  await samPage.reload();
  const reloaded = await tableSnapshot(samPage);
  expect(reloaded.player?.boxes).toHaveLength(2);
  expect(reloaded.player?.boxes.some((item) => item.bet.label === "25")).toBe(true);
  expect(reloaded.player?.boxes.some((item) => item.bet.label === "10")).toBe(true);
  await expect(samPage.locator("[data-box-nav=true]")).toBeVisible();

  await samContext.close();
});
