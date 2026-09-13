import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Pool } from 'pg';
import { mailerFromEnv } from '../auth/mailer.js';
import { createAuthService, type AuthService } from '../auth/service.js';
import { createMemoryAuthStore, type AuthStore } from '../auth/store.js';
import { createPool } from '../db/pool.js';
import { runMigrations } from '../db/migrate.js';
import { createPgStores } from '../db/stores.js';
import { createEscrowService, type EscrowService } from '../escrow/service.js';
import { createMemoryStore, type EscrowStore } from '../escrow/store.js';
import {
  createPersonalLedger,
  listenForReleases,
  type PersonalLedger,
  type PersonalLedgerStore,
} from '../ledger/index.js';
import { createMemoryPersonalLedgerStore } from '../ledger/store.js';
import { createTableService, type TableService } from '../table/service.js';
import { createMemoryTableRuntimeStore, type TableRuntimeStore } from '../table/store.js';
import { authErrorHandler, registerRoutes } from './registerRoutes.js';

export interface CreateAppOptions {
  escrow?: EscrowService;
  auth?: AuthService;
  ledger?: PersonalLedger;
  tables?: TableService;
  escrowStore?: EscrowStore;
  authStore?: AuthStore;
  ledgerStore?: PersonalLedgerStore;
  runtimeStore?: TableRuntimeStore;
  /** When set, connect, migrate, and use Postgres stores. Tests omit this. */
  databaseUrl?: string | null;
}

export interface AppParts {
  app: express.Express;
  auth: AuthService;
  escrow: EscrowService;
  ledger: PersonalLedger;
  tables: TableService;
  pool?: Pool;
}

export function createApp(options?: Omit<CreateAppOptions, 'databaseUrl'>): AppParts {
  return assemble(options ?? {});
}

export async function createPersistentApp(databaseUrl: string, options?: Omit<CreateAppOptions, 'databaseUrl'>): Promise<AppParts> {
  const pool = createPool(databaseUrl);
  await runMigrations(pool);
  const stores = createPgStores(pool);
  const parts = assemble({
    ...options,
    escrowStore: options?.escrowStore ?? stores.escrow,
    authStore: options?.authStore ?? stores.auth,
    ledgerStore: options?.ledgerStore ?? stores.ledger,
    runtimeStore: options?.runtimeStore ?? stores.runtime,
  });
  return { ...parts, pool };
}

function assemble(options: Omit<CreateAppOptions, 'databaseUrl'>): AppParts {
  const ledger = options.ledger ?? createPersonalLedger(options.ledgerStore ?? createMemoryPersonalLedgerStore());
  const escrowStore = options.escrowStore ?? createMemoryStore();
  const escrow = options.escrow ?? createEscrowService(listenForReleases(escrowStore, ledger));
  const auth =
    options.auth ??
    createAuthService(escrow, options.authStore ?? createMemoryAuthStore(), {
      mailer: mailerFromEnv(),
      appOrigin: process.env.APP_ORIGIN,
    });
  const tables =
    options.tables ??
    createTableService(escrow, auth, ledger, options.runtimeStore ?? createMemoryTableRuntimeStore());
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  registerRoutes(app, { auth, tables });
  const dist = path.resolve('web/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(dist, 'index.html'));
    });
  }
  app.use(authErrorHandler);
  return { app, auth, escrow, ledger, tables };
}
