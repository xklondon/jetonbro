import { randomUUID } from 'node:crypto';
import type { EscrowService } from '../escrow/service.js';
import { fail } from './errors.js';
import type { MagicLinkMailer } from './mailer.js';
import { createMemoryAuthStore, type AuthStore } from './store.js';
import type { Invite, InviteChannel, MagicLink, TableRecord, User } from './types.js';

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
  acceptedTerms?: boolean;
}

export interface JoinMatesInput {
  token: string;
  deviceId: string;
}

export interface CreateInviteInput {
  channel: InviteChannel;
  email?: string;
  phone?: string;
  openingChips?: number;
}

export interface EmailOutboxItem {
  to: string;
  magicToken: string;
  verifyUrl: string;
}

export interface SessionView {
  sessionToken: string;
  user: User;
  tableId: string | null;
}

export interface AuthServiceOptions {
  mailer?: MagicLinkMailer | null;
  appOrigin?: string;
}

export interface MagicLinkResult {
  token: string;
  verifyUrl: string;
  pageUrl: string;
  emailed: boolean;
}

export interface CreatedInvite {
  token: string;
  channel: InviteChannel;
  shareUrl: string | null;
  magicToken: string | null;
  verifyUrl: string | null;
  previewUrl: string;
  joinPath: string;
  openingChips: number;
}

const VERIFY_PATH = '/api/auth/verify';
const PREVIEW_PATH = '/api/invites/preview';

export class AuthService {
  readonly emailOutbox: EmailOutboxItem[] = [];

  constructor(
    private readonly escrow: EscrowService,
    private readonly store: AuthStore = createMemoryAuthStore(),
    private readonly options: AuthServiceOptions = {},
  ) {}

  async requestMagicLink(input: RequestMagicLinkInput): Promise<MagicLinkResult> {
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    if (!email && !phone) {
      fail('CONTACT_REQUIRED', 'Email or phone is required');
    }

    let invite: Invite | undefined;
    if (input.inviteToken) {
      invite = await this.requireInvite(input.inviteToken);
      if (invite.channel === 'mates') {
        fail('MATES_NO_MAGIC_LINK', 'Mates invites join immediately; they do not use a magic link');
      }
      assertInviteContactMatch(invite, email, phone);
    }

    let guestDeviceId: string | null = null;
    if (input.deviceId) {
      const deviceId = requireDeviceId(input.deviceId);
      const guest = await this.findGuestByDevice(deviceId);
      if (!guest) {
        fail('GUEST_NOT_FOUND', 'No Mates-mode guest exists for this device');
      }
      guestDeviceId = deviceId;
    }

    const token = randomUUID();
    await this.store.insertMagicLink({
      token,
      email,
      phone,
      inviteId: invite?.id ?? null,
      guestDeviceId,
    });

    const verifyUrl = `${VERIFY_PATH}?token=${encodeURIComponent(token)}`;
    const pageUrl = this.pageVerifyUrl(token);
    if (email) {
      this.emailOutbox.push({ to: email, magicToken: token, verifyUrl });
    }

    const shouldEmail = Boolean(email && this.options.mailer && isEmailDeliveryChannel(invite));
    if (shouldEmail && email && this.options.mailer) {
      if (!this.options.appOrigin) {
        fail('MAIL_ORIGIN_MISSING', 'APP_ORIGIN is required to email a magic link');
      }
      await this.options.mailer.send({ to: email, verifyPageUrl: pageUrl });
    }

    return { token, verifyUrl, pageUrl, emailed: shouldEmail };
  }

  /**
   * Validate a magic-link token only. Does not consume the link, accept
   * T&Cs, create an account, or provision a wallet.
   */
  async inspectMagicLink(token: string): Promise<{
    email: string | null;
    phone: string | null;
    requiresTerms: boolean;
    isUpgrade: boolean;
    inviteChannel: InviteChannel | null;
    tableId: string | null;
  }> {
    const link = await this.store.getMagicLink(token);
    if (!link) {
      fail('MAGIC_LINK_INVALID', 'Magic link is invalid or already used', 401);
    }
    const invite = link.inviteId ? await this.store.getInvite(link.inviteId) : undefined;
    const isUpgrade = Boolean(link.guestDeviceId);
    return {
      email: link.email,
      phone: link.phone,
      requiresTerms: false,
      isUpgrade,
      inviteChannel: invite?.channel ?? null,
      tableId: invite?.tableId ?? null,
    };
  }

  async verify(input: VerifyInput): Promise<SessionView> {
    const link = await this.store.getMagicLink(input.token);
    if (!link) {
      fail('MAGIC_LINK_INVALID', 'Magic link is invalid or already used', 401);
    }

    const invite = link.inviteId ? await this.store.getInvite(link.inviteId) : undefined;
    if (link.inviteId && !invite) {
      fail('INVITE_NOT_FOUND', 'Invite is no longer valid', 404);
    }

    const user = link.guestDeviceId ? await this.upgradeGuest(link) : await this.verifyIdentifiedUser(link);

    await this.store.consumeMagicLink(input.token);

    if (invite) {
      await this.addMember(invite.tableId, user.id);
      await this.claimInvite(invite, user.id);
    }

    return this.issueSession(user, invite?.tableId ?? null);
  }

  async joinMates(input: JoinMatesInput): Promise<SessionView> {
    const invite = await this.requireInvite(input.token);
    if (invite.channel !== 'mates') {
      fail('NOT_MATES_INVITE', 'This invite is not a Mates-mode guest join');
    }
    const deviceId = requireDeviceId(input.deviceId);
    const existing = await this.store.getUserByDeviceId(deviceId);
    const user = existing ?? (await this.createGuest(deviceId));
    await this.addMember(invite.tableId, user.id);
    await this.claimInvite(invite, user.id);
    return this.issueSession(user, invite.tableId);
  }

  async createTable(
    sessionToken: string,
    input: { protocolId?: TableRecord['protocolId'] } = {},
  ): Promise<TableRecord> {
    const user = await this.requireSessionUser(sessionToken);
    if (user.isGuest) {
      fail('FORBIDDEN', 'Creating a table requires a verified account', 403);
    }
    const protocolId = input.protocolId ?? 'blackjack';
    if (protocolId !== 'blackjack' && protocolId !== 'poker' && protocolId !== 'zilch') {
      fail('PROTOCOL_INVALID', 'protocolId must be blackjack, poker, or zilch');
    }
    const table: TableRecord = { id: randomUUID(), ownerUserId: user.id, protocolId };
    await this.store.insertTable(table);
    await this.addMember(table.id, user.id);
    return table;
  }

  async getTable(tableId: string): Promise<TableRecord | undefined> {
    return this.store.getTable(tableId);
  }

  async listMemberIds(tableId: string): Promise<string[]> {
    return this.store.listMembers(tableId);
  }

  async getUser(userId: string): Promise<User | undefined> {
    return this.store.getUser(userId);
  }

  async listInvites(tableId: string): Promise<Invite[]> {
    return this.store.listInvitesForTable(tableId);
  }

  async markOpeningCredited(inviteId: string): Promise<void> {
    const invite = await this.store.getInvite(inviteId);
    if (!invite) {
      return;
    }
    await this.store.updateInvite({ ...invite, openingCredited: true });
  }

  async createInvite(sessionToken: string, tableId: string, input: CreateInviteInput): Promise<CreatedInvite> {
    const actor = await this.requireSessionUser(sessionToken);
    const table = await this.store.getTable(tableId);
    if (!table) {
      fail('TABLE_NOT_FOUND', 'Table not found', 404);
    }
    if (table.ownerUserId !== actor.id) {
      fail('FORBIDDEN', 'Only the table owner can add a player', 403);
    }

    const channel = input.channel;
    if (!isInviteChannel(channel)) {
      fail('CHANNEL_INVALID', 'channel must be email, whatsapp, qr, or mates');
    }

    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    const openingChips = input.openingChips ?? 0;
    if (!Number.isInteger(openingChips) || openingChips < 0) {
      fail('AMOUNT_INVALID', 'openingChips must be a non-negative integer');
    }
    if (channel === 'email' && !email) {
      fail('CONTACT_REQUIRED', 'Email invites require an email address');
    }
    if ((channel === 'qr' || channel === 'mates') && (email || phone)) {
      fail('CONTACT_NOT_ALLOWED', `${channel} invites do not capture contact details`);
    }

    const inviteToken = randomUUID();
    const invite: Invite = {
      id: randomUUID(),
      tableId,
      token: inviteToken,
      channel,
      invitedEmail: email,
      invitedPhone: phone,
      openingChips,
      claimedByUserId: null,
      openingCredited: false,
      magicToken: null,
      joinPath: `/invite/${inviteToken}`,
    };
    await this.store.insertInvite(invite);

    const previewUrl = `${PREVIEW_PATH}?token=${encodeURIComponent(invite.token)}`;
    let magicToken: string | null = null;
    let verifyUrl: string | null = null;

    if (channel === 'email' || (channel === 'whatsapp' && (email || phone))) {
      const issued = await this.requestMagicLink({
        email: email ?? undefined,
        phone: phone ?? undefined,
        inviteToken: invite.token,
      });
      magicToken = issued.token;
      verifyUrl = issued.verifyUrl;
      invite.magicToken = magicToken;
      invite.joinPath = `/verify?token=${encodeURIComponent(magicToken)}`;
      await this.store.updateInvite(invite);
    }

    let shareUrl: string | null = null;
    if (channel === 'whatsapp') {
      const target = invite.joinPath;
      shareUrl = `https://wa.me/?text=${encodeURIComponent(`Join the table: ${target}`)}`;
    }

    return {
      token: invite.token,
      channel,
      shareUrl,
      magicToken,
      verifyUrl,
      previewUrl,
      joinPath: invite.joinPath,
      openingChips,
    };
  }

  async previewInvite(token: string): Promise<{
    tableId: string;
    channel: InviteChannel;
    requiresTerms: boolean;
    requiresContact: boolean;
  }> {
    const invite = await this.requireInvite(token);
    const mates = invite.channel === 'mates';
    return {
      tableId: invite.tableId,
      channel: invite.channel,
      requiresTerms: false,
      requiresContact: !mates,
    };
  }

  async me(sessionToken: string): Promise<{
    user: User;
    wallet: { id: string; userId: string; balance: number } | null;
    tableIds: string[];
  }> {
    const user = await this.requireSessionUser(sessionToken);
    const wallet = await this.escrow.getMasterWallet(user.id);
    return {
      user,
      wallet: wallet
        ? { id: wallet.id, userId: wallet.userId, balance: wallet.balance }
        : null,
      tableIds: (await this.store.listMembershipsForUser(user.id)).map((row) => row.tableId),
    };
  }

  async logout(sessionToken: string): Promise<void> {
    await this.store.deleteSession(sessionToken);
  }

  async requireSessionUser(sessionToken: string): Promise<User> {
    if (!sessionToken) {
      fail('UNAUTHENTICATED', 'Sign in required', 401);
    }
    const session = await this.store.getSession(sessionToken);
    if (!session) {
      fail('UNAUTHENTICATED', 'Sign in required', 401);
    }
    const user = await this.store.getUser(session.userId);
    if (!user) {
      fail('UNAUTHENTICATED', 'Sign in required', 401);
    }
    return user;
  }

  private async verifyIdentifiedUser(link: MagicLink): Promise<User> {
    const existing = await this.findUserByContact(link.email, link.phone);
    if (existing) {
      if (existing.isGuest) {
        fail('CONTACT_CONFLICT', 'This contact is attached to a guest identity');
      }
      return existing;
    }
    return this.createVerifiedUser({
      email: link.email,
      phone: link.phone,
      deviceId: null,
      upgradedFromUserId: null,
    });
  }

  private async upgradeGuest(link: MagicLink): Promise<User> {
    const deviceId = link.guestDeviceId;
    if (!deviceId) {
      fail('GUEST_NOT_FOUND', 'No Mates-mode guest exists for this device');
    }
    const guest = await this.findGuestByDevice(deviceId);
    if (!guest) {
      fail('GUEST_NOT_FOUND', 'No Mates-mode guest exists for this device');
    }

    const existing = await this.findUserByContact(link.email, link.phone);
    if (existing && existing.id !== guest.id) {
      fail('IDENTITY_TAKEN', 'That email or phone already belongs to another account', 409);
    }

    const verified: User = {
      id: randomUUID(),
      email: link.email,
      phone: link.phone,
      deviceId,
      isGuest: false,
      acceptedTermsAt: null,
      createdAt: nowIso(),
      upgradedFromUserId: guest.id,
    };
    await this.store.insertUser(verified);
    await this.escrow.reownMasterWallet(guest.id, verified.id);

    await this.store.updateUser({
      ...guest,
      deviceId: null,
    });
    for (const membership of await this.store.listMembershipsForUser(guest.id)) {
      await this.store.removeMembership(membership.tableId, guest.id);
      await this.addMember(membership.tableId, verified.id);
    }
    return verified;
  }

  private async createVerifiedUser(input: {
    email: string | null;
    phone: string | null;
    deviceId: string | null;
    upgradedFromUserId: string | null;
  }): Promise<User> {
    const user: User = {
      id: randomUUID(),
      email: input.email,
      phone: input.phone,
      deviceId: input.deviceId,
      isGuest: false,
      acceptedTermsAt: null,
      createdAt: nowIso(),
      upgradedFromUserId: input.upgradedFromUserId,
    };
    await this.store.insertUser(user);
    await this.escrow.ensureMasterWallet(user.id);
    return user;
  }

  private async createGuest(deviceId: string): Promise<User> {
    const existing = await this.store.getUser(guestUserId(deviceId));
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
    await this.store.insertUser(user);
    await this.escrow.ensureMasterWallet(user.id);
    return user;
  }

  private async findGuestByDevice(deviceId: string): Promise<User | undefined> {
    const byDevice = await this.store.getUserByDeviceId(deviceId);
    if (byDevice?.isGuest) {
      return byDevice;
    }
    const byId = await this.store.getUser(guestUserId(deviceId));
    return byId?.isGuest ? byId : undefined;
  }

  private async findUserByContact(email: string | null, phone: string | null): Promise<User | undefined> {
    const byEmail = email ? await this.store.getUserByEmail(email) : undefined;
    const byPhone = phone ? await this.store.getUserByPhone(phone) : undefined;
    if (byEmail && byPhone && byEmail.id !== byPhone.id) {
      fail('CONTACT_CONFLICT', 'Email and phone belong to different accounts');
    }
    return byEmail ?? byPhone;
  }

  private async requireInvite(token: string): Promise<Invite> {
    if (!token) {
      fail('INVITE_NOT_FOUND', 'Invite is no longer valid', 404);
    }
    const invite = await this.store.getInviteByToken(token);
    if (!invite) {
      fail('INVITE_NOT_FOUND', 'Invite is no longer valid', 404);
    }
    return invite;
  }

  private async addMember(tableId: string, userId: string): Promise<void> {
    if (!(await this.store.isMember(tableId, userId))) {
      await this.store.addMembership({ tableId, userId });
    }
  }

  private async claimInvite(invite: Invite, userId: string): Promise<void> {
    if (invite.claimedByUserId) {
      return;
    }
    await this.store.updateInvite({ ...invite, claimedByUserId: userId });
  }

  private async issueSession(user: User, tableId: string | null = null): Promise<SessionView> {
    const sessionToken = randomUUID();
    await this.store.insertSession({ token: sessionToken, userId: user.id });
    return { sessionToken, user, tableId };
  }

  private pageVerifyUrl(token: string): string {
    const origin = (this.options.appOrigin ?? '').replace(/\/$/, '');
    const path = `/verify?token=${encodeURIComponent(token)}`;
    return origin ? `${origin}${path}` : path;
  }
}

export function createAuthService(
  escrow: EscrowService,
  store?: AuthStore,
  options?: AuthServiceOptions,
): AuthService {
  return new AuthService(escrow, store ?? createMemoryAuthStore(), options ?? {});
}

function isEmailDeliveryChannel(invite: Invite | undefined): boolean {
  return !invite || invite.channel === 'email';
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
