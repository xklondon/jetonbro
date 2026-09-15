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

export async function openSetupSheet(page: Page) {
  await page.goto("/");
  const create = page.getByRole("button", { name: /CREATE (A|NEW) TABLE/ });
  await expect(create).toBeVisible();
  await create.click();
  await expect(page.getByRole("button", { name: "START TABLE" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Blackjack/ })).toBeVisible();
  await expect(page.getByLabel("Player email")).toBeVisible();
  await expect(page.getByLabel("Starting jetons per player")).toBeVisible();
}

export async function createBlackjackTable(
  page: Page,
  name: string,
  options?: { starting?: string; email?: string },
) {
  await openSetupSheet(page);
  await page.getByLabel("Table name").fill(name);
  await page.getByLabel("Starting jetons per player").fill(options?.starting ?? "0");
  if (options?.email) {
    await page.getByLabel("Player email").fill(options.email);
  }
  await page.getByRole("button", { name: "START TABLE" }).click();
  await expect(page.getByRole("button", { name: "+ ADD PLAYER" })).toBeVisible();
  await expect(page.getByText(/Blackjack · Bank\/Dealer/)).toBeVisible();
}

export async function invitePlayerFromLobby(page: Page, email: string) {
  await page.getByRole("button", { name: "+ ADD PLAYER" }).click();
  await page.getByLabel("Player email").fill(email);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("Invited")).toBeVisible();
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
