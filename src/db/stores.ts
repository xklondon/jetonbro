import type { Pool } from 'pg';
import { createPgAuthStore } from '../auth/pg.js';
import { createPgEscrowStore } from '../escrow/pg.js';
import { createPgPersonalLedgerStore } from '../ledger/pg.js';
import { createPgTableRuntimeStore } from '../table/pg.js';
import type { AuthStore } from '../auth/store.js';
import type { EscrowStore } from '../escrow/store.js';
import type { PersonalLedgerStore } from '../ledger/store.js';
import type { TableRuntimeStore } from '../table/store.js';

export interface PgStores {
  escrow: EscrowStore;
  auth: AuthStore;
  ledger: PersonalLedgerStore;
  runtime: TableRuntimeStore;
}

export function createPgStores(pool: Pool): PgStores {
  return {
    escrow: createPgEscrowStore(pool),
    auth: createPgAuthStore(pool),
    ledger: createPgPersonalLedgerStore(pool),
    runtime: createPgTableRuntimeStore(pool),
  };
}
