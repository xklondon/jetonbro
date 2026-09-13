export type InviteChannel = 'email' | 'whatsapp' | 'qr' | 'mates';

export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  deviceId: string | null;
  isGuest: boolean;
  acceptedTermsAt: string | null;
  createdAt: string;
  upgradedFromUserId: string | null;
}

export interface TableRecord {
  id: string;
  ownerUserId: string;
  protocolId: 'blackjack' | 'poker' | 'zilch';
}

export interface Invite {
  id: string;
  tableId: string;
  token: string;
  channel: InviteChannel;
  invitedEmail: string | null;
  invitedPhone: string | null;
}

export interface MagicLink {
  token: string;
  email: string | null;
  phone: string | null;
  inviteId: string | null;
  guestDeviceId: string | null;
}

export interface Session {
  token: string;
  userId: string;
}

export interface Membership {
  tableId: string;
  userId: string;
}
