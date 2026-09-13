export interface AllowedAction {
  id: string;
  label: string;
  locksChips: boolean;
  requiresBox: boolean;
  creditsGame: boolean;
  resolvesPot: boolean;
}

export interface TableSnapshot {
  tableId: string;
  protocolId: string;
  phase: string;
  flags: Record<string, boolean>;
  boxes: { id: string; ownerUserId: string; stake: number; status: string }[];
  pot: { amount: number };
  authorityUserId: string;
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
    requestMagicLink: (email: string) =>
      request<{ token: string; verifyUrl: string }>('/api/auth/request-magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    inspectVerify: (token: string) =>
      request<{ email: string | null; requiresTerms: boolean; isUpgrade: boolean }>(
        `/api/auth/verify?token=${encodeURIComponent(token)}`,
      ),
    completeVerify: (token: string, acceptedTerms: boolean) =>
      request<{ sessionToken: string; user: { id: string } }>('/api/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token, acceptedTerms }),
      }),
    me: () => request<{ user: { id: string; email: string | null }; wallet: { balance: number } | null; tableIds: string[] }>('/api/auth/me'),
    createTable: (protocolId: string) =>
      request<{ id: string }>('/api/tables', { method: 'POST', body: JSON.stringify({ protocolId }) }),
    snapshot: (tableId: string) => request<TableSnapshot>(`/api/tables/${tableId}`),
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
