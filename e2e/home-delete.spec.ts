import { expect, test } from "@playwright/test";
import { createBlackjackTable, openAs, uniqueEmail } from "./helpers";

test("owner can permanently delete an empty draft from home", async ({ page, context }) => {
  test.setTimeout(120_000);
  const ownerEmail = uniqueEmail("home-del");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Draft to delete", { starting: "100" });
  await page.goto("/");
  const card = page.locator("[data-table-id]");
  await expect(card).toBeVisible();
  await expect(card.getByText("No Players yet")).toBeVisible();
  await expect(page.getByRole("button", { name: "RETURN TO TABLE" })).toBeVisible();
  await page.getByRole("button", { name: "Table menu" }).click();
  await expect(page.getByRole("button", { name: "SAVE TABLE" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CLOSE TABLE & SAVE BALANCES" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CLOSE & REMOVE TABLE" })).toHaveCount(0);
  await page.getByRole("button", { name: "DELETE TABLE" }).click();
  await expect(page.getByText("Permanent draft deletion.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.locator("[data-table-id]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "CREATE A TABLE" })).toBeVisible();
});

test("owner sees balances, non-owner does not, and started tables archive", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("home-own");
  const samEmail = uniqueEmail("home-sam");
  const joEmail = uniqueEmail("home-jo");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Open salon", { starting: "100" });
  const setupSnap = (await page.request
    .get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`)
    .then((response) => response.json())) as { setup?: { joinUrl: string | null } };
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;

  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(samPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Open salon")).toBeVisible();
  await expect(page.getByText("Sam")).toBeVisible();
  await expect(page.locator("[data-table-id]").getByText("100", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Table menu" })).toBeVisible();

  await samPage.goto("/");
  await expect(samPage.getByText("Open salon")).toBeVisible();
  await expect(samPage.getByText("Sam", { exact: true })).toBeVisible();
  await expect(samPage.getByText("100", { exact: true })).toBeVisible();
  await expect(samPage.getByRole("button", { name: "Table menu" })).toHaveCount(0);

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(joinPath);
  await expect(joPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  await samPage.goto("/");
  await expect(samPage.getByText("Jo", { exact: true })).toBeVisible();
  const joRow = samPage.locator(".home-table-players li", { hasText: /^Jo$/ });
  await expect(joRow).toBeVisible();
  await expect(joRow.getByText("100")).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByText("Jo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Table menu" }).click();
  await expect(page.getByRole("button", { name: "SAVE TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CLOSE & REMOVE TABLE" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "DELETE TABLE" })).toHaveCount(0);
  await page.getByRole("button", { name: "CLOSE TABLE & SAVE BALANCES" }).click();
  await expect(page.getByText("Historical archival.")).toBeVisible();
  await expect(page.getByText("Saving 100")).toHaveCount(2);
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Open salon")).toHaveCount(0);

  await samPage.goto("/");
  await expect(samPage.getByText("Open salon")).toHaveCount(0);

  await samContext.close();
  await joContext.close();
});

test("locked bets block close and remove from home", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("lock-own");
  const samEmail = uniqueEmail("lock-sam");
  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Locked salon", { starting: "100" });
  const setupSnap = (await page.request
    .get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`)
    .then((response) => response.json())) as { setup?: { joinUrl: string | null } };
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;
  const samContext = await browser.newContext();
  const samPage = await samContext.newPage();
  await openAs(samContext, samPage, samEmail, "Sam");
  await samPage.goto(joinPath);
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await samPage.reload();
  await samPage.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await samPage.getByRole("button", { name: "Add 25 jetons" }).click({ force: true });
  await expect(samPage.getByText("75", { exact: true }).first()).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Table menu" }).click();
  await expect(page.getByRole("button", { name: "CLOSE & REMOVE TABLE" })).toHaveCount(0);
  await page.getByRole("button", { name: "CLOSE TABLE & SAVE BALANCES" }).click();
  await expect(page.getByText(/locked bets or Insurance/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Locked salon")).toBeVisible();
  await samContext.close();
});
