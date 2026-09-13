import type { Pool } from 'pg';
import { createAuthService } from '../auth/service.js';
import { createEscrowService } from '../escrow/service.js';
import { createPersonalLedger, listenForReleases } from '../ledger/index.js';
import { createTableService } from '../table/service.js';
import { createPool } from './pool.js';
import { runMigrations } from './migrate.js';
import { createPgStores } from './stores.js';

export function testDatabaseUrl(): string | undefined {
  const url = process.env.TEST_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  return url || undefined;
}

const TABLES = [
  'table_runtimes',
  'personal_ledger_snapshots',
  'personal_ledger_entries',
  'memberships',
  'sessions',
  'magic_links',
  'invites',
  'tables',
  'users',
  'escrow_ledger',
  'escrows',
  'wallets',
];

export async function connectTestDatabase(): Promise<Pool> {
  const url = testDatabaseUrl();
  if (!url) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL is required for Postgres store tests');
  }
  const pool = createPool(url);
  await runMigrations(pool);
  return pool;
}

export async function truncateAll(pool: Pool): Promise<void> {
  await pool.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

export function pgStores(pool: Pool) {
  const stores = createPgStores(pool);
  const ledger = createPersonalLedger(stores.ledger);
  const escrow = createEscrowService(listenForReleases(stores.escrow, ledger));
  const auth = createAuthService(escrow, stores.auth);
  const tables = createTableService(escrow, auth, ledger, stores.runtime);
  return {
    escrowStore: stores.escrow,
    authStore: stores.auth,
    ledgerStore: stores.ledger,
    runtimeStore: stores.runtime,
    ledger,
    escrow,
    auth,
    tables,
  };
}
