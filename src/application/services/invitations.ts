import { prisma } from "@/application/db";
import { hoursFromNow, randomToken } from "@/application/ids";
import { withIdempotency } from "@/application/idempotency";
import { verifiedJoinUrl } from "@/application/invite-urls";
import { sendInvitationEmail } from "@/application/mail";
import { publishTable } from "@/application/realtime/bus";
import { rateLimit } from "@/application/rate-limit";
import {
  requireOwner,
  requireOwnerOrBank,
  creditStartingJetonsOnce,
  distributeJetons,
  transferPocketIntoTable,
} from "@/application/services/tables";
import { ensurePokerSeat } from "@/application/services/poker-seats";
import { DomainError, NotFoundError } from "@/domain/errors";
import { assertInvitationUsable } from "@/domain/invitations/types";
import { formatJetons, parseWholeJetons } from "@/domain/money";
import type { Prisma } from "@prisma/client";

const EMAIL_INVITE_HOURS = 48;
const QR_INVITE_DAYS = 14;

export async function inviteByEmail(input: {
  actorId: string;
  tableId: string;
  emails: string[];
  idempotencyKey: string;
  origin: string;
  ip?: string;
}) {
  const emails = [
    ...new Set(
      input.emails
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (emails.length === 0) {
    throw new DomainError("INVALID_EMAIL", "Enter at least one email address.");
  }
  for (const email of emails) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new DomainError("INVALID_EMAIL", "Enter valid email addresses.");
    }
  }
  rateLimit(`invite:${input.actorId}`, 15, 15 * 60_000);
  return withIdempotency(input.actorId, input.idempotencyKey, "inviteByEmail", input, async () => {
    const table = await requireOwnerOrBank(input.tableId, input.actorId);
    const invitations = [];
    let emailWarning: string | null = null;
    for (const email of emails) {
      const token = randomToken();
      const invitation = await prisma.invitation.create({
        data: {
          tableId: table.id,
          kind: "EMAIL",
          email,
          token,
          expiresAt: hoursFromNow(EMAIL_INVITE_HOURS),
          createdById: input.actorId,
        },
      });
      const url = verifiedJoinUrl(input.origin, token);
      try {
        await sendInvitationEmail({
          to: email,
          tableName: table.name,
          url,
          ip: input.ip,
        });
      } catch (error) {
        emailWarning =
          error instanceof Error
            ? error.message
            : "Email delivery is not configured. QR and copy link still work.";
      }
      invitations.push({ id: invitation.id, email });
    }
    publishTable(table.id);
    return { invitations, emailWarning };
  });
}

export async function rotateQrInvitation(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  disable?: boolean;
}) {
  return withIdempotency(input.actorId, input.idempotencyKey, "rotateQrInvitation", input, async () => {
    const table = await requireOwnerOrBank(input.tableId, input.actorId);
    await prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { tableId: table.id, kind: { in: ["QR", "GUEST"] }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!input.disable) {
        await createJoinInvitations(tx, table.id, input.actorId);
      }
      await tx.table.update({
        where: { id: table.id },
        data: { joinEnabled: !input.disable },
      });
    });
    publishTable(table.id);
    return { ok: true };
  });
}

export async function joinWithToken(input: { userId: string; token: string; userEmail: string }) {
  const invitation = await prisma.invitation.findUnique({ where: { token: input.token } });
  if (!invitation) {
    throw new NotFoundError("This invitation is not valid.");
  }
  if (invitation.kind === "GUEST") {
    throw new DomainError("INVITE_MISMATCH", "This is a guest invitation. Join without email.");
  }

  const table = await prisma.table.findUniqueOrThrow({ where: { id: invitation.tableId } });
  if (table.status === "ARCHIVED" || (!table.joinEnabled && invitation.kind === "QR")) {
    throw new DomainError("JOIN_DISABLED", "This table is not accepting new players.");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.tableMember.findUnique({
      where: { tableId_userId: { tableId: table.id, userId: input.userId } },
    });
    if (existing && !existing.leftAt) {
      if (invitation.kind === "EMAIL" && !invitation.usedAt) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { usedAt: new Date() },
        });
      }
      if (table.bankDealerId !== input.userId) {
        await creditStartingJetonsOnce(tx, {
          tableId: table.id,
          memberId: existing.id,
          userId: input.userId,
          actorId: input.userId,
          startingJetonsPerPlayerMillis: table.startingJetonsPerPlayerMillis,
          isBankDealer: false,
          game: table.game,
        });
        await transferPocketIntoTable(tx, {
          tableId: table.id,
          memberId: existing.id,
          userId: input.userId,
          actorId: input.userId,
        });
      }
      if (table.game === "POKER") {
        await ensurePokerSeat(tx, table.id, input.userId);
      }
      await touchTable(tx, table.id);
      return;
    }

    assertInvitationUsable(
      invitation,
      new Date(),
      invitation.kind === "EMAIL" ? input.userEmail : undefined,
    );

    let member = existing;
    if (existing?.leftAt) {
      member = await tx.tableMember.update({
        where: { id: existing.id },
        data: { leftAt: null },
      });
    } else {
      member = await tx.tableMember.create({
        data: {
          tableId: table.id,
          userId: input.userId,
          isOwner: false,
          isBankDealer: false,
        },
      });
    }
    if (invitation.kind === "EMAIL") {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
    }
    if (member && table.bankDealerId !== input.userId) {
      await creditStartingJetonsOnce(tx, {
        tableId: table.id,
        memberId: member.id,
        userId: input.userId,
        actorId: input.userId,
        startingJetonsPerPlayerMillis: table.startingJetonsPerPlayerMillis,
        isBankDealer: false,
        game: table.game,
      });
      await transferPocketIntoTable(tx, {
        tableId: table.id,
        memberId: member.id,
        userId: input.userId,
        actorId: input.userId,
      });
    }
    if (member && table.game === "POKER") {
      await ensurePokerSeat(tx, table.id, input.userId);
    }
    await touchTable(tx, table.id);
  });
  publishTable(table.id);
  return { tableId: table.id };
}

function memberDisplayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email.split("@")[0] || "Player";
}

async function addLocalPlayer(input: {
  actorId: string;
  tableId: string;
  name: string;
  startingJetons?: string;
  idempotencyKey: string;
}) {
  const name = input.name.trim();
  if (!name) {
    throw new DomainError("INVALID_PLAYER_NAME", "Enter a player name.");
  }
  return withIdempotency(input.actorId, input.idempotencyKey, "addPlayerManually", input, async () => {
    await requireOwner(input.tableId, input.actorId);
    const members = await prisma.tableMember.findMany({
      where: { tableId: input.tableId, leftAt: null },
      include: { user: { select: { name: true, email: true } } },
    });
    if (members.some((member) => memberDisplayName(member.user).toLowerCase() === name.toLowerCase())) {
      throw new DomainError("DUPLICATE_PLAYER_NAME", "That player name is already at this table.");
    }
    const requested = input.startingJetons?.trim() ? parseWholeJetons(input.startingJetons, "Starting jetons") : null;
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: `local.${randomToken(8)}@invalid.local`,
        },
      });
      const member = await tx.tableMember.create({
        data: {
          tableId: input.tableId,
          userId: user.id,
          isOwner: false,
          isBankDealer: false,
        },
      });
      const table = await tx.table.findUniqueOrThrow({ where: { id: input.tableId } });
      await creditStartingJetonsOnce(tx, {
        tableId: table.id,
        memberId: member.id,
        userId: user.id,
        actorId: input.actorId,
        startingJetonsPerPlayerMillis: table.startingJetonsPerPlayerMillis,
        isBankDealer: false,
        game: table.game,
      });
      if (table.game === "POKER") {
        await ensurePokerSeat(tx, table.id, user.id);
      }
      await touchTable(tx, table.id);
      return { userId: user.id, starting: table.startingJetonsPerPlayerMillis };
    });
    if (requested && requested > created.starting) {
      await distributeJetons({
        actorId: input.actorId,
        tableId: input.tableId,
        userId: created.userId,
        amount: formatJetons(requested - created.starting),
        idempotencyKey: `${input.idempotencyKey}:extra`,
      });
    }
    publishTable(input.tableId);
    return { joined: true as const, local: true as const };
  });
}

export async function addPlayerManually(input: {
  actorId: string;
  tableId: string;
  email?: string;
  name?: string;
  startingJetons?: string;
  idempotencyKey: string;
  origin: string;
}) {
  const email = (input.email ?? "").trim().toLowerCase();
  const name = (input.name ?? "").trim();
  if (!email) {
    return addLocalPlayer({
      actorId: input.actorId,
      tableId: input.tableId,
      name,
      startingJetons: input.startingJetons,
      idempotencyKey: input.idempotencyKey,
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DomainError("INVALID_EMAIL", "Enter a valid email address.");
  }
  return withIdempotency(input.actorId, input.idempotencyKey, "addPlayerManually", input, async () => {
    await requireOwnerOrBank(input.tableId, input.actorId);
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await prisma.$transaction(async (tx) => {
        const member = await tx.tableMember.upsert({
          where: { tableId_userId: { tableId: input.tableId, userId: existingUser.id } },
          update: { leftAt: null },
          create: {
            tableId: input.tableId,
            userId: existingUser.id,
            isOwner: false,
            isBankDealer: false,
          },
        });
        const table = await tx.table.findUniqueOrThrow({ where: { id: input.tableId } });
        await creditStartingJetonsOnce(tx, {
          tableId: table.id,
          memberId: member.id,
          userId: existingUser.id,
          actorId: input.actorId,
          startingJetonsPerPlayerMillis: table.startingJetonsPerPlayerMillis,
          isBankDealer: table.bankDealerId === existingUser.id,
          game: table.game,
        });
        if (table.game === "POKER") {
          await ensurePokerSeat(tx, table.id, existingUser.id);
        }
      });
      if (input.name && !existingUser.name) {
        await prisma.user.update({ where: { id: existingUser.id }, data: { name: input.name } });
      }
      publishTable(input.tableId);
      return { joined: true as const };
    }
    await inviteByEmail({
      actorId: input.actorId,
      tableId: input.tableId,
      emails: [email],
      idempotencyKey: `${input.idempotencyKey}:invite`,
      origin: input.origin,
    });
    publishTable(input.tableId);
    return { joined: false as const, invited: true as const };
  });
}

export async function joinAsGuest(input: {
  token: string;
  playName: string;
  existingGuestUserId?: string | null;
}) {
  const playName = input.playName.trim();
  const invitation = await prisma.invitation.findUnique({ where: { token: input.token } });
  if (!invitation) {
    throw new NotFoundError("This invitation is not valid.");
  }
  if (invitation.kind !== "GUEST") {
    throw new DomainError("INVITE_MISMATCH", "This invitation requires email confirmation.");
  }
  assertInvitationUsable(invitation, new Date());

  const table = await prisma.table.findUniqueOrThrow({ where: { id: invitation.tableId } });
  if (table.status === "ARCHIVED" || !table.joinEnabled) {
    throw new DomainError("JOIN_DISABLED", "This table is not accepting new players.");
  }

  const result = await prisma.$transaction(async (tx) => {
    if (input.existingGuestUserId) {
      const existingUser = await tx.user.findUnique({ where: { id: input.existingGuestUserId } });
      if (existingUser?.isGuest && existingUser.guestTableId === table.id) {
        const existing = await tx.tableMember.findUnique({
          where: { tableId_userId: { tableId: table.id, userId: existingUser.id } },
        });
        if (existing && !existing.leftAt) {
          await creditStartingJetonsOnce(tx, {
            tableId: table.id,
            memberId: existing.id,
            userId: existingUser.id,
            actorId: existingUser.id,
            startingJetonsPerPlayerMillis: table.startingJetonsPerPlayerMillis,
            isBankDealer: false,
            game: table.game,
          });
          if (table.game === "POKER") {
            await ensurePokerSeat(tx, table.id, existingUser.id);
          }
          await touchTable(tx, table.id);
          return { tableId: table.id, userId: existingUser.id };
        }
      }
    }

    if (!playName) {
      throw new DomainError("INVALID_PLAYER_NAME", "Enter a play name.");
    }

    const members = await tx.tableMember.findMany({
      where: { tableId: table.id, leftAt: null },
      include: { user: { select: { name: true, email: true } } },
    });
    if (members.some((member) => memberDisplayName(member.user).toLowerCase() === playName.toLowerCase())) {
      throw new DomainError("DUPLICATE_PLAYER_NAME", "That player name is already at this table.");
    }

    const guestUser = await tx.user.create({
      data: {
        name: playName,
        email: `guest.${randomToken(12)}@guest.invalid`,
        isGuest: true,
        guestTableId: table.id,
      },
    });
    const member = await tx.tableMember.create({
      data: {
        tableId: table.id,
        userId: guestUser.id,
        isOwner: false,
        isBankDealer: false,
      },
    });
    await creditStartingJetonsOnce(tx, {
      tableId: table.id,
      memberId: member.id,
      userId: guestUser.id,
      actorId: guestUser.id,
      startingJetonsPerPlayerMillis: table.startingJetonsPerPlayerMillis,
      isBankDealer: false,
      game: table.game,
    });
    if (table.game === "POKER") {
      await ensurePokerSeat(tx, table.id, guestUser.id);
    }
    await touchTable(tx, table.id);
    return { tableId: table.id, userId: guestUser.id };
  });
  publishTable(result.tableId);
  return result;
}

export async function createJoinInvitations(
  tx: Prisma.TransactionClient,
  tableId: string,
  createdById: string,
) {
  const expiresAt = hoursFromNow(QR_INVITE_DAYS * 24);
  await tx.invitation.create({
    data: { tableId, kind: "QR", token: randomToken(), expiresAt, createdById },
  });
  await tx.invitation.create({
    data: { tableId, kind: "GUEST", token: randomToken(), expiresAt, createdById },
  });
}

async function touchTable(tx: Prisma.TransactionClient, tableId: string) {
  await tx.table.update({ where: { id: tableId }, data: { updatedAt: new Date() } });
}

