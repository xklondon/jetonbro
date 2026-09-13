import { randomUUID } from 'node:crypto';
import type { Escrow } from '../escrow/types.js';
import { transfersFromRelease } from './derive.js';
import { fail } from './errors.js';
import { counterparties, netStanding } from './standing.js';
import { createMemoryPersonalLedgerStore, type PersonalLedgerStore } from './store.js';
import type { PersonalLedgerEntry, Standing, StandingRow, StandingSnapshot } from './types.js';

export class PersonalLedger {
  constructor(private readonly store: PersonalLedgerStore = createMemoryPersonalLedgerStore()) {}

  /** Only the RELEASE listener should call this. */
  async recordRelease(escrow: Escrow, timestamp: string): Promise<PersonalLedgerEntry[]> {
    if (escrow.state !== 'RELEASED') {
      fail('NOT_RELEASE', 'Personal-ledger RELEASE rows can only be derived from a RELEASED escrow');
    }
    const added: PersonalLedgerEntry[] = [];
    for (const transfer of transfersFromRelease(escrow)) {
      const entry: PersonalLedgerEntry = {
        id: randomUUID(),
        kind: 'RELEASE',
        from: transfer.from,
        to: transfer.to,
        amount: transfer.amount,
        tableId: escrow.tableId,
        timestamp,
        escrowId: escrow.id,
      };
      await this.store.insertEntry(entry);
      added.push(entry);
    }
    return added;
  }

  async listHistory(userA?: string, userB?: string): Promise<PersonalLedgerEntry[]> {
    return (await this.store.listEntries())
      .filter((entry) => {
        if (!userA) {
          return true;
        }
        if (!userB) {
          return entry.from === userA || entry.to === userA;
        }
        return (
          (entry.from === userA && entry.to === userB) || (entry.from === userB && entry.to === userA)
        );
      })
      .map((entry) => ({ ...entry }));
  }

  async standing(userA: string, userB: string): Promise<Standing> {
    return netStanding(await this.store.listEntries(), userA, userB);
  }

  async standingsFor(userId: string): Promise<StandingRow[]> {
    const entries = await this.store.listEntries();
    return counterparties(entries, userId).map((otherUserId) => ({
      otherUserId,
      standing: netStanding(entries, userId, otherUserId),
    }));
  }

  async save(userId: string, otherUserId?: string): Promise<StandingSnapshot> {
    const standings = otherUserId
      ? [{ otherUserId, standing: await this.standing(userId, otherUserId) }]
      : await this.standingsFor(userId);
    const snapshot: StandingSnapshot = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      userId,
      otherUserId: otherUserId ?? null,
      standings,
    };
    await this.store.insertSnapshot(snapshot);
    return { ...snapshot, standings: standings.map((row) => ({ ...row, standing: { ...row.standing } })) };
  }

  async listSnapshots(userId?: string): Promise<StandingSnapshot[]> {
    return (await this.store.listSnapshots())
      .filter((snapshot) => !userId || snapshot.userId === userId)
      .map((snapshot) => ({
        ...snapshot,
        standings: snapshot.standings.map((row) => ({ ...row, standing: { ...row.standing } })),
      }));
  }

  /**
   * Real-life settlement. Writes a MANUAL_SETTLEMENT row so net is zero from
   * this point; never deletes RELEASE history.
   */
  async clear(userA: string, userB: string, actorId: string): Promise<PersonalLedgerEntry | null> {
    const standing = await this.standing(userA, userB);
    if (standing.status === 'settled') {
      return null;
    }
    const entry: PersonalLedgerEntry = {
      id: randomUUID(),
      kind: 'MANUAL_SETTLEMENT',
      from: standing.owes,
      to: standing.owes === userA ? userB : userA,
      amount: standing.amount,
      tableId: null,
      timestamp: new Date().toISOString(),
      actorId,
    };
    await this.store.insertEntry(entry);
    return { ...entry };
  }
}

export function createPersonalLedger(store?: PersonalLedgerStore): PersonalLedger {
  return new PersonalLedger(store ?? createMemoryPersonalLedgerStore());
}
