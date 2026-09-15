import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable } from "@/application/services/tables";
import { loadSnapshot } from "@/application/queries/snapshot";
import { listHomeTables } from "@/application/queries/home";
import { DomainError } from "@/domain/errors";

let hasDb = Boolean(process.env.DATABASE_URL);
if (hasDb) {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    hasDb = false;
  }
}
const describeDb = hasDb ? describe : describe.skip;

async function user(email: string, name: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, emailVerified: new Date() },
  });
}

describeDb("create table home journey", () => {
  test("creator becomes Bank/Dealer and stays in table setup", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Alex's table",
      game: "BLACKJACK",
      startingAllocation: "100",
      blackjackPayout: "THREE_TWO",
      maxBoxesPerPlayer: 3,
      insuranceEnabled: true,
    });
    const table = await prisma.table.findUniqueOrThrow({ where: { id: created.tableId } });
    expect(table.ownerId).toBe(owner.id);
    expect(table.bankDealerId).toBe(owner.id);
    expect(table.currentPhase).toBe("TABLE_SETUP");
    expect(table.maxBoxesPerPlayer).toBe(3);
    expect(table.insuranceEnabled).toBe(true);

    const snapshot = await loadSnapshot(created.tableId, owner.id);
    expect(snapshot.setup).toBeTruthy();
    expect(snapshot.setup?.joinUrl).toContain("/join/");
    expect(snapshot.bank).toBeNull();
    expect(snapshot.player).toBeNull();

    const home = await listHomeTables(owner.id);
    expect(home.some((item) => item.id === created.tableId && item.role === "Bank / Dealer")).toBe(true);
  });

  test("Poker cannot be created", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    await expect(
      createTable({
        actorId: owner.id,
        idempotencyKey: randomUUID(),
        name: "Poker night",
        game: "POKER",
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
