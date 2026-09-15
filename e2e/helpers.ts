import { expect, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export async function openAs(context: BrowserContext, page: Page, email: string, name: string) {
  const response = await page.request.post("/api/dev/session", {
    data: { email, name },
  });
  const data = (await response.json()) as { sessionToken: string };
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: data.sessionToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export async function createBlackjackTable(page: Page, name: string) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "CREATE A TABLE" })).toBeVisible();
  await page.getByRole("button", { name: "CREATE A TABLE" }).click();
  await expect(page.getByLabel("Table name")).toBeVisible();
  await page.getByLabel("Table name").fill(name);
  await page.getByLabel("Starting jetons per player").fill("0");
  await page.getByRole("button", { name: "CREATE TABLE" }).click();
  await expect(page.getByText("Table setup")).toBeVisible();
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@jetonbro.test`;
}
