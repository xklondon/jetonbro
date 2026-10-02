import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/application/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/application/auth";
import { getActor } from "@/application/actor";
import { prisma } from "@/application/db";
import { createTable, finalizeSetup } from "@/application/services/tables";
import { placeOrRetractBet } from "@/application/services/blackjack-round";
import { GUEST_COOKIE, signGuestToken } from "@/application/guest-session";
import { NextRequest } from "next/server";
import { GET as snapshotGet } from "@/app/api/tables/[tableId]/snapshot/route";
import { POST as guestJoinPost } from "@/app/api/join/guest/[token]/route";
import { POST as commandPost } from "@/app/api/tables/[tableId]/commands/route";
import { selectTableBoard } from "@/ui/core/table-board";

const authMock = vi.mocked(auth);

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
    update: { name, isGuest: false, guestTableId: null },
    create: { email, name, emailVerified: new Date() },
  });
}

function cookieHeader(parts: string[]) {
  return parts.filter(Boolean).join("; ");
}

function guestCookie(userId: string, tableId: string) {
  return `${GUEST_COOKIE}=${signGuestToken(userId, tableId)}`;
}

async function snapshotViaRoute(tableId: string, cookie: string | null) {
  const response = await snapshotGet(
    new Request(`http://127.0.0.1:3000/api/tables/${tableId}/snapshot`, {
      headers: cookie ? { cookie } : undefined,
    }),
    { params: Promise.resolve({ tableId }) },
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describeDb("production cookie/header actor wrappers", () => {
  beforeEach(() => {
    authMock.mockReset();
    authMock.mockResolvedValue(null);
  });

  test("join Set-Cookie then snapshot/command routes keep Guest and Owner boards split", async () => {
    const owner = await user(`owner-${randomUUID()}@jetonbro.test`, "Alex");
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: randomUUID(),
      name: "Cookie table",
      game: "BLACKJACK",
      startingJetonsPerPlayer: "100",
      emails: [],
      draft: true,
    });
    await finalizeSetup({
      actorId: owner.id,
      tableId: created.tableId,
      idempotencyKey: randomUUID(),
      name: "Cookie table",
      startingJetonsPerPlayer: "100",
      emails: [],
    });
    const invite = await prisma.invitation.findFirstOrThrow({
      where: { tableId: created.tableId, kind: "GUEST", revokedAt: null },
    });

    authMock.mockResolvedValue({ user: { id: owner.id } } as never);
    const ownerBefore = await snapshotViaRoute(created.tableId, null);
    expect(ownerBefore.status).toBe(200);
    expect(ownerBefore.body.isOwner).toBe(true);
    expect(ownerBefore.body.isDealer).toBe(true);
    expect(ownerBefore.body.isSeatedPlayer).toBe(false);
    expect(ownerBefore.body.canStartBetting).toBe(false);
    expect(ownerBefore.body.seatedPlayerCount).toBe(0);
    expect(selectTableBoard(ownerBefore.body as never)).toBe("PHASE_ZERO_DEALER");

    authMock.mockResolvedValue(null);
    const joined = await guestJoinPost(
      new Request(`http://127.0.0.1:3000/api/join/guest/${invite.token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playName: "Casey" }),
      }),
      { params: Promise.resolve({ token: invite.token }) },
    );
    expect(joined.status).toBe(200);
    const payload = (await joined.json()) as { userId: string; tableId: string };
    const setCookie = joined.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(GUEST_COOKIE);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie).toContain("Path=/");
    expect(payload.userId).not.toBe(owner.id);

    const guestOnly = cookieHeader([guestCookie(payload.userId, payload.tableId)]);
    const leftoverOwnerPlusGuest = cookieHeader([guestOnly, "authjs.session-token=leftover"]);

    authMock.mockResolvedValue({ user: { id: owner.id } } as never);
    const guestWithLeftoverAuth = await getActor({ tableId: created.tableId, cookieHeader: leftoverOwnerPlusGuest });
    expect(guestWithLeftoverAuth?.id).toBe(payload.userId);
    expect(guestWithLeftoverAuth?.isGuest).toBe(true);

    authMock.mockResolvedValue(null);
    const guestSnap = await snapshotViaRoute(created.tableId, guestOnly);
    expect(guestSnap.status).toBe(200);
    expect(guestSnap.body.viewerId).toBe(payload.userId);
    expect(guestSnap.body.isOwner).toBe(false);
    expect(guestSnap.body.isDealer).toBe(false);
    expect(guestSnap.body.isSeatedPlayer).toBe(true);
    expect(guestSnap.body.isGuest).toBe(true);
    expect(selectTableBoard(guestSnap.body as never)).toBe("PHASE_ZERO_PLAYER");

    authMock.mockResolvedValue({ user: { id: owner.id } } as never);
    const ownerAfter = await snapshotViaRoute(created.tableId, null);
    expect(ownerAfter.body.isOwner).toBe(true);
    expect(ownerAfter.body.isDealer).toBe(true);
    expect(ownerAfter.body.isSeatedPlayer).toBe(false);
    expect(ownerAfter.body.canStartBetting).toBe(true);
    expect(ownerAfter.body.seatedPlayerCount).toBe(1);
    expect(selectTableBoard(ownerAfter.body as never)).toBe("PHASE_ZERO_DEALER");

    const start = await commandPost(
      new NextRequest(`http://127.0.0.1:3000/api/tables/${created.tableId}/commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: "startBetting", idempotencyKey: randomUUID() }),
      }),
      { params: Promise.resolve({ tableId: created.tableId }) },
    );
    expect(start.ok).toBe(true);

    const ownerBetting = await snapshotViaRoute(created.tableId, null);
    authMock.mockResolvedValue(null);
    const guestBetting = await snapshotViaRoute(created.tableId, guestOnly);
    expect(ownerBetting.body.phase).toBe("BETTING");
    expect(guestBetting.body.phase).toBe("BETTING");
    expect(selectTableBoard(ownerBetting.body as never)).toBe("BLACKJACK_DEALER");
    expect(selectTableBoard(guestBetting.body as never)).toBe("BLACKJACK_PLAYER");

    const guestPlayer = guestBetting.body.player as { boxes: { id: string }[]; available: { label: string } };
    await placeOrRetractBet({
      actorId: payload.userId,
      tableId: created.tableId,
      boxId: guestPlayer.boxes[0]!.id,
      amount: "25",
      mode: "ADD",
      idempotencyKey: randomUUID(),
    });
    authMock.mockResolvedValue({ user: { id: owner.id } } as never);
    const ownerAfterBet = await snapshotViaRoute(created.tableId, null);
    authMock.mockResolvedValue(null);
    const guestAfterBet = await snapshotViaRoute(created.tableId, guestOnly);
    expect((guestAfterBet.body.player as { available: { label: string } }).available.label).toBe("75");
    expect(
      ((ownerAfterBet.body.bank as { players: { name: string; available: { label: string }; locked: { label: string } }[] }).players ?? []).some(
        (player) => player.name === "Casey" && player.available.label === "75" && player.locked.label === "25",
      ),
    ).toBe(true);
  });
});
