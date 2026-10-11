import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { openAs, openSetupSheet } from "./helpers";

test("Premium Create Table START TABLE → Phase 0 (Blackjack)", async ({ page, context }) => {
  test.setTimeout(120_000);
  const email = `premium-create-${randomUUID().slice(0, 8)}@example.com`;
  const tableName = `Premium Create ${randomUUID().slice(0, 6)}`;

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const commandPosts: { command: string; status: number }[] = [];
  page.on("request", (request) => {
    if (request.method() !== "POST" || !/\/api\/tables\/[^/]+\/commands/.test(request.url())) return;
    try {
      const data = request.postDataJSON() as { command?: string };
      if (data?.command) commandPosts.push({ command: data.command, status: -1 });
    } catch {
      /* ignore */
    }
  });
  page.on("response", async (response) => {
    if (response.request().method() !== "POST" || !/\/api\/tables\/[^/]+\/commands/.test(response.url())) return;
    try {
      const data = response.request().postDataJSON() as { command?: string };
      const entry = [...commandPosts].reverse().find((item) => item.command === data?.command && item.status === -1);
      if (entry) entry.status = response.status();
    } catch {
      /* ignore */
    }
  });

  await openAs(context, page, email, "Casey");
  await page.setViewportSize({ width: 390, height: 844 });
  await openSetupSheet(page);

  await expect(page.locator('[data-skin="premium"]')).toBeVisible();
  await expect(page.locator('[data-table-board="CREATE_TABLE"]')).toBeVisible();

  await page.getByLabel("Table name").fill(tableName);
  await page.getByLabel("Table name").blur();
  await expect(page.getByLabel("Table name")).toHaveValue(tableName);
  await page.getByLabel("Starting jetons per player").fill("100");
  await page.getByLabel("Starting jetons per player").blur();
  await page.getByRole("button", { name: "Blackjack" }).click();

  await page.getByRole("button", { name: "START TABLE" }).click();

  await expect(page.getByRole("button", { name: "START TABLE" })).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator("[data-phase-heading]").first()).toHaveText(/TABLE SETUP/i, { timeout: 20_000 });
  await expect(page.locator("[data-table-name]")).toHaveText(tableName, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: "START BETTING" })).toBeVisible();
  await expect(page).toHaveURL(/\/tables\/(?!new(?:\?|$))/);

  const failed = commandPosts.filter((entry) => entry.status >= 400);
  expect(failed, JSON.stringify(commandPosts, null, 2)).toEqual([]);
  expect(commandPosts.filter((entry) => entry.command === "updateSettings").length).toBeGreaterThanOrEqual(1);
  expect(commandPosts.filter((entry) => entry.command === "finalizeSetup")).toHaveLength(1);

  const scroll = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }));
  expect(scroll.x).toBeLessThanOrEqual(1);
  expect(scroll.y).toBeLessThanOrEqual(1);

  await page.reload();
  await expect(page.locator("[data-phase-heading]").first()).toHaveText(/TABLE SETUP/i, { timeout: 20_000 });
  await expect(page.locator("[data-table-name]")).toHaveText(tableName);

  expect(errors, errors.join("\n")).toEqual([]);
});
