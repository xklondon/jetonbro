import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Escrow } from '../escrow/types.js';
import { createPersonalLedger } from './service.js';
import { createMemoryPersonalLedgerStore } from './store.js';

const A = 'alice';
const B = 'bob';

const released: Escrow = {
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

describe('PersonalLedgerStore', () => {
  it('clones on insert so later mutation of the argument does not change the store', async () => {
    const store = createMemoryPersonalLedgerStore();
    const entry = {
      id: 'e1',
      kind: 'RELEASE' as const,
      from: A,
      to: B,
      amount: 10,
      tableId: 't',
      timestamp: '2026-09-13T00:00:00.000Z',
      escrowId: 'escrow-1',
    };
    await store.insertEntry(entry);
    entry.amount = 99;
    expect((await store.listEntries())[0]?.amount).toBe(10);
  });

  it('shares entries across PersonalLedger instances on the same store', async () => {
    const store = createMemoryPersonalLedgerStore();
    const writer = createPersonalLedger(store);
    const reader = createPersonalLedger(store);
    await writer.recordRelease(released, '2026-09-13T00:00:00.000Z');
    expect(await reader.standing(A, B)).toEqual({ status: 'owes', owes: A, amount: 10 });
    await writer.clear(A, B, A);
    expect(await reader.standing(A, B)).toEqual({ status: 'settled' });
    const snap = await writer.save(A, B);
    expect((await reader.listSnapshots(A))[0]?.id).toBe(snap.id);
  });

  it('only PersonalLedger.recordRelease/clear/save write the store', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const production = readdirSync(dir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    const writers: string[] = [];
    for (const name of production) {
      const src = readFileSync(join(dir, name), 'utf8');
      if (src.includes('insertEntry') || src.includes('insertSnapshot')) {
        writers.push(name);
      }
    }
    expect(writers.sort()).toEqual(['service.ts', 'store.ts']);
  });
});
