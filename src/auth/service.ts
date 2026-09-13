import { randomUUID } from 'node:crypto';
import type { EscrowService } from '../escrow/service.js';
import { fail } from './errors.js';
import { createMemoryAuthStore, type AuthStore } from './store.js';
import type { Invite, InviteChannel, MagicLink, User } from './types.js';

export const GUEST_ID_PREFIX = 'guest:';

export function guestUserId(deviceId: string): string {
  return `${GUEST_ID_PREFIX}${deviceId}`;
}

export interface RequestMagicLinkInput {
  email?: string;
  phone?: string;
  inviteToken?: string;
  deviceId?: string;
}

export interface VerifyInput {
  token: string;
  acceptedTerms: boolean;
}

export interface JoinMatesInput {
  token: string;
  deviceId: string;
}

export interface CreateInviteInput {
  channel: InviteChannel;
  email?: string;
  phone?: string;
}

export interface EmailOutboxItem {
  to: string;
  magicToken: string;
  verifyUrl: string;
}

export interface SessionView {
  sessionToken: string;
  user: User;
}

const VERIFY_PATH = '/api/auth/verify';
const PREVIEW_PATH = '/api/invites/preview';

export class AuthService {
  readonly emailOutbox: EmailOutboxItem[] = [];

  constructor(
    private readonly escrow: EscrowService,
    private readonly store: AuthStore = createMemoryAuthStore(),
  ) {}

  requestMagicLink(input: RequestMagicLinkInput): { token: string; verifyUrl: string } {
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    if (!email && !phone) {
      fail('CONTACT_REQUIRED', 'Email or phone is required');
    }

    let invite: Invite | undefined;
    if (input.inviteToken) {
      invite = this.requireInvite(input.inviteToken);
      if (invite.channel === 'mates') {
        fail('MATES_NO_MAGIC_LINK', 'Mates invites join immediately; they do not use a magic link');
      }
      assertInviteContactMatch(invite, email, phone);
    }

    let guestDeviceId: string | null = null;
    if (input.deviceId) {
      const deviceId = requireDeviceId(input.deviceId);
      const guest = this.findGuestByDevice(deviceId);
      if (!guest) {
        fail('GUEST_NOT_FOUND', 'No Mates-mode guest exists for this device');
      }
      guestDeviceId = deviceId;
    }

    const token = randomUUID();
    this.store.insertMagicLink({
      token,
      email,
      phone,
      inviteId: invite?.id ?? null,
      guestDeviceId,
    });

    const verifyUrl = `${VERIFY_PATH}?token=${encodeURIComponent(token)}`;
    if (email) {
      this.emailOutbox.push({ to: email, magicToken: token, verifyUrl });
    }
    return { token, verifyUrl };
  }

  verify(input: VerifyInput): SessionView {
    const link = this.store.getMagicLink(input.token);
    if (!link) {
      fail('MAGIC_LINK_INVALID', 'Magic link is invalid or already used', 401);
    }

    const invite = link.inviteId ? this.store.getInvite(link.inviteId) : undefined;
    if (link.inviteId && !invite) {
      fail('INVITE_NOT_FOUND', 'Invite is no longer valid', 404);
    }

    const user = link.guestDeviceId
      ? this.upgradeGuest(link, input.acceptedTerms)
      : this.verifyIdentifiedUser(link, input.acceptedTerms);

    this.store.consumeMagicLink(input.token);

    if (invite) {
      this.addMember(invite.tableId, user.id);
    }

    return this.issueSession(user);
  }

  joinMates(input: JoinMatesInput): SessionView {
    const invite = this.requireInvite(input.token);
    if (invite.channel !== 'mates') {
      fail('NOT_MATES_INVITE', 'This invite is not a Mates-mode guest join');
    }
    const deviceId = requireDeviceId(input.deviceId);
    const existing = this.store.getUserByDeviceId(deviceId);
    const user = existing ?? this.createGuest(deviceId);
    this.addMember(invite.tableId, user.id);
    return this.issueSession(user);
  }

  createTable(sessionToken: string): { id: string; ownerUserId: string } {
    const user = this.requireSessionUser(sessionToken);
    if (user.isGuest || !user.acceptedTermsAt) {
      fail('TERMS_REQUIRED', 'Creating a table requires a verified account that has accepted the T&Cs', 403);
    }
    const table = { id: randomUUID(), ownerUserId: user.id };
    this.store.insertTable(table);
    this.addMember(table.id, user.id);
    return table;
  }

  createInvite(sessionToken: string, tableId: string, input: CreateInviteInput): {
    token: string;
    channel: InviteChannel;
    shareUrl: string | null;
    magicToken: string | null;
    verifyUrl: string | null;
    previewUrl: string;
  } {
    const actor = this.requireSessionUser(sessionToken);
    const table = this.store.getTable(tableId);
    if (!table) {
      fail('TABLE_NOT_FOUND', 'Table not found', 404);
    }
    if (table.ownerUserId !== actor.id && !this.store.isMember(tableId, actor.id)) {
      fail('FORBIDDEN', 'Only a table member can create an invite', 403);
    }

    const channel = input.channel;
    if (!isInviteChannel(channel)) {
      fail('CHANNEL_INVALID', 'channel must be email, whatsapp, qr, or mates');
    }

    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    if (channel === 'email' && !email) {
      fail('CONTACT_REQUIRED', 'Email invites require an email address');
    }
    if ((channel === 'qr' || channel === 'mates') && (email || phone)) {
      fail('CONTACT_NOT_ALLOWED', `${channel} invites do not capture contact details`);
    }

    const invite: Invite = {
      id: randomUUID(),
      tableId,
      token: randomUUID(),
      channel,
      invitedEmail: email,
      invitedPhone: phone,
    };
    this.store.insertInvite(invite);

    const previewUrl = `${PREVIEW_PATH}?token=${encodeURIComponent(invite.token)}`;
    let magicToken: string | null = null;
    let verifyUrl: string | null = null;

    if (channel === 'email' || (channel === 'whatsapp' && (email || phone))) {
      const issued = this.requestMagicLink({
        email: email ?? undefined,
        phone: phone ?? undefined,
        inviteToken: invite.token,
      });
      magicToken = issued.token;
      verifyUrl = issued.verifyUrl;
    }

    let shareUrl: string | null = null;
    if (channel === 'whatsapp') {
      const target = verifyUrl ?? previewUrl;
      shareUrl = `https://wa.me/?text=${encodeURIComponent(`Join the table: ${target}`)}`;
    }

    return {
      token: invite.token,
      channel,
      shareUrl,
      magicToken,
      verifyUrl,
      previewUrl,
    };
  }

  previewInvite(token: string): {
    tableId: string;
    channel: InviteChannel;
    requiresTerms: boolean;
    requiresContact: boolean;
  } {
    const invite = this.requireInvite(token);
    const mates = invite.channel === 'mates';
    return {
      tableId: invite.tableId,
      channel: invite.channel,
      requiresTerms: !mates,
      requiresContact: !mates,
    };
  }

  me(sessionToken: string): {
    user: User;
    wallet: { id: string; userId: string; balance: number } | null;
    tableIds: string[];
  } {
    const user = this.requireSessionUser(sessionToken);
    const wallet = this.escrow.getMasterWallet(user.id);
    return {
      user,
      wallet: wallet
        ? { id: wallet.id, userId: wallet.userId, balance: wallet.balance }
        : null,
      tableIds: this.store.listMembershipsForUser(user.id).map((row) => row.tableId),
    };
  }

  logout(sessionToken: string): void {
    this.store.deleteSession(sessionToken);
  }

  requireSessionUser(sessionToken: string): User {
    if (!sessionToken) {
      fail('UNAUTHENTICATED', 'Sign in required', 401);
    }
    const session = this.store.getSession(sessionToken);
    if (!session) {
      fail('UNAUTHENTICATED', 'Sign in required', 401);
    }
    const user = this.store.getUser(session.userId);
    if (!user) {
      fail('UNAUTHENTICATED', 'Sign in required', 401);
    }
    return user;
  }

  private verifyIdentifiedUser(link: MagicLink, acceptedTerms: boolean): User {
    const existing = this.findUserByContact(link.email, link.phone);
    if (existing) {
      if (existing.isGuest) {
        fail('CONTACT_CONFLICT', 'This contact is attached to a guest identity');
      }
      if (!existing.acceptedTermsAt && !acceptedTerms) {
        fail('TERMS_REQUIRED', 'T&Cs must be accepted to create an account');
      }
      if (!existing.acceptedTermsAt && acceptedTerms) {
        const stamped = { ...existing, acceptedTermsAt: nowIso() };
        this.store.updateUser(stamped);
        return stamped;
      }
      return existing;
    }

    if (!acceptedTerms) {
      fail('TERMS_REQUIRED', 'T&Cs must be accepted to create an account');
    }
    return this.createVerifiedUser({
      email: link.email,
      phone: link.phone,
      deviceId: null,
      upgradedFromUserId: null,
    });
  }

  private upgradeGuest(link: MagicLink, acceptedTerms: boolean): User {
    if (!acceptedTerms) {
      fail('TERMS_REQUIRED', 'T&Cs must be accepted to upgrade a guest account');
    }
    const deviceId = link.guestDeviceId;
    if (!deviceId) {
      fail('GUEST_NOT_FOUND', 'No Mates-mode guest exists for this device');
    }
    const guest = this.findGuestByDevice(deviceId);
    if (!guest) {
      fail('GUEST_NOT_FOUND', 'No Mates-mode guest exists for this device');
    }

    const existing = this.findUserByContact(link.email, link.phone);
    if (existing && existing.id !== guest.id) {
      fail('IDENTITY_TAKEN', 'That email or phone already belongs to another account', 409);
    }

    const verified: User = {
      id: randomUUID(),
      email: link.email,
      phone: link.phone,
      deviceId,
      isGuest: false,
      acceptedTermsAt: nowIso(),
      createdAt: nowIso(),
      upgradedFromUserId: guest.id,
    };
    this.store.insertUser(verified);
    this.escrow.reownMasterWallet(guest.id, verified.id);

    this.store.updateUser({
      ...guest,
      deviceId: null,
    });
    for (const membership of this.store.listMembershipsForUser(guest.id)) {
      this.store.removeMembership(membership.tableId, guest.id);
      this.addMember(membership.tableId, verified.id);
    }
    return verified;
  }

  private createVerifiedUser(input: {
    email: string | null;
    phone: string | null;
    deviceId: string | null;
    upgradedFromUserId: string | null;
  }): User {
    const user: User = {
      id: randomUUID(),
      email: input.email,
      phone: input.phone,
      deviceId: input.deviceId,
      isGuest: false,
      acceptedTermsAt: nowIso(),
      createdAt: nowIso(),
      upgradedFromUserId: input.upgradedFromUserId,
    };
    this.store.insertUser(user);
    this.escrow.ensureMasterWallet(user.id);
    return user;
  }

  private createGuest(deviceId: string): User {
    const existing = this.store.getUser(guestUserId(deviceId));
    if (existing) {
      return existing;
    }
    const user: User = {
      id: guestUserId(deviceId),
      email: null,
      phone: null,
      deviceId,
      isGuest: true,
      acceptedTermsAt: null,
      createdAt: nowIso(),
      upgradedFromUserId: null,
    };
    this.store.insertUser(user);
    this.escrow.ensureMasterWallet(user.id);
    return user;
  }

  private findGuestByDevice(deviceId: string): User | undefined {
    const byDevice = this.store.getUserByDeviceId(deviceId);
    if (byDevice?.isGuest) {
      return byDevice;
    }
    const byId = this.store.getUser(guestUserId(deviceId));
    return byId?.isGuest ? byId : undefined;
  }

  private findUserByContact(email: string | null, phone: string | null): User | undefined {
    const byEmail = email ? this.store.getUserByEmail(email) : undefined;
    const byPhone = phone ? this.store.getUserByPhone(phone) : undefined;
    if (byEmail && byPhone && byEmail.id !== byPhone.id) {
      fail('CONTACT_CONFLICT', 'Email and phone belong to different accounts');
    }
    return byEmail ?? byPhone;
  }

  private requireInvite(token: string): Invite {
    if (!token) {
      fail('INVITE_NOT_FOUND', 'Invite is no longer valid', 404);
    }
    const invite = this.store.getInviteByToken(token);
    if (!invite) {
      fail('INVITE_NOT_FOUND', 'Invite is no longer valid', 404);
    }
    return invite;
  }

  private addMember(tableId: string, userId: string): void {
    if (!this.store.isMember(tableId, userId)) {
      this.store.addMembership({ tableId, userId });
    }
  }

  private issueSession(user: User): SessionView {
    const sessionToken = randomUUID();
    this.store.insertSession({ token: sessionToken, userId: user.id });
    return { sessionToken, user };
  }
}

export function createAuthService(escrow: EscrowService, store?: AuthStore): AuthService {
  return new AuthService(escrow, store ?? createMemoryAuthStore());
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEmail(value: string | undefined): string | null {
  if (value == null) {
    return null;
  }
  const email = value.trim().toLowerCase();
  return email || null;
}

function normalizePhone(value: string | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const phone = trimmed.replace(/[^\d+]/g, '');
  return phone || null;
}

function requireDeviceId(value: string): string {
  const deviceId = value.trim();
  if (!deviceId) {
    fail('DEVICE_REQUIRED', 'deviceId is required');
  }
  return deviceId;
}

function assertInviteContactMatch(invite: Invite, email: string | null, phone: string | null): void {
  if (invite.invitedEmail && email && invite.invitedEmail !== email) {
    fail('INVITE_CONTACT_MISMATCH', 'Email does not match this invite');
  }
  if (invite.invitedPhone && phone && invite.invitedPhone !== phone) {
    fail('INVITE_CONTACT_MISMATCH', 'Phone does not match this invite');
  }
}

function isInviteChannel(value: string): value is InviteChannel {
  return value === 'email' || value === 'whatsapp' || value === 'qr' || value === 'mates';
}
