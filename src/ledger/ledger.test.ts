import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createEscrowService, createMemoryStore, type Escrow } from '../escrow/index.js';
import type { ProtocolConfig } from '../escrow/types.js';
import { listenForReleases } from './listen.js';
import { createPersonalLedger } from './service.js';

const A = 'alice';
const B = 'bob';
const TABLE_1 = 'table-1';
const TABLE_2 = 'table-2';

const payout: ProtocolConfig = {
  payoutRule: 'multiplier',
  multipliers: { win: 2, lose: 0, push: 1 },
};

const allow = () => true;

function wired() {
  const ledger = createPersonalLedger();
  const escrow = createEscrowService(listenForReleases(createMemoryStore(), ledger));
  escrow.ensureMasterWallet(A, 500);
  escrow.ensureMasterWallet(B, 500);
  return { ledger, escrow };
}

function buyInBoth(
  escrow: ReturnType<typeof createEscrowService>,
  tableId: string,
  amount = 100,
) {
  escrow.buyIn({ userId: A, tableId, amount, actorId: A });
  escrow.buyIn({ userId: B, tableId, amount, actorId: B });
}

function releaseBet(
  escrow: ReturnType<typeof createEscrowService>,
  tableId: string,
  bettor: string,
  amount: number,
  outcome: 'win' | 'lose' | 'push',
  counterparty: string,
) {
  const locked = escrow.lock({
    escrowId: escrow.confirm({ userId: bettor, tableId, amount, actorId: bettor }).id,
    actorId: bettor,
  });
  const resolved = escrow.resolve({
    escrowId: locked.id,
    actorId: counterparty,
    protocolConfig: payout,
    canResolve: allow,
    outcome,
    counterpartyUserId: counterparty,
  });
  return escrow.release({
    escrowId: resolved.id,
    actorId: counterparty,
    protocolConfig: payout,
    canResolve: allow,
  });
}

describe('personal ledger', () => {
  it('nets RELEASE transfers across multiple tables between the same two users', () => {
    const { ledger, escrow } = wired();
    buyInBoth(escrow, TABLE_1);
    buyInBoth(escrow, TABLE_2);
    releaseBet(escrow, TABLE_1, A, 10, 'lose', B);
    releaseBet(escrow, TABLE_2, A, 15, 'lose', B);
    expect(ledger.standing(A, B)).toEqual({ status: 'owes', owes: A, amount: 25 });
    expect(ledger.listHistory(A, B).filter((row) => row.kind === 'RELEASE')).toHaveLength(2);
    expect(ledger.listHistory(A, B).map((row) => row.tableId).sort()).toEqual([TABLE_1, TABLE_2]);
  });

  it('Clear zeros the net going forward without dropping RELEASE history', () => {
    const { ledger, escrow } = wired();
    buyInBoth(escrow, TABLE_1);
    releaseBet(escrow, TABLE_1, A, 20, 'lose', B);
    const before = ledger.listHistory(A, B);
    expect(before).toHaveLength(1);
    expect(before[0]?.kind).toBe('RELEASE');
    expect(ledger.standing(A, B)).toEqual({ status: 'owes', owes: A, amount: 20 });

    const cleared = ledger.clear(A, B, A);
    expect(cleared?.kind).toBe('MANUAL_SETTLEMENT');
    expect(ledger.standing(A, B)).toEqual({ status: 'settled' });

    const history = ledger.listHistory(A, B);
    expect(history.filter((row) => row.kind === 'RELEASE')).toEqual(before);
    expect(history.some((row) => row.kind === 'MANUAL_SETTLEMENT')).toBe(true);

    releaseBet(escrow, TABLE_1, A, 5, 'lose', B);
    expect(ledger.standing(A, B)).toEqual({ status: 'owes', owes: A, amount: 5 });
  });

  it('Save snapshots standing without changing a later net calculation', () => {
    const { ledger, escrow } = wired();
    buyInBoth(escrow, TABLE_1);
    releaseBet(escrow, TABLE_1, B, 12, 'lose', A);
    expect(ledger.standing(A, B)).toEqual({ status: 'owes', owes: B, amount: 12 });

    const snapshot = ledger.save(A, B);
    expect(snapshot.standings[0]?.standing).toEqual({ status: 'owes', owes: B, amount: 12 });
    expect(ledger.standing(A, B)).toEqual({ status: 'owes', owes: B, amount: 12 });

    releaseBet(escrow, TABLE_1, B, 8, 'lose', A);
    expect(ledger.standing(A, B)).toEqual({ status: 'owes', owes: B, amount: 20 });
    expect(ledger.listSnapshots(A)[0]?.standings[0]?.standing).toEqual({
      status: 'owes',
      owes: B,
      amount: 12,
    });
  });

  it('never calls EscrowService write methods from the ledger module', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const writePath = [
      'createEscrowService',
      'ensureMasterWallet',
      '.buyIn(',
      '.setResolvedPayout(',
      'escrow/service',
    ];
    const production = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    for (const name of production) {
      const src = readFileSync(join(dir, name), 'utf8');
      for (const token of writePath) {
        expect(src, `${name} must not reference ${token}`).not.toContain(token);
      }
    }

    const ledger = createPersonalLedger();
    const synthetic: Escrow = {
      id: 'escrow-1',
      tableId: 't',
      userId: A,
      amount: 10,
      state: 'RELEASED',
      payout: {
        rule: 'multiplier',
        outcome: 'lose',
        credits: [{ userId: B, amount: 10 }],
        counterpartyUserId: B,
      },
    };
    ledger.recordRelease(synthetic, '2026-09-13T00:00:00.000Z');
    ledger.save(A);
    ledger.clear(A, B, A);
    expect(ledger.standing(A, B)).toEqual({ status: 'settled' });
  });
});
