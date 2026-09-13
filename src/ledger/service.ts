import { randomUUID } from 'node:crypto';
import type { Escrow } from '../escrow/types.js';
import { transfersFromRelease } from './derive.js';
import { fail } from './errors.js';
import { counterparties, netStanding } from './standing.js';
import type { PersonalLedgerEntry, Standing, StandingRow, StandingSnapshot } from './types.js';

export class PersonalLedger {
  private readonly entries: PersonalLedgerEntry[] = [];
  private readonly snapshots: StandingSnapshot[] = [];

  /** Only the RELEASE listener should call this. */
  recordRelease(escrow: Escrow, timestamp: string): PersonalLedgerEntry[] {
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
      this.entries.push(entry);
      added.push(entry);
    }
    return added;
  }

  listHistory(userA?: string, userB?: string): PersonalLedgerEntry[] {
    return this.entries
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

  standing(userA: string, userB: string): Standing {
    return netStanding(this.entries, userA, userB);
  }

  standingsFor(userId: string): StandingRow[] {
    return counterparties(this.entries, userId).map((otherUserId) => ({
      otherUserId,
      standing: netStanding(this.entries, userId, otherUserId),
    }));
  }

  save(userId: string, otherUserId?: string): StandingSnapshot {
    const standings = otherUserId
      ? [{ otherUserId, standing: this.standing(userId, otherUserId) }]
      : this.standingsFor(userId);
    const snapshot: StandingSnapshot = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      userId,
      otherUserId: otherUserId ?? null,
      standings,
    };
    this.snapshots.push(snapshot);
    return { ...snapshot, standings: standings.map((row) => ({ ...row, standing: { ...row.standing } })) };
  }

  listSnapshots(userId?: string): StandingSnapshot[] {
    return this.snapshots
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
  clear(userA: string, userB: string, actorId: string): PersonalLedgerEntry | null {
    const standing = this.standing(userA, userB);
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
    this.entries.push(entry);
    return { ...entry };
  }
}

export function createPersonalLedger(): PersonalLedger {
  return new PersonalLedger();
}
