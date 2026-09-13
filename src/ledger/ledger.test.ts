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
  return { ledger, escrow };
}

async function fund(escrow: ReturnType<typeof createEscrowService>) {
  await escrow.ensureMasterWallet(A, 500);
  await escrow.ensureMasterWallet(B, 500);
}

async function buyInBoth(
  escrow: ReturnType<typeof createEscrowService>,
  tableId: string,
  amount = 100,
) {
  await escrow.buyIn({ userId: A, tableId, amount, actorId: A });
  await escrow.buyIn({ userId: B, tableId, amount, actorId: B });
}

async function releaseBet(
  escrow: ReturnType<typeof createEscrowService>,
  tableId: string,
  bettor: string,
  amount: number,
  outcome: 'win' | 'lose' | 'push',
  counterparty: string,
) {
  const confirmed = await escrow.confirm({ userId: bettor, tableId, amount, actorId: bettor });
  const locked = await escrow.lock({
    escrowId: confirmed.id,
    actorId: bettor,
  });
  const resolved = await escrow.resolve({
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
  it('nets RELEASE transfers across multiple tables between the same two users', async () => {
    const { ledger, escrow } = wired();
    await fund(escrow);
    await buyInBoth(escrow, TABLE_1);
    await buyInBoth(escrow, TABLE_2);
    await releaseBet(escrow, TABLE_1, A, 10, 'lose', B);
    await releaseBet(escrow, TABLE_2, A, 15, 'lose', B);
    expect(await ledger.standing(A, B)).toEqual({ status: 'owes', owes: A, amount: 25 });
    expect((await ledger.listHistory(A, B)).filter((row) => row.kind === 'RELEASE')).toHaveLength(2);
    expect((await ledger.listHistory(A, B)).map((row) => row.tableId).sort()).toEqual([TABLE_1, TABLE_2]);
  });

  it('Clear zeros the net going forward without dropping RELEASE history', async () => {
    const { ledger, escrow } = wired();
    await fund(escrow);
    await buyInBoth(escrow, TABLE_1);
    await releaseBet(escrow, TABLE_1, A, 20, 'lose', B);
    const before = await ledger.listHistory(A, B);
    expect(before).toHaveLength(1);
    expect(before[0]?.kind).toBe('RELEASE');
    expect(await ledger.standing(A, B)).toEqual({ status: 'owes', owes: A, amount: 20 });

    const cleared = await ledger.clear(A, B, A);
    expect(cleared?.kind).toBe('MANUAL_SETTLEMENT');
    expect(await ledger.standing(A, B)).toEqual({ status: 'settled' });

    const history = await ledger.listHistory(A, B);
    expect(history.filter((row) => row.kind === 'RELEASE')).toEqual(before);
    expect(history.some((row) => row.kind === 'MANUAL_SETTLEMENT')).toBe(true);

    await releaseBet(escrow, TABLE_1, A, 5, 'lose', B);
    expect(await ledger.standing(A, B)).toEqual({ status: 'owes', owes: A, amount: 5 });
  });

  it('Save snapshots standing without changing a later net calculation', async () => {
    const { ledger, escrow } = wired();
    await fund(escrow);
    await buyInBoth(escrow, TABLE_1);
    await releaseBet(escrow, TABLE_1, B, 12, 'lose', A);
    expect(await ledger.standing(A, B)).toEqual({ status: 'owes', owes: B, amount: 12 });

    const snapshot = await ledger.save(A, B);
    expect(snapshot.standings[0]?.standing).toEqual({ status: 'owes', owes: B, amount: 12 });
    expect(await ledger.standing(A, B)).toEqual({ status: 'owes', owes: B, amount: 12 });

    await releaseBet(escrow, TABLE_1, B, 8, 'lose', A);
    expect(await ledger.standing(A, B)).toEqual({ status: 'owes', owes: B, amount: 20 });
    expect((await ledger.listSnapshots(A))[0]?.standings[0]?.standing).toEqual({
      status: 'owes',
      owes: B,
      amount: 12,
    });
  });

  it('never calls EscrowService write methods from the ledger module', async () => {
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
    await ledger.recordRelease(synthetic, '2026-09-13T00:00:00.000Z');
    await ledger.save(A);
    await ledger.clear(A, B, A);
    expect(await ledger.standing(A, B)).toEqual({ status: 'settled' });
  });
});
