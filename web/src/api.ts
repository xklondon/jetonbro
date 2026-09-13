export interface AllowedAction {
  id: string;
  label: string;
  locksChips: boolean;
  requiresBox: boolean;
  resolvesPot: boolean;
  releasesBox?: boolean;
}

export interface TableBox {
  id: string;
  ownerUserId: string;
  ownerLabel: string;
  stake: number;
  status: string;
  escrowState: string | null;
  outcome: string | null;
  suggestedPayout: number | null;
}

export interface TableSnapshot {
  tableId: string;
  protocolId: string;
  phase: string;
  flags: Record<string, boolean>;
  boxes: TableBox[];
  pot: { amount: number };
  authorityUserId: string | null;
  multipliers: Record<string, number> | null;
  currentTurnUserId: string;
  settingsAccess: boolean;
  payoutRule: string;
  viewer: {
    id: string;
    label: string;
    roles: string[];
    stack: number;
    masterBalance: number;
    allowedActions: AllowedAction[];
    handDisplay: { userId: string; text: string; photo: string };
  };
  players: {
    id: string;
    label: string;
    stack: number;
    handDisplay: { userId: string; text: string; photo: string };
  }[];
  invites: TableInvite[];
}

export interface TableInvite {
  id: string;
  channel: string;
  label: string;
  openingChips: number;
  status: 'pending' | 'joined';
  claimedByUserId: string | null;
  joinPath: string | null;
  shareUrl: string | null;
}

export interface StandingRow {
  otherUserId: string;
  otherLabel: string;
  standing: { status: 'settled' } | { status: 'owes'; owes: string; amount: number };
}

export function createApi(base = '', getToken: () => string | null = () => null) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    const token = getToken();
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    const res = await fetch(`${base}${path}`, { ...init, headers });
    if (res.status === 204) {
      return undefined as T;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((body as { message?: string }).message ?? res.statusText);
    }
    return body as T;
  }

  return {
    requestMagicLink: (email: string, inviteToken?: string) =>
      request<{ token?: string; verifyUrl?: string; emailed?: boolean }>('/api/auth/request-magic-link', {
        method: 'POST',
        body: JSON.stringify({ email, inviteToken }),
      }),
    inspectVerify: (token: string) =>
      request<{ email: string | null; requiresTerms: boolean; isUpgrade: boolean; tableId: string | null }>(
        `/api/auth/verify?token=${encodeURIComponent(token)}`,
      ),
    completeVerify: (token: string) =>
      request<{ sessionToken: string; user: { id: string }; tableId: string | null }>('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    me: () => request<{ user: { id: string; email: string | null }; wallet: { balance: number } | null; tableIds: string[] }>('/api/auth/me'),
    createTable: (protocolId: string) =>
      request<{ id: string }>('/api/tables', { method: 'POST', body: JSON.stringify({ protocolId }) }),
    snapshot: (tableId: string) => request<TableSnapshot>(`/api/tables/${tableId}`),
    createInvite: (
      tableId: string,
      body: { channel: string; email?: string; phone?: string; openingChips?: number },
    ) =>
      request<{ token: string; magicToken: string | null; joinPath: string; shareUrl: string | null }>(
        `/api/tables/${tableId}/invites`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
    previewInvite: (token: string) =>
      request<{ tableId: string; channel: string; requiresTerms: boolean; requiresContact: boolean }>(
        `/api/invites/preview?token=${encodeURIComponent(token)}`,
      ),
    act: (tableId: string, body: Record<string, unknown>) =>
      request<TableSnapshot>(`/api/tables/${tableId}/actions`, { method: 'POST', body: JSON.stringify(body) }),
    buyIn: (tableId: string, amount: number) =>
      request<TableSnapshot>(`/api/tables/${tableId}/buy-in`, { method: 'POST', body: JSON.stringify({ amount }) }),
    setHandDisplay: (tableId: string, body: { text?: string; photo?: string }) =>
      request<TableSnapshot>(`/api/tables/${tableId}/hand-display`, { method: 'POST', body: JSON.stringify(body) }),
    standings: () => request<{ rows: StandingRow[] }>('/api/standings'),
    saveStandings: (otherUserId?: string) =>
      request('/api/standings/save', { method: 'POST', body: JSON.stringify({ otherUserId }) }),
    clearStandings: (otherUserId: string) =>
      request('/api/standings/clear', { method: 'POST', body: JSON.stringify({ otherUserId }) }),
  };
}

export type Api = ReturnType<typeof createApi>;
