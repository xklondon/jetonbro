import { useEffect, useState } from 'react';
import type { Api, StandingRow } from '../api.js';

export function StandingsPage({ api }: { api: Api }) {
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [me, setMe] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [standings, profile] = await Promise.all([api.standings(), api.me()]);
    setRows(standings.rows);
    setMe(profile.user.id);
  }

  useEffect(() => {
    load().catch((err: Error) => setMessage(err.message));
  }, []);

  return (
    <main>
      <h1>Standings</h1>
      {rows.length === 0 ? <p className="muted">No shared history yet.</p> : null}
      <ul data-testid="standings-list">
        {rows.map((row) => (
          <li key={row.otherUserId}>
            <span>{labelStanding(row, me)}</span>
            <button
              type="button"
              onClick={() => {
                void api.saveStandings(row.otherUserId).then(() => setMessage('Saved'));
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                void api.clearStandings(row.otherUserId).then(load).then(() => setMessage('Cleared'));
              }}
            >
              Clear
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          void api.saveStandings().then(() => setMessage('Saved all'));
        }}
      >
        Save all
      </button>
      {message ? <p>{message}</p> : null}
    </main>
  );
}

function labelStanding(row: StandingRow, me: string): string {
  if (row.standing.status === 'settled') {
    return `${row.otherLabel}: settled`;
  }
  if (row.standing.owes === me) {
    return `You owe ${row.otherLabel} ${row.standing.amount}`;
  }
  return `${row.otherLabel} owes you ${row.standing.amount}`;
}
