import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBlackjackTable, invitePlayerFromLobby, openAs, uniqueEmail } from "./helpers";

const out = join(process.cwd(), "docs", "screenshots", "classic");

test("two player sessions join a table and open betting", async ({ page, context, browser }) => {
  await mkdir(out, { recursive: true });
  const ownerEmail = uniqueEmail("owner");
  const alexEmail = uniqueEmail("alex");
  const joEmail = uniqueEmail("jo");

  await openAs(context, page, ownerEmail, "Owner");
  await createBlackjackTable(page, "Salon table", { starting: "100" });
  await page.screenshot({ path: join(out, "app-setup-390x844.png") });

  await invitePlayerFromLobby(page, alexEmail);

  const mailbox = await page.request.get(`/api/dev/mailbox?to=${encodeURIComponent(alexEmail)}`);
  const mail = (await mailbox.json()) as { messages: { url?: string }[] };
  const invitePath = new URL(mail.messages[0]!.url!).pathname;

  const alexContext = await browser.newContext();
  const alexPage = await alexContext.newPage();
  await openAs(alexContext, alexPage, alexEmail, "Alex");
  await alexPage.goto(invitePath);
  await expect(
    alexPage.getByText(/Waiting for the (Dealer|table) to open betting|Waiting for the Bank|WAITING FOR PLAYERS/i),
  ).toBeVisible({ timeout: 15_000 });

  const snapshot = await page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`);
  const data = (await snapshot.json()) as { setup?: { joinUrl: string | null } };
  expect(data.setup?.joinUrl).toBeTruthy();

  const joContext = await browser.newContext();
  const joPage = await joContext.newPage();
  await openAs(joContext, joPage, joEmail, "Jo");
  await joPage.goto(new URL(data.setup!.joinUrl!).pathname);
  await expect(
    joPage.getByText(/Waiting for the (Dealer|table) to open betting|Waiting for the Bank|WAITING FOR PLAYERS/i),
  ).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByText("Alex").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "ADD PLAYER" })).toBeVisible();

  await page.getByRole("button", { name: "START BETTING" }).click();
  await expect(page.locator("[data-phase-heading]")).toHaveText(/BETTING/i);
  // Premium funds via table starting jetons; dock has no GIVE JETONS when ADD PLAYER + CHANGE GAME are both shown.
  await alexPage.reload();
  await expect(alexPage.locator("[data-player-wallet=true]")).toBeVisible({ timeout: 15_000 });
  await expect(alexPage.getByText(/AVAILABLE/i).first()).toBeVisible();
  await expect.poll(async () => {
    const snap = (await alexPage.request
      .get(`${alexPage.url().replace("/tables/", "/api/tables/")}/snapshot`)
      .then((r) => r.json())) as { player?: { available?: { label: string } } };
    return snap.player?.available?.label ?? "0";
  }).toBe("100");
});
