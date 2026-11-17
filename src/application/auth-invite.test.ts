import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createInviteSignInUrl, invitationEmailUrl, inviteJoinFallbackUrl } from "@/application/auth-invite";
import { prisma } from "@/application/db";
import { randomToken } from "@/application/ids";
import { inviteByEmail, joinWithToken } from "@/application/services/invitations";
import { createTable } from "@/application/services/tables";

const secret = "test-auth-secret-for-invite-links";

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", secret);
  vi.stubEnv("AUTH_URL", "https://jetonbro.example");
  vi.stubEnv("ALLOW_DEV_MAILBOX", "true");
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("createInviteSignInUrl mints Auth callback with join verified callbackUrl", async () => {
  const inviteToken = "invite-token-abc";
  const create = vi.spyOn(prisma.verificationToken, "create").mockResolvedValue({
    identifier: "jo@example.com",
    token: "hashed",
    expires: new Date(Date.now() + 60_000),
  } as never);

  const url = await createInviteSignInUrl({
    email: "Jo@Example.COM",
    inviteToken,
    origin: "https://jetonbro.example",
  });
  const parsed = new URL(url);
  expect(parsed.origin).toBe("https://jetonbro.example");
  expect(parsed.pathname).toBe("/api/auth/callback/email");
  expect(parsed.searchParams.get("email")).toBe("jo@example.com");
  expect(parsed.searchParams.get("callbackUrl")).toBe(`/join/verified/${inviteToken}`);
  const rawToken = parsed.searchParams.get("token");
  expect(rawToken).toBeTruthy();
  expect(create).toHaveBeenCalledOnce();
  const stored = create.mock.calls[0]?.[0]?.data as { identifier: string; token: string; expires: Date };
  expect(stored.identifier).toBe("jo@example.com");
  expect(stored.token).toBe(createHash("sha256").update(`${rawToken}${secret}`).digest("hex"));
  expect(stored.expires.getTime()).toBeGreaterThan(Date.now());
});

test("invitationEmailUrl falls back to verified join when AUTH_SECRET missing", async () => {
  vi.stubEnv("AUTH_SECRET", "");
  const inviteToken = "invite-token-fallback";
  const url = await invitationEmailUrl("https://jetonbro.example", "a@b.co", inviteToken);
  expect(url).toBe(inviteJoinFallbackUrl("https://jetonbro.example", inviteToken));
  expect(url).toContain(`/join/verified/${inviteToken}`);
  expect(url).not.toContain("/api/auth/callback/email");
});

test("invitationEmailUrl prefers Auth callback when mint succeeds", async () => {
  vi.spyOn(prisma.verificationToken, "create").mockResolvedValue({
    identifier: "a@b.co",
    token: "hashed",
    expires: new Date(Date.now() + 60_000),
  } as never);
  const url = await invitationEmailUrl("https://jetonbro.example", "a@b.co", "tok123");
  expect(url).toContain("/api/auth/callback/email");
  expect(url).toContain(encodeURIComponent("/join/verified/tok123"));
});

let hasDb = Boolean(process.env.DATABASE_URL);
if (hasDb) {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    hasDb = false;
  }
}
const describeDb = hasDb ? describe : describe.skip;

describeDb("invitation email auth integration", () => {
  test("inviteByEmail does not consume invitation until join; email mismatch rejected", async () => {
    const owner = await prisma.user.create({
      data: { email: `owner-invite-${randomToken(8)}@example.com`, name: "Owner" },
    });
    const created = await createTable({
      actorId: owner.id,
      idempotencyKey: `create-${randomToken(8)}`,
      name: "Invite Auth Table",
      game: "POKER",
      smallBlind: "5",
      bigBlind: "10",
    });
    const playerEmail = `player-invite-${randomToken(8).toLowerCase()}@example.com`;
    const invited = await inviteByEmail({
      actorId: owner.id,
      tableId: created.tableId,
      emails: [playerEmail],
      idempotencyKey: `invite-${randomToken(8)}`,
      origin: "https://jetonbro.example",
    });
    expect(invited.invitations).toEqual([{ id: expect.any(String), email: playerEmail }]);

    const invite = await prisma.invitation.findFirstOrThrow({
      where: { tableId: created.tableId, kind: "EMAIL", email: playerEmail },
    });
    expect(invite.usedAt).toBeNull();

    const tokens = await prisma.verificationToken.findMany({ where: { identifier: playerEmail } });
    expect(tokens.length).toBeGreaterThanOrEqual(1);

    const other = await prisma.user.create({
      data: { email: `other-${randomToken(8).toLowerCase()}@example.com`, name: "Other" },
    });
    await expect(
      joinWithToken({ userId: other.id, token: invite.token, userEmail: other.email! }),
    ).rejects.toThrow(/match|invitation|email/i);

    const player = await prisma.user.create({
      data: { email: playerEmail, name: "Player", emailVerified: new Date() },
    });
    await joinWithToken({ userId: player.id, token: invite.token, userEmail: playerEmail });
    const after = await prisma.invitation.findUniqueOrThrow({ where: { id: invite.id } });
    expect(after.usedAt).not.toBeNull();

    const member = await prisma.tableMember.findFirst({
      where: { tableId: created.tableId, userId: player.id, leftAt: null },
    });
    expect(member).toBeTruthy();
  });
});
