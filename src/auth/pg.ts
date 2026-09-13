import type { Pool } from 'pg';
import type { Invite, InviteChannel, MagicLink, Membership, Session, TableRecord, User } from './types.js';
import type { AuthStore } from './store.js';

interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  device_id: string | null;
  is_guest: boolean;
  accepted_terms_at: string | null;
  created_at: string;
  upgraded_from_user_id: string | null;
}

interface TableRow {
  id: string;
  owner_user_id: string;
  protocol_id: TableRecord['protocolId'];
}

interface InviteRow {
  id: string;
  table_id: string;
  token: string;
  channel: InviteChannel;
  invited_email: string | null;
  invited_phone: string | null;
  opening_chips: number;
  claimed_by_user_id: string | null;
  opening_credited: boolean;
  magic_token: string | null;
  join_path: string;
}

interface MagicRow {
  token: string;
  email: string | null;
  phone: string | null;
  invite_id: string | null;
  guest_device_id: string | null;
}

export function createPgAuthStore(pool: Pool): AuthStore {
  return {
    async insertUser(user) {
      await pool.query(
        `INSERT INTO users
           (id, email, phone, device_id, is_guest, accepted_terms_at, created_at, upgraded_from_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id,
          user.email,
          user.phone,
          user.deviceId,
          user.isGuest,
          user.acceptedTermsAt,
          user.createdAt,
          user.upgradedFromUserId,
        ],
      );
    },
    async updateUser(user) {
      await pool.query(
        `UPDATE users SET email = $2, phone = $3, device_id = $4, is_guest = $5,
           accepted_terms_at = $6, created_at = $7, upgraded_from_user_id = $8
         WHERE id = $1`,
        [
          user.id,
          user.email,
          user.phone,
          user.deviceId,
          user.isGuest,
          user.acceptedTermsAt,
          user.createdAt,
          user.upgradedFromUserId,
        ],
      );
    },
    async getUser(id) {
      const result = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0] ? toUser(result.rows[0]) : undefined;
    },
    async getUserByEmail(email) {
      const result = await pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0] ? toUser(result.rows[0]) : undefined;
    },
    async getUserByPhone(phone) {
      const result = await pool.query<UserRow>('SELECT * FROM users WHERE phone = $1', [phone]);
      return result.rows[0] ? toUser(result.rows[0]) : undefined;
    },
    async getUserByDeviceId(deviceId) {
      const result = await pool.query<UserRow>('SELECT * FROM users WHERE device_id = $1', [deviceId]);
      return result.rows[0] ? toUser(result.rows[0]) : undefined;
    },
    async insertTable(table) {
      await pool.query(
        `INSERT INTO tables (id, owner_user_id, protocol_id) VALUES ($1, $2, $3)`,
        [table.id, table.ownerUserId, table.protocolId],
      );
    },
    async getTable(id) {
      const result = await pool.query<TableRow>('SELECT * FROM tables WHERE id = $1', [id]);
      return result.rows[0] ? toTable(result.rows[0]) : undefined;
    },
    async insertInvite(invite) {
      await pool.query(
        `INSERT INTO invites
           (id, table_id, token, channel, invited_email, invited_phone, opening_chips,
            claimed_by_user_id, opening_credited, magic_token, join_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        inviteValues(invite),
      );
    },
    async updateInvite(invite) {
      await pool.query(
        `UPDATE invites SET table_id = $2, token = $3, channel = $4, invited_email = $5, invited_phone = $6,
           opening_chips = $7, claimed_by_user_id = $8, opening_credited = $9, magic_token = $10, join_path = $11
         WHERE id = $1`,
        inviteValues(invite),
      );
    },
    async getInviteByToken(token) {
      const result = await pool.query<InviteRow>('SELECT * FROM invites WHERE token = $1', [token]);
      return result.rows[0] ? toInvite(result.rows[0]) : undefined;
    },
    async getInvite(id) {
      const result = await pool.query<InviteRow>('SELECT * FROM invites WHERE id = $1', [id]);
      return result.rows[0] ? toInvite(result.rows[0]) : undefined;
    },
    async listInvitesForTable(tableId) {
      const result = await pool.query<InviteRow>(
        'SELECT * FROM invites WHERE table_id = $1 ORDER BY id',
        [tableId],
      );
      return result.rows.map(toInvite);
    },
    async insertMagicLink(link) {
      await pool.query(
        `INSERT INTO magic_links (token, email, phone, invite_id, guest_device_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [link.token, link.email, link.phone, link.inviteId, link.guestDeviceId],
      );
    },
    async getMagicLink(token) {
      const result = await pool.query<MagicRow>('SELECT * FROM magic_links WHERE token = $1', [token]);
      return result.rows[0] ? toMagic(result.rows[0]) : undefined;
    },
    async consumeMagicLink(token) {
      const result = await pool.query<MagicRow>(
        'DELETE FROM magic_links WHERE token = $1 RETURNING *',
        [token],
      );
      return result.rows[0] ? toMagic(result.rows[0]) : undefined;
    },
    async insertSession(session) {
      await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [session.token, session.userId]);
    },
    async getSession(token) {
      const result = await pool.query<{ token: string; user_id: string }>(
        'SELECT * FROM sessions WHERE token = $1',
        [token],
      );
      const row = result.rows[0];
      return row ? { token: row.token, userId: row.user_id } : undefined;
    },
    async deleteSession(token) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    },
    async addMembership(membership) {
      await pool.query(
        `INSERT INTO memberships (table_id, user_id) VALUES ($1, $2)
         ON CONFLICT (table_id, user_id) DO NOTHING`,
        [membership.tableId, membership.userId],
      );
    },
    async removeMembership(tableId, userId) {
      await pool.query('DELETE FROM memberships WHERE table_id = $1 AND user_id = $2', [tableId, userId]);
    },
    async isMember(tableId, userId) {
      const result = await pool.query(
        'SELECT 1 FROM memberships WHERE table_id = $1 AND user_id = $2',
        [tableId, userId],
      );
      return (result.rowCount ?? 0) > 0;
    },
    async listMembers(tableId) {
      const result = await pool.query<{ user_id: string }>(
        'SELECT user_id FROM memberships WHERE table_id = $1 ORDER BY added_at, user_id',
        [tableId],
      );
      return result.rows.map((row) => row.user_id);
    },
    async listMembershipsForUser(userId) {
      const result = await pool.query<{ table_id: string; user_id: string }>(
        'SELECT table_id, user_id FROM memberships WHERE user_id = $1 ORDER BY added_at, table_id',
        [userId],
      );
      return result.rows.map((row): Membership => ({ tableId: row.table_id, userId: row.user_id }));
    },
  };
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    deviceId: row.device_id,
    isGuest: row.is_guest,
    acceptedTermsAt: row.accepted_terms_at,
    createdAt: row.created_at,
    upgradedFromUserId: row.upgraded_from_user_id,
  };
}

function toTable(row: TableRow): TableRecord {
  return { id: row.id, ownerUserId: row.owner_user_id, protocolId: row.protocol_id };
}

function toInvite(row: InviteRow): Invite {
  return {
    id: row.id,
    tableId: row.table_id,
    token: row.token,
    channel: row.channel,
    invitedEmail: row.invited_email,
    invitedPhone: row.invited_phone,
    openingChips: Number(row.opening_chips),
    claimedByUserId: row.claimed_by_user_id,
    openingCredited: row.opening_credited,
    magicToken: row.magic_token,
    joinPath: row.join_path,
  };
}

function toMagic(row: MagicRow): MagicLink {
  return {
    token: row.token,
    email: row.email,
    phone: row.phone,
    inviteId: row.invite_id,
    guestDeviceId: row.guest_device_id,
  };
}

function inviteValues(invite: Invite): unknown[] {
  return [
    invite.id,
    invite.tableId,
    invite.token,
    invite.channel,
    invite.invitedEmail,
    invite.invitedPhone,
    invite.openingChips,
    invite.claimedByUserId,
    invite.openingCredited,
    invite.magicToken,
    invite.joinPath,
  ];
}
