import { prisma } from "@/application/db";
import { hoursFromNow, randomToken } from "@/application/ids";
import { withIdempotency } from "@/application/idempotency";
import { sendInvitationEmail } from "@/application/mail";
import { publishTable } from "@/application/realtime/bus";
import { rateLimit } from "@/application/rate-limit";
import { requireOwnerOrBank, creditStartingJetonsOnce } from "@/application/services/tables";
import { DomainError, NotFoundError } from "@/domain/errors";
import { assertInvitationUsable } from "@/domain/invitations/types";

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
      const url = `${input.origin}/join/${token}`;
      await sendInvitationEmail({
        to: email,
        tableName: table.name,
        url,
        ip: input.ip,
      });
      invitations.push({ id: invitation.id, email });
    }
    publishTable(table.id);
    return { invitations };
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
        where: { tableId: table.id, kind: "QR", revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!input.disable) {
        await tx.invitation.create({
          data: {
            tableId: table.id,
            kind: "QR",
            token: randomToken(),
            expiresAt: hoursFromNow(QR_INVITE_DAYS * 24),
            createdById: input.actorId,
          },
        });
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
        });
      }
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
      });
    }
  });
  publishTable(table.id);
  return { tableId: table.id };
}

export async function addPlayerManually(input: {
  actorId: string;
  tableId: string;
  email: string;
  name?: string;
  idempotencyKey: string;
  origin: string;
}) {
  const email = input.email.trim().toLowerCase();
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
        });
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
