import express from 'express';
import { createAuthService, type AuthService } from '../auth/service.js';
import { createEscrowService, type EscrowService } from '../escrow/service.js';
import { authErrorHandler, registerRoutes } from './registerRoutes.js';

export function createApp(options?: { escrow?: EscrowService; auth?: AuthService }): {
  app: express.Express;
  auth: AuthService;
  escrow: EscrowService;
} {
  const escrow = options?.escrow ?? createEscrowService();
  const auth = options?.auth ?? createAuthService(escrow);
  const app = express();
  app.use(express.json());
  registerRoutes(app, auth);
  app.use(authErrorHandler);
  return { app, auth, escrow };
}
