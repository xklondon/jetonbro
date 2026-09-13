import type { Express, NextFunction, Request, Response } from 'express';
import { AuthError } from '../auth/errors.js';
import type { AuthService, CreateInviteInput } from '../auth/service.js';
import type { InviteChannel } from '../auth/types.js';

export function registerRoutes(app: Express, auth: AuthService): void {
  app.post('/api/auth/request-magic-link', (req, res, next) => {
    try {
      const body = req.body as { email?: string; phone?: string; inviteToken?: string; deviceId?: string };
      const result = auth.requestMagicLink({
        email: body.email,
        phone: body.phone,
        inviteToken: body.inviteToken,
        deviceId: body.deviceId,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/verify', (req, res, next) => {
    try {
      const token = firstQuery(req.query.token);
      const acceptedTerms = parseAcceptedTerms(firstQuery(req.query.acceptedTerms));
      const result = auth.verify({ token, acceptedTerms });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/me', (req, res, next) => {
    try {
      res.json(auth.me(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', (req, res, next) => {
    try {
      auth.logout(bearerToken(req));
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/tables', (req, res, next) => {
    try {
      res.status(201).json(auth.createTable(bearerToken(req)));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/tables/:tableId/invites', (req, res, next) => {
    try {
      const body = req.body as CreateInviteInput;
      const tableId = req.params.tableId ?? '';
      const result = auth.createInvite(bearerToken(req), tableId, {
        channel: body.channel as InviteChannel,
        email: body.email,
        phone: body.phone,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/invites/preview', (req, res, next) => {
    try {
      res.json(auth.previewInvite(firstQuery(req.query.token)));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/invites/mates/join', (req, res, next) => {
    try {
      const body = req.body as { token?: string; deviceId?: string };
      res.status(201).json(auth.joinMates({ token: body.token ?? '', deviceId: body.deviceId ?? '' }));
    } catch (error) {
      next(error);
    }
  });
}

export function authErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof AuthError) {
    res.status(error.status).json({ error: error.code, message: error.message });
    return;
  }
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const code = String((error as { code: unknown }).code);
    const message = String((error as { message: unknown }).message);
    const status = code === 'DUPLICATE_WALLET' ? 409 : 400;
    res.status(status).json({ error: code, message });
    return;
  }
  next(error);
}

function bearerToken(req: Request): string {
  const header = req.header('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? '';
}

function firstQuery(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : '';
  }
  return typeof value === 'string' ? value : '';
}

function parseAcceptedTerms(value: string): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}
