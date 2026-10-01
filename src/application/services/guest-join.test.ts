import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import { prisma } from "@/application/db";
import { createTable, ensureDraftTable, assignBankDealer } from "@/application/services/tables";
import { joinAsGuest, joinWithToken } from "@/application/services/invitations";
import { loadSnapshot } from "@/application/queries/snapshot";
import { placeOrRetractBet, startBetting } from "@/application/services/blackjack-round";
import { DomainError, ForbiddenError } from "@/domain/errors";

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

describeDb("guest vs verified invitations", () => {
  test("guest join credits starting jetons once and enables OPEN BETTING", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Guest table",
      game: "BLACKJACK",
      startingJetonsPerPlayer: "100",
      emails: [],
      draft: true,
    });
    const invites = await prisma.invitation.findMany({ where: { tableId: created.tableId, revokedAt: null } });
    const guest = invites.find((invite) => invite.kind === "GUEST");
    const verified = invites.find((invite) => invite.kind === "QR");
    expect(guest?.token).toBeTruthy();
    expect(verified?.token).toBeTruthy();
    expect(guest?.token).not.toBe(verified?.token);

    const ownerSnap = await loadSnapshot(created.tableId, owner.id);
    expect(ownerSnap.setup?.guestJoinUrl).toContain("/join/guest/");
    expect(ownerSnap.setup?.verifiedJoinUrl).toContain("/join/verified/");
    expect(ownerSnap.setup?.guestJoinUrl).not.toBe(ownerSnap.setup?.verifiedJoinUrl);
    expect(ownerSnap.isDealer).toBe(true);
    expect(ownerSnap.isSeatedPlayer).toBe(false);
    expect(ownerSnap.setup?.canStartBetting).toBe(false);

    await expect(joinWithToken({ userId: owner.id, token: guest!.token, userEmail: owner.email })).rejects.toBeInstanceOf(DomainError);

    const joined = await joinAsGuest({ token: guest!.token, playName: "Casey" });
    const again = await joinAsGuest({ token: guest!.token, playName: "Casey", existingGuestUserId: joined.userId });
    expect(again.userId).toBe(joined.userId);

    const members = await prisma.tableMember.findMany({ where: { tableId: created.tableId, leftAt: null } });
    expect(members.filter((member) => member.userId === joined.userId)).toHaveLength(1);
    const guestMember = members.find((member) => member.userId === joined.userId)!;
    expect(guestMember.availableMillis).toBe(100000n);
    expect(guestMember.startingJetonsCredited).toBe(true);

    const ready = await loadSnapshot(created.tableId, owner.id);
    expect(ready.setup?.canStartBetting).toBe(true);
    expect(ready.members.some((member) => member.name === "Casey" && member.isGuest)).toBe(true);

    await startBetting({ actorId: owner.id, tableId: created.tableId, idempotencyKey: randomUUID() });
    const bettingOwner = await loadSnapshot(created.tableId, owner.id);
    expect(bettingOwner.bank).toBeTruthy();
    expect(bettingOwner.player).toBeNull();
    expect(bettingOwner.bank?.players.some((player) => player.name === "Casey" && player.available.label === "100")).toBe(true);

    const bettingGuest = await loadSnapshot(created.tableId, joined.userId);
    expect(bettingGuest.player).toBeTruthy();
    expect(bettingGuest.bank).toBeNull();
    expect(bettingGuest.isSeatedPlayer).toBe(true);
    expect(bettingGuest.isDealer).toBe(false);
    expect(bettingGuest.player?.available.label).toBe("100");
    await expect(
      startBetting({ actorId: joined.userId, tableId: created.tableId, idempotencyKey: randomUUID() }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const boxId = bettingGuest.player!.boxes[0]!.id;
    await placeOrRetractBet({
      actorId: joined.userId,
      tableId: created.tableId,
      boxId,
      amount: "25",
      mode: "ADD",
      idempotencyKey: randomUUID(),
    });
    const afterBetOwner = await loadSnapshot(created.tableId, owner.id);
    expect(afterBetOwner.bank?.players.some((player) => player.name === "Casey" && player.available.label === "75")).toBe(true);
    expect(afterBetOwner.bank?.boxes.some((box) => box.bet.label === "25")).toBe(true);
    const afterBetGuest = await loadSnapshot(created.tableId, joined.userId);
    expect(afterBetGuest.player?.available.label).toBe("75");
    expect(afterBetGuest.player?.boxes.some((box) => box.bet.label === "25")).toBe(true);

    await expect(ensureDraftTable({ actorId: joined.userId })).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("role flags separate owner-dealer, seated player, and assigned dealer", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const dealer = await user(`dealer-${randomUUID()}@jetonbro.test`, "Blair");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Roles",
      game: "BLACKJACK",
      startingJetonsPerPlayer: "100",
      emails: [],
      draft: true,
    });
    const guest = await prisma.invitation.findFirstOrThrow({
      where: { tableId: created.tableId, kind: "GUEST", revokedAt: null },
    });
    const verified = await prisma.invitation.findFirstOrThrow({
      where: { tableId: created.tableId, kind: "QR", revokedAt: null },
    });
    const casey = await joinAsGuest({ token: guest.token, playName: "Casey" });
    await joinWithToken({ userId: dealer.id, token: verified.token, userEmail: dealer.email });
    await assignBankDealer({
      actorId: owner.id,
      tableId: created.tableId,
      userId: dealer.id,
      idempotencyKey: randomUUID(),
    });

    const ownerSnap = await loadSnapshot(created.tableId, owner.id);
    expect(ownerSnap.isOwner).toBe(true);
    expect(ownerSnap.isDealer).toBe(false);
    expect(ownerSnap.isSeatedPlayer).toBe(true);
    expect(ownerSnap.setup?.canStartBetting).toBe(true);

    const dealerSnap = await loadSnapshot(created.tableId, dealer.id);
    expect(dealerSnap.isOwner).toBe(false);
    expect(dealerSnap.isDealer).toBe(true);
    expect(dealerSnap.isSeatedPlayer).toBe(false);

    const playerSnap = await loadSnapshot(created.tableId, casey.userId);
    expect(playerSnap.isGuest).toBe(true);
    expect(playerSnap.isOwner).toBe(false);
    expect(playerSnap.isDealer).toBe(false);
    expect(playerSnap.isSeatedPlayer).toBe(true);

    expect(dealerSnap.isGuest).toBe(false);
    expect(dealerSnap.player).toBeNull();
    expect(ownerSnap.player).toBeNull();
    expect(ownerSnap.setup).toBeTruthy();
    expect(playerSnap.waiting).toBeTruthy();
  });

  test("duplicate guest play names are rejected", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Dup names",
      game: "BLACKJACK",
      startingJetonsPerPlayer: "100",
      emails: [],
      draft: true,
    });
    const guest = await prisma.invitation.findFirstOrThrow({
      where: { tableId: created.tableId, kind: "GUEST", revokedAt: null },
    });
    await joinAsGuest({ token: guest.token, playName: "Riley" });
    await expect(joinAsGuest({ token: guest.token, playName: "riley" })).rejects.toMatchObject({ code: "DUPLICATE_PLAYER_NAME" });
  });
});
