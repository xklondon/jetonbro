import type { Invite, MagicLink, Membership, Session, TableRecord, User } from './types.js';

export interface AuthStore {
  insertUser(user: User): void;
  updateUser(user: User): void;
  getUser(id: string): User | undefined;
  getUserByEmail(email: string): User | undefined;
  getUserByPhone(phone: string): User | undefined;
  getUserByDeviceId(deviceId: string): User | undefined;
  insertTable(table: TableRecord): void;
  getTable(id: string): TableRecord | undefined;
  insertInvite(invite: Invite): void;
  getInviteByToken(token: string): Invite | undefined;
  getInvite(id: string): Invite | undefined;
  insertMagicLink(link: MagicLink): void;
  getMagicLink(token: string): MagicLink | undefined;
  consumeMagicLink(token: string): MagicLink | undefined;
  insertSession(session: Session): void;
  getSession(token: string): Session | undefined;
  deleteSession(token: string): void;
  addMembership(membership: Membership): void;
  removeMembership(tableId: string, userId: string): void;
  isMember(tableId: string, userId: string): boolean;
  listMembers(tableId: string): string[];
  listMembershipsForUser(userId: string): Membership[];
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
    insertUser(user) {
      users.set(user.id, cloneUser(user));
    },
    updateUser(user) {
      users.set(user.id, cloneUser(user));
    },
    getUser(id) {
      const row = users.get(id);
      return row ? cloneUser(row) : undefined;
    },
    getUserByEmail(email) {
      for (const user of users.values()) {
        if (user.email === email) {
          return cloneUser(user);
        }
      }
      return undefined;
    },
    getUserByPhone(phone) {
      for (const user of users.values()) {
        if (user.phone === phone) {
          return cloneUser(user);
        }
      }
      return undefined;
    },
    getUserByDeviceId(deviceId) {
      for (const user of users.values()) {
        if (user.deviceId === deviceId) {
          return cloneUser(user);
        }
      }
      return undefined;
    },
    insertTable(table) {
      tables.set(table.id, { ...table });
    },
    getTable(id) {
      const row = tables.get(id);
      return row ? { ...row } : undefined;
    },
    insertInvite(invite) {
      const copy = { ...invite };
      invites.set(invite.token, copy);
      invitesById.set(invite.id, copy);
    },
    getInviteByToken(token) {
      const row = invites.get(token);
      return row ? { ...row } : undefined;
    },
    getInvite(id) {
      const row = invitesById.get(id);
      return row ? { ...row } : undefined;
    },
    insertMagicLink(link) {
      magic.set(link.token, { ...link });
    },
    getMagicLink(token) {
      const row = magic.get(token);
      return row ? { ...row } : undefined;
    },
    consumeMagicLink(token) {
      const row = magic.get(token);
      if (!row) {
        return undefined;
      }
      magic.delete(token);
      return { ...row };
    },
    insertSession(session) {
      sessions.set(session.token, { ...session });
    },
    getSession(token) {
      const row = sessions.get(token);
      return row ? { ...row } : undefined;
    },
    deleteSession(token) {
      sessions.delete(token);
    },
    addMembership(membership) {
      const set = members.get(membership.tableId) ?? new Set<string>();
      set.add(membership.userId);
      members.set(membership.tableId, set);
    },
    removeMembership(tableId, userId) {
      members.get(tableId)?.delete(userId);
    },
    isMember(tableId, userId) {
      return members.get(tableId)?.has(userId) ?? false;
    },
    listMembers(tableId) {
      return [...(members.get(tableId) ?? [])];
    },
    listMembershipsForUser(userId) {
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
