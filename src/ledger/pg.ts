import type { Pool } from 'pg';
import type { PersonalLedgerEntry, StandingSnapshot } from './types.js';
import { cloneEntry, cloneSnapshot, type PersonalLedgerStore } from './store.js';

interface EntryRow {
  id: string;
  kind: PersonalLedgerEntry['kind'];
  from_user_id: string;
  to_user_id: string;
  amount: number;
  table_id: string | null;
  ts: string;
  escrow_id: string | null;
  actor_id: string | null;
}

interface SnapshotRow {
  id: string;
  ts: string;
  user_id: string;
  other_user_id: string | null;
  standings: StandingSnapshot['standings'];
}

export function createPgPersonalLedgerStore(pool: Pool): PersonalLedgerStore {
  return {
    async insertEntry(entry) {
      await pool.query(
        `INSERT INTO personal_ledger_entries
           (id, kind, from_user_id, to_user_id, amount, table_id, ts, escrow_id, actor_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          entry.id,
          entry.kind,
          entry.from,
          entry.to,
          entry.amount,
          entry.tableId,
          entry.timestamp,
          entry.escrowId ?? null,
          entry.actorId ?? null,
        ],
      );
    },
    async listEntries() {
      const result = await pool.query<EntryRow>('SELECT * FROM personal_ledger_entries ORDER BY n');
      return result.rows.map(toEntry).map(cloneEntry);
    },
    async insertSnapshot(snapshot) {
      await pool.query(
        `INSERT INTO personal_ledger_snapshots (id, ts, user_id, other_user_id, standings)
         VALUES ($1, $2, $3, $4, $5)`,
        [snapshot.id, snapshot.timestamp, snapshot.userId, snapshot.otherUserId, JSON.stringify(snapshot.standings)],
      );
    },
    async listSnapshots() {
      const result = await pool.query<SnapshotRow>('SELECT * FROM personal_ledger_snapshots ORDER BY n');
      return result.rows.map(toSnapshot).map(cloneSnapshot);
    },
  };
}

function toEntry(row: EntryRow): PersonalLedgerEntry {
  const entry: PersonalLedgerEntry = {
    id: row.id,
    kind: row.kind,
    from: row.from_user_id,
    to: row.to_user_id,
    amount: Number(row.amount),
    tableId: row.table_id,
    timestamp: row.ts,
  };
  if (row.escrow_id) {
    entry.escrowId = row.escrow_id;
  }
  if (row.actor_id) {
    entry.actorId = row.actor_id;
  }
  return entry;
}

function toSnapshot(row: SnapshotRow): StandingSnapshot {
  return {
    id: row.id,
    timestamp: row.ts,
    userId: row.user_id,
    otherUserId: row.other_user_id,
    standings: row.standings,
  };
}
