import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, openAs, setupJoinUrl, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "prompt5-acceptance");
const ADMIN = process.env.JETONBRO_ADMIN_EMAIL || "p6-admin-wipe@jetonbro.test";

test("admin wipe is hidden from ordinary users and guests, and requires the exact phrase", async ({ page, context, browser }) => {
  test.setTimeout(120_000);
  const otherEmail = uniqueEmail("p6-other");
  await openAs(context, page, otherEmail, "Drew");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "WIPE ALL MY TABLES" })).toHaveCount(0);

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await openAs(adminContext, adminPage, ADMIN, "Alex");
  await createBlackjackTable(adminPage, "Wipe fixture", { starting: "100" });
  const guestUrl = await setupJoinUrl(adminPage, "guest");
  await adminPage.goto("/");
  await expect(adminPage.getByRole("button", { name: "WIPE ALL MY TABLES" })).toBeVisible();
  await adminPage.getByRole("button", { name: "WIPE ALL MY TABLES" }).click();
  await expect(adminPage.getByRole("heading", { name: "WIPE ALL MY TABLES" })).toBeVisible();
  await mkdir(out, { recursive: true });
  await adminPage.setViewportSize({ width: 390, height: 844 });
  await adminPage.screenshot({ path: join(out, "13-admin-wipe-confirmation-390x844.png"), fullPage: false });
  await adminPage.getByLabel("Type WIPE ALL TABLES").fill("DELETE ALL");
  await expect(adminPage.getByRole("button", { name: "Confirm wipe" })).toBeDisabled();
  await adminPage.getByLabel("Type WIPE ALL TABLES").fill("WIPE ALL TABLES");
  await expect(adminPage.getByRole("button", { name: "Confirm wipe" })).toBeEnabled();
  await adminPage.getByRole("button", { name: "Cancel" }).click();

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto(new URL(guestUrl).pathname);
  await guestPage.getByLabel("Play name").fill("Casey");
  await guestPage.getByRole("button", { name: "Join table" }).click();
  await expect(guestPage).toHaveURL(/\/tables\//, { timeout: 20_000 });
  await guestPage.goto("/");
  await expect(guestPage.getByRole("button", { name: "WIPE ALL MY TABLES" })).toHaveCount(0);

  await guestContext.close();
  await adminContext.close();
});
