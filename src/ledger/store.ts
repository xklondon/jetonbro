import type { PersonalLedgerEntry, StandingSnapshot } from './types.js';

export interface PersonalLedgerStore {
  insertEntry(entry: PersonalLedgerEntry): Promise<void>;
  listEntries(): Promise<PersonalLedgerEntry[]>;
  insertSnapshot(snapshot: StandingSnapshot): Promise<void>;
  listSnapshots(): Promise<StandingSnapshot[]>;
}

export function createMemoryPersonalLedgerStore(): PersonalLedgerStore {
  const entries: PersonalLedgerEntry[] = [];
  const snapshots: StandingSnapshot[] = [];

  return {
    async insertEntry(entry) {
      entries.push(cloneEntry(entry));
    },
    async listEntries() {
      return entries.map(cloneEntry);
    },
    async insertSnapshot(snapshot) {
      snapshots.push(cloneSnapshot(snapshot));
    },
    async listSnapshots() {
      return snapshots.map(cloneSnapshot);
    },
  };
}

export function cloneEntry(entry: PersonalLedgerEntry): PersonalLedgerEntry {
  return { ...entry };
}

export function cloneSnapshot(snapshot: StandingSnapshot): StandingSnapshot {
  return {
    ...snapshot,
    standings: snapshot.standings.map((row) => ({ ...row, standing: { ...row.standing } })),
  };
}
