import { expect, test, type Page } from "@playwright/test";
import { createBlackjackTable, openAs, uniqueEmail } from "./helpers";

async function tableSnapshot(page: Page) {
  return page.request.get(`${page.url().replace("/tables/", "/api/tables/")}/snapshot`).then((response) => response.json());
}

async function addJetons(page: Page, amount: "5" | "10" | "25") {
  await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
  await page.getByRole("button", { name: `Add ${amount} jetons` }).click({ force: true });
}

async function playOneRound(bank: Page, player: Page) {
  await expect(bank.getByRole("button", { name: "DEAL CARDS NOW" })).toBeDisabled();
  await addJetons(player, "25");
  await expect(player.getByText("25").first()).toBeVisible();
  await expect(bank.getByRole("button", { name: "DEAL CARDS NOW" })).toBeEnabled({ timeout: 15_000 });
  await expect(bank.getByText("DEAL CARDS NOW closes Betting and starts Playing.")).toBeVisible();
  await bank.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await expect(bank.getByText("PLAYING", { exact: true })).toBeVisible();
  await expect(player.getByText("PLAYING").or(player.getByText("Cards are in play").or(player.getByText("YOUR JETONS")))).toBeVisible();
  await bank.reload();
  await player.reload();
  await expect(bank.getByText("PLAYING", { exact: true })).toBeVisible();
  await bank.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await expect(bank.getByText("PAYOUT", { exact: true })).toBeVisible();
  await player.reload();
  const snap = (await tableSnapshot(bank)) as { bank?: { boxes: { id: string }[] } };
  for (const box of snap.bank?.boxes ?? []) {
    await bank.locator(`[data-box-id="${box.id}"]`).getByRole("button", { name: /STAND OFF/ }).click({ force: true });
  }
  await expect(bank.getByRole("button", { name: "NEXT ROUND NOW" })).toBeEnabled({ timeout: 10_000 });
}

test("two browsers complete two full rounds through the production command path", async ({ page, context, browser }) => {
  test.setTimeout(180_000);
  const ownerEmail = uniqueEmail("bank");
  const playerEmail = uniqueEmail("player");

  await openAs(context, page, ownerEmail, "Alex");
  await createBlackjackTable(page, "Phase sequence", { starting: "100" });
  const setupSnap = (await tableSnapshot(page)) as { setup?: { joinUrl: string | null } };
  const joinPath = new URL(setupSnap.setup!.joinUrl!).pathname;

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await openAs(playerContext, playerPage, playerEmail, "Sam");
  await playerPage.goto(joinPath);
  await expect(playerPage.getByText(/Waiting for the Bank/i)).toBeVisible();

  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeVisible();
  await expect(page.getByRole("button", { name: "OPEN BETTING" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "OPEN BETTING" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await page.reload();
  await playerPage.reload();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await expect(page.getByText("WAITING FOR THE FIRST BET")).toBeVisible();

  await playOneRound(page, playerPage);
  await page.getByRole("button", { name: "NEXT ROUND NOW" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await playerPage.reload();
  await expect(playerPage.getByText("YOUR JETONS")).toBeVisible();

  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeDisabled();
  await addJetons(playerPage, "25");
  await expect(page.getByRole("button", { name: "DEAL CARDS NOW" })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole("button", { name: "DEAL IN 7 SECONDS" }).click();
  await expect(page.getByText(/Cards in [1-7]/)).toBeVisible();
  await page.getByRole("button", { name: "DEAL CARDS NOW" }).click();
  await expect(page.getByText("PLAYING", { exact: true })).toBeVisible();
  await playerPage.reload();
  await page.getByRole("button", { name: "PAYOUT PHASE" }).click();
  await expect(page.getByText("PAYOUT", { exact: true })).toBeVisible();
  const second = (await tableSnapshot(page)) as { bank?: { boxes: { id: string }[] } };
  for (const box of second.bank?.boxes ?? []) {
    await page.locator(`[data-box-id="${box.id}"]`).getByRole("button", { name: /STAND OFF/ }).click({ force: true });
  }
  await expect(page.getByRole("button", { name: "NEXT ROUND NOW" })).toBeEnabled({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByRole("button", { name: "NEXT ROUND NOW" })).toBeEnabled();
  await page.getByRole("button", { name: "NEXT ROUND NOW" }).click();
  await expect(page.getByText("BETTING", { exact: true })).toBeVisible();
  await playerPage.reload();
  await expect(playerPage.getByRole("button", { name: "Add 25 jetons" })).toBeVisible();

  await playerContext.close();
});
