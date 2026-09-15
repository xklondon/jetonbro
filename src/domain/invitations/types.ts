import { DomainError } from "../errors";

export const INVITATION_KINDS = ["EMAIL", "QR"] as const;
export type InvitationKind = (typeof INVITATION_KINDS)[number];

export type InvitationRecord = {
  kind: InvitationKind;
  email: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  usedAt: Date | null;
};

export function assertInvitationUsable(
  invitation: InvitationRecord,
  now: Date,
  recipientEmail?: string,
): void {
  if (invitation.revokedAt) {
    throw new DomainError("INVITE_REVOKED", "This invitation is no longer valid.");
  }
  if (invitation.expiresAt.getTime() <= now.getTime()) {
    throw new DomainError("INVITE_EXPIRED", "This invitation has expired.");
  }
  if (invitation.kind === "EMAIL") {
    if (invitation.usedAt) {
      throw new DomainError("INVITE_USED", "This invitation has already been used.");
    }
    if (
      recipientEmail &&
      invitation.email &&
      invitation.email.toLowerCase() !== recipientEmail.toLowerCase()
    ) {
      throw new DomainError("INVITE_MISMATCH", "This invitation belongs to a different email.");
    }
  }
}
