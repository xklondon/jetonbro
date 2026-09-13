import { useState } from 'react';
import type { Api, TableInvite, TableSnapshot } from '../api.js';

function joinUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

interface RosterRow {
  key: string;
  userId: string | null;
  label: string;
  status: 'pending' | 'joined';
  openingChips: number;
  joinPath: string | null;
  channel: string;
  shareUrl: string | null;
}

function rosterRows(snapshot: TableSnapshot): RosterRow[] {
  const claimed = new Set<string>();
  const rows: RosterRow[] = snapshot.invites.map((invite: TableInvite) => {
    if (invite.claimedByUserId) {
      claimed.add(invite.claimedByUserId);
    }
    return {
      key: invite.id,
      userId: invite.claimedByUserId,
      label: invite.label,
      status: invite.status,
      openingChips: invite.openingChips,
      joinPath: invite.joinPath,
      channel: invite.channel,
      shareUrl: invite.shareUrl,
    };
  });
  for (const player of snapshot.players) {
    if (claimed.has(player.id)) {
      continue;
    }
    rows.unshift({
      key: player.id,
      userId: player.id,
      label: player.label,
      status: 'joined',
      openingChips: player.stack,
      joinPath: null,
      channel: 'seated',
      shareUrl: null,
    });
  }
  return rows;
}

export function SetupPanel({
  api,
  snapshot,
  onSnapshot,
  onError,
}: {
  api: Api;
  snapshot: TableSnapshot;
  onSnapshot: (next: TableSnapshot) => void;
  onError: (message: string) => void;
}) {
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'qr'>('email');
  const [email, setEmail] = useState('');
  const [chips, setChips] = useState('50');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const canStart = snapshot.viewer.allowedActions.some((action) => action.id === 'open-betting');
  const canAssignAuthority = snapshot.viewer.allowedActions.some((action) => action.id === 'assign-bank');

  async function addPlayer() {
    setError('');
    try {
      await api.createInvite(snapshot.tableId, {
        channel,
        email: channel === 'qr' ? undefined : email || undefined,
        openingChips: Number(chips),
      });
      onSnapshot(await api.snapshot(snapshot.tableId));
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add player');
    }
  }

  async function setBank(userId: string | null) {
    onError('');
    try {
      onSnapshot(
        await api.act(snapshot.tableId, {
          actionId: 'assign-bank',
          ...(userId ? { targetUserId: userId } : {}),
        }),
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not assign Bank');
    }
  }

  async function startBetting() {
    onError('');
    try {
      onSnapshot(await api.act(snapshot.tableId, { actionId: 'open-betting' }));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not start betting');
    }
  }

  return (
    <section className="invite-panel" data-testid="setup-panel">
      <h2>Setup</h2>
      <p className="muted">
        Add one player at a time. Email sends a sign-in link when Resend is configured.
        WhatsApp and QR use a shareable join link.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void addPlayer();
        }}
      >
        <label>
          Channel
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value as 'email' | 'whatsapp' | 'qr')}
          >
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="qr">QR</option>
          </select>
        </label>
        {channel !== 'qr' ? (
          <label>
            {channel === 'whatsapp' ? 'Email (optional)' : 'Email'}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required={channel === 'email'}
            />
          </label>
        ) : (
          <p className="muted">QR: share the join link. They type email or phone on the landing page.</p>
        )}
        <label>
          Starting chips
          <input value={chips} onChange={(event) => setChips(event.target.value)} inputMode="numeric" />
        </label>
        <button type="submit">Add player</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <h3>Players</h3>
      <ul data-testid="invite-roster">
        {rosterRows(snapshot).map((row) => {
          const url = row.joinPath ? joinUrl(row.joinPath) : null;
          const wa = url
            ? `https://wa.me/?text=${encodeURIComponent(`Join the table: ${url}`)}`
            : null;
          const isBank = Boolean(row.userId && row.userId === snapshot.authorityUserId);
          return (
            <li key={row.key} data-status={row.status}>
              <span>
                {row.label} · {row.openingChips} chips · {row.status}
              </span>
              {row.status === 'pending' && url ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(url);
                    setCopied(row.key);
                  }}
                >
                  {copied === row.key ? 'Copied' : 'Copy join link'}
                </button>
              ) : null}
              {row.channel === 'whatsapp' && wa ? (
                <a href={wa} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              ) : null}
              {canAssignAuthority && row.status === 'joined' && row.userId ? (
                <fieldset className="role-radios">
                  <legend className="sr-only">Role for {row.label}</legend>
                  <label>
                    <input
                      type="radio"
                      name={`role-${row.key}`}
                      checked={isBank}
                      onChange={() => void setBank(row.userId)}
                    />
                    Bank
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`role-${row.key}`}
                      checked={!isBank}
                      onChange={() => {
                        if (isBank) {
                          void setBank(null);
                        }
                      }}
                    />
                    Player
                  </label>
                </fieldset>
              ) : null}
            </li>
          );
        })}
      </ul>
      {canStart ? (
        <button type="button" data-action="open-betting" onClick={() => void startBetting()}>
          Start betting
        </button>
      ) : canAssignAuthority ? (
        <p className="muted">
          Start betting appears for Bank once at least one other player has joined.
        </p>
      ) : null}
    </section>
  );
}

export function StartBettingButton({
  onStart,
}: {
  onStart: () => void;
}) {
  return (
    <section className="invite-panel" data-testid="start-betting">
      <button type="button" data-action="open-betting" onClick={onStart}>
        Start betting
      </button>
    </section>
  );
}
