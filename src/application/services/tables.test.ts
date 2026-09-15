import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable, distributeJetons } from "@/application/services/tables";
import { inviteByEmail, joinWithToken } from "@/application/services/invitations";
import { loadSnapshot } from "@/application/queries/snapshot";
import { listHomeTables } from "@/application/queries/home";
import { DomainError } from "@/domain/errors";
import { placeOrRetractBet, startBetting } from "@/application/services/blackjack-round";

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
  test("one submission creates table, invitations, and Bank/Dealer", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const playerEmail = `player-${randomUUID()}@jetonbro.test`;
    const key = randomUUID();
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: key,
      name: "Alex's table",
      game: "BLACKJACK",
      startingJetonsPerPlayer: "100",
      emails: [playerEmail, ""],
    });
    const again = await createTable({
      actorId: owner.id,
      idempotencyKey: key,
      name: "Alex's table",
      game: "BLACKJACK",
      startingJetonsPerPlayer: "100",
      emails: [playerEmail, ""],
    });
    expect(again.tableId).toBe(created.tableId);
    expect(await prisma.table.count({ where: { ownerId: owner.id, name: "Alex's table" } })).toBe(1);

    const table = await prisma.table.findUniqueOrThrow({ where: { id: created.tableId } });
    expect(table.bankDealerId).toBe(owner.id);
    expect(table.currentPhase).toBe("TABLE_SETUP");
    expect(table.startingJetonsPerPlayerMillis).toBe(100000n);

    const snapshot = await loadSnapshot(created.tableId, owner.id);
    expect(snapshot.phase).toBe("TABLE_SETUP");
    expect(snapshot.bank).toBeNull();
    expect(snapshot.setup?.joinUrl).toContain("/join/");
    expect(snapshot.setup?.canStartBetting).toBe(false);
    expect(snapshot.setup?.seats.some((seat) => seat.status === "Bank / Dealer")).toBe(true);
    expect(snapshot.setup?.seats.some((seat) => seat.status === "Invited" && seat.name === playerEmail)).toBe(true);

    const home = await listHomeTables(owner.id);
    expect(home.some((item) => item.id === created.tableId && item.role === "Bank / Dealer")).toBe(true);
  });

  test("duplicate emails are rejected", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    await expect(
      createTable({
        actorId: owner.id,
        idempotencyKey: randomUUID(),
        name: "Dupes",
        emails: ["a@example.com", "A@example.com"],
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });
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

  test("join credits starting jetons once and betting moves AVAILABLE to LOCKED_BET", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const player = await user(`player-${randomUUID()}@jetonbro.test`, "Sam");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Live table",
      startingJetonsPerPlayer: "100",
    });
    const qr = await prisma.invitation.findFirstOrThrow({
      where: { tableId: created.tableId, kind: "QR", revokedAt: null },
    });
    await joinWithToken({ userId: player.id, token: qr.token, userEmail: player.email });
    await joinWithToken({ userId: player.id, token: qr.token, userEmail: player.email });

    const member = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId: created.tableId, userId: player.id } },
    });
    expect(member.availableMillis).toBe(100000n);
    expect(await prisma.tableMember.count({ where: { tableId: created.tableId, userId: player.id } })).toBe(1);

    const bankBefore = await loadSnapshot(created.tableId, owner.id);
    expect(bankBefore.setup?.seats.some((seat) => seat.status === "Ready" && seat.name === "Sam")).toBe(true);

    await startBetting({ actorId: owner.id, tableId: created.tableId, idempotencyKey: randomUUID() });
    const playerSnap = await loadSnapshot(created.tableId, player.id);
    expect(playerSnap.player?.available.label).toBe("100");
    const boxId = playerSnap.player!.boxes[0]!.id;
    const betKey = randomUUID();
    await placeOrRetractBet({
      actorId: player.id,
      tableId: created.tableId,
      boxId,
      amount: "5",
      mode: "ADD",
      idempotencyKey: betKey,
    });
    await placeOrRetractBet({
      actorId: player.id,
      tableId: created.tableId,
      boxId,
      amount: "5",
      mode: "ADD",
      idempotencyKey: betKey,
    });
    const after = await loadSnapshot(created.tableId, player.id);
    expect(after.player?.available.label).toBe("95");
    expect(after.player?.boxes[0]?.bet.label).toBe("5");
    const reloaded = await loadSnapshot(created.tableId, player.id);
    expect(reloaded.player?.available.label).toBe("95");
    expect(reloaded.player?.boxes[0]?.bet.label).toBe("5");
    const conserved = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId: created.tableId, userId: player.id } },
    });
    const locked = await prisma.bettingBox.findFirstOrThrow({
      where: { playerId: player.id, round: { tableId: created.tableId }, removedAt: null },
    });
    expect(conserved.availableMillis + locked.lockedBetMillis).toBe(100000n);

    await expect(
      placeOrRetractBet({
        actorId: owner.id,
        tableId: created.tableId,
        boxId,
        amount: "5",
        mode: "ADD",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ message: "You are not a Player at this table" });

    await expect(
      placeOrRetractBet({
        actorId: player.id,
        tableId: created.tableId,
        boxId,
        amount: "100",
        mode: "ADD",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });

    await expect(
      distributeJetons({
        actorId: player.id,
        tableId: created.tableId,
        userId: owner.id,
        amount: "10",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const other = await loadSnapshot(created.tableId, player.id);
    expect(other.members.filter((item) => item.userId !== player.id).every((item) => item.available === null || item.isBankDealer)).toBe(true);
  });

  test("lobby add-player invitation appears as Invited then Joined", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const playerEmail = `sam-${randomUUID()}@jetonbro.test`;
    const player = await user(playerEmail, "Sam");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Invite lobby",
      startingJetonsPerPlayer: "100",
    });
    await inviteByEmail({
      actorId: owner.id,
      tableId: created.tableId,
      emails: [playerEmail],
      idempotencyKey: randomUUID(),
      origin: "http://127.0.0.1:3000",
    });
    const invited = await loadSnapshot(created.tableId, owner.id);
    expect(invited.setup?.seats.some((seat) => seat.status === "Invited")).toBe(true);
    const invite = await prisma.invitation.findFirstOrThrow({
      where: { tableId: created.tableId, kind: "EMAIL", email: playerEmail },
    });
    await joinWithToken({ userId: player.id, token: invite.token, userEmail: player.email });
    await joinWithToken({ userId: player.id, token: invite.token, userEmail: player.email });
    const joined = await loadSnapshot(created.tableId, owner.id);
    expect(joined.setup?.seats.some((seat) => seat.name === "Sam" && (seat.status === "Joined" || seat.status === "Ready"))).toBe(true);
    expect(await prisma.tableMember.count({ where: { tableId: created.tableId, userId: player.id } })).toBe(1);
    const funded = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId: created.tableId, userId: player.id } },
    });
    expect(funded.availableMillis).toBe(100000n);
  });

  test("Bank cannot start betting until a player has joined", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Empty table",
      startingJetonsPerPlayer: "100",
    });
    await expect(
      startBetting({ actorId: owner.id, tableId: created.tableId, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: "NO_PLAYERS" });
  });

  test("one shared QR lets two users join once each", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const sam = await user(`sam-${randomUUID()}@jetonbro.test`, "Sam");
    const jo = await user(`jo-${randomUUID()}@jetonbro.test`, "Jo");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Shared QR",
      startingJetonsPerPlayer: "100",
    });
    const qr = await prisma.invitation.findFirstOrThrow({
      where: { tableId: created.tableId, kind: "QR", revokedAt: null },
    });
    const emailInvite = await prisma.invitation.findFirst({
      where: { tableId: created.tableId, kind: "EMAIL" },
    });
    expect(qr.token).not.toBe(emailInvite?.token);
    await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
    await joinWithToken({ userId: jo.id, token: qr.token, userEmail: jo.email });
    await joinWithToken({ userId: sam.id, token: qr.token, userEmail: sam.email });
    expect(await prisma.tableMember.count({ where: { tableId: created.tableId, userId: sam.id } })).toBe(1);
    expect(await prisma.tableMember.count({ where: { tableId: created.tableId, userId: jo.id } })).toBe(1);
    const samMember = await prisma.tableMember.findUniqueOrThrow({
      where: { tableId_userId: { tableId: created.tableId, userId: sam.id } },
    });
    expect(samMember.availableMillis).toBe(100000n);
    const lobby = await loadSnapshot(created.tableId, owner.id);
    expect(lobby.setup?.canStartBetting).toBe(true);
    expect(lobby.setup?.joinUrl).toContain(qr.token);
  });
});
