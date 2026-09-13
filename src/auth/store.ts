import type { Invite, MagicLink, Membership, Session, TableRecord, User } from './types.js';

export interface AuthStore {
  insertUser(user: User): Promise<void>;
  updateUser(user: User): Promise<void>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByDeviceId(deviceId: string): Promise<User | undefined>;
  insertTable(table: TableRecord): Promise<void>;
  getTable(id: string): Promise<TableRecord | undefined>;
  insertInvite(invite: Invite): Promise<void>;
  updateInvite(invite: Invite): Promise<void>;
  getInviteByToken(token: string): Promise<Invite | undefined>;
  getInvite(id: string): Promise<Invite | undefined>;
  listInvitesForTable(tableId: string): Promise<Invite[]>;
  insertMagicLink(link: MagicLink): Promise<void>;
  getMagicLink(token: string): Promise<MagicLink | undefined>;
  consumeMagicLink(token: string): Promise<MagicLink | undefined>;
  insertSession(session: Session): Promise<void>;
  getSession(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;
  addMembership(membership: Membership): Promise<void>;
  removeMembership(tableId: string, userId: string): Promise<void>;
  isMember(tableId: string, userId: string): Promise<boolean>;
  listMembers(tableId: string): Promise<string[]>;
  listMembershipsForUser(userId: string): Promise<Membership[]>;
}

export function createMemoryAuthStore(): AuthStore {
  const users = new Map<string, User>();
  const tables = new Map<string, TableRecord>();
  const invites = new Map<string, Invite>();
  const invitesById = new Map<string, Invite>();
  const magic = new Map<string, MagicLink>();
  const sessions = new Map<string, Session>();
  const members = new Map<string, Set<string>>();

  const cloneUser = (user: User): User => ({ ...user });

  return {
    async insertUser(user) {
      users.set(user.id, cloneUser(user));
    },
    async updateUser(user) {
      users.set(user.id, cloneUser(user));
    },
    async getUser(id) {
      const row = users.get(id);
      return row ? cloneUser(row) : undefined;
    },
    async getUserByEmail(email) {
      for (const user of users.values()) {
        if (user.email === email) {
          return cloneUser(user);
        }
      }
      return undefined;
    },
    async getUserByPhone(phone) {
      for (const user of users.values()) {
        if (user.phone === phone) {
          return cloneUser(user);
        }
      }
      return undefined;
    },
    async getUserByDeviceId(deviceId) {
      for (const user of users.values()) {
        if (user.deviceId === deviceId) {
          return cloneUser(user);
        }
      }
      return undefined;
    },
    async insertTable(table) {
      tables.set(table.id, { ...table });
    },
    async getTable(id) {
      const row = tables.get(id);
      return row ? { ...row } : undefined;
    },
    async insertInvite(invite) {
      const copy = { ...invite };
      invites.set(invite.token, copy);
      invitesById.set(invite.id, copy);
    },
    async updateInvite(invite) {
      const copy = { ...invite };
      invites.set(invite.token, copy);
      invitesById.set(invite.id, copy);
    },
    async listInvitesForTable(tableId) {
      return [...invitesById.values()].filter((invite) => invite.tableId === tableId).map((invite) => ({ ...invite }));
    },
    async getInviteByToken(token) {
      const row = invites.get(token);
      return row ? { ...row } : undefined;
    },
    async getInvite(id) {
      const row = invitesById.get(id);
      return row ? { ...row } : undefined;
    },
    async insertMagicLink(link) {
      magic.set(link.token, { ...link });
    },
    async getMagicLink(token) {
      const row = magic.get(token);
      return row ? { ...row } : undefined;
    },
    async consumeMagicLink(token) {
      const row = magic.get(token);
      if (!row) {
        return undefined;
      }
      magic.delete(token);
      return { ...row };
    },
    async insertSession(session) {
      sessions.set(session.token, { ...session });
    },
    async getSession(token) {
      const row = sessions.get(token);
      return row ? { ...row } : undefined;
    },
    async deleteSession(token) {
      sessions.delete(token);
    },
    async addMembership(membership) {
      const set = members.get(membership.tableId) ?? new Set<string>();
      set.add(membership.userId);
      members.set(membership.tableId, set);
    },
    async removeMembership(tableId, userId) {
      members.get(tableId)?.delete(userId);
    },
    async isMember(tableId, userId) {
      return members.get(tableId)?.has(userId) ?? false;
    },
    async listMembers(tableId) {
      return [...(members.get(tableId) ?? [])];
    },
    async listMembershipsForUser(userId) {
      const out: Membership[] = [];
      for (const [tableId, set] of members) {
        if (set.has(userId)) {
          out.push({ tableId, userId });
        }
      }
      return out;
    },
  };
}
