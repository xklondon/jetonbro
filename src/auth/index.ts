export { AuthError } from './errors.js';
export { createAuthService, AuthService, guestUserId, GUEST_ID_PREFIX } from './service.js';
export { createMemoryAuthStore, type AuthStore } from './store.js';
export type {
  Invite,
  InviteChannel,
  MagicLink,
  Membership,
  Session,
  TableRecord,
  User,
} from './types.js';
