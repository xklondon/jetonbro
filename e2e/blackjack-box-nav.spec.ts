import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

async function tableSnapshot(page: import("@playwright/test").Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json()) as Promise<{
    player?: { boxes: { id: string; boxNumber: number; bet: { label: string } }[] };
    setup?: { joinUrl: string | null };
  }>;
}

test("player taps a box to select it and targets its controls", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("nav-bank");
  const samEmail = uniqueEmail("nav-sam");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Tap table", { starting: "100" });
  const setup = await tableSnapshot(page);
  const joinPath = new URL(setup.setup!.joinUrl!).pathname;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await samPage.setViewportSize({ width: 390, height: 844 });
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank|WAITING FOR PLAYERS/i)).toBeVisible();

  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText("BETTING");
  await expect(page.locator("[data-table-name]")).toHaveCount(1);
  await expect(page.locator("[data-table-name]")).toHaveText("Tap table");

  await samPage.reload();
  await expect(samPage.getByRole("button", { name: "START ADDITIONAL BOX" })).toBeVisible();
  await samPage.getByRole("button", { name: "START ADDITIONAL BOX" }).click();
  await expect.poll(async () => (await tableSnapshot(samPage)).player?.boxes.length).toBe(2);
  await expect(samPage.locator("[data-box-id]")).toHaveCount(2);
  await expect(samPage.locator("[data-selected-box]")).toHaveAttribute("data-selected-box", /./);
  const firstSelected = await samPage.locator("[data-selected-box]").getAttribute("data-selected-box");
  await expect(samPage.locator(`[data-box-id="${firstSelected}"]`)).toHaveClass(/selected/);

  const boxes = (await tableSnapshot(samPage)).player?.boxes ?? [];
  const other = boxes.find((box) => box.id !== firstSelected)?.id;
  expect(other).toBeTruthy();
  await samPage.locator(`[data-box-id="${other}"]`).click();
  await expect(samPage.locator("[data-selected-box]")).toHaveAttribute("data-selected-box", other!);
  await expect(samPage.locator(`[data-box-id="${other}"]`)).toHaveClass(/selected/);

  await samPage.locator(`[data-box-id="${firstSelected}"]`).click();
  await expect(samPage.locator("[data-selected-box]")).toHaveAttribute("data-selected-box", firstSelected!);

  await samPage.locator(`[data-box-id="${other}"]`).click();
  await samPage.getByRole("button", { name: "Add 10 jetons" }).click({ force: true });
  await expect.poll(async () => {
    const snap = await tableSnapshot(samPage);
    return snap.player?.boxes.find((item) => item.id === other)?.bet.label;
  }).toBe("10");

  await samPage.reload();
  const reloaded = await tableSnapshot(samPage);
  expect(reloaded.player?.boxes).toHaveLength(2);
  expect(reloaded.player?.boxes.some((item) => item.bet.label === "10")).toBe(true);

  await samContext.close();
});
