import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createAuthService, type AuthService } from '../auth/service.js';
import { createEscrowService, type EscrowService } from '../escrow/service.js';
import { createMemoryStore } from '../escrow/store.js';
import { createPersonalLedger, listenForReleases, type PersonalLedger } from '../ledger/index.js';
import { createTableService, type TableService } from '../table/service.js';
import { authErrorHandler, registerRoutes } from './registerRoutes.js';

export function createApp(options?: {
  escrow?: EscrowService;
  auth?: AuthService;
  ledger?: PersonalLedger;
  tables?: TableService;
}): {
  app: express.Express;
  auth: AuthService;
  escrow: EscrowService;
  ledger: PersonalLedger;
  tables: TableService;
} {
  const ledger = options?.ledger ?? createPersonalLedger();
  const escrow = options?.escrow ?? createEscrowService(listenForReleases(createMemoryStore(), ledger));
  const auth = options?.auth ?? createAuthService(escrow);
  const tables = options?.tables ?? createTableService(escrow, auth, ledger);
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
