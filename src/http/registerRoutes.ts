import type { Express, NextFunction, Request, Response } from 'express';
import { AuthError } from '../auth/errors.js';
import type { AuthService, CreateInviteInput } from '../auth/service.js';
import type { InviteChannel } from '../auth/types.js';
import type { TableService } from '../table/service.js';

export interface RouteDeps {
  auth: AuthService;
  tables: TableService;
}

export function registerRoutes(app: Express, deps: RouteDeps): void {
  const { auth, tables } = deps;

  app.post('/api/auth/request-magic-link', (req, res, next) => {
    const body = req.body as { email?: string; phone?: string; inviteToken?: string; deviceId?: string };
    void auth
      .requestMagicLink({
        email: body.email,
        phone: body.phone,
        inviteToken: body.inviteToken,
        deviceId: body.deviceId,
      })
      .then((result) => {
        if (result.emailed) {
          res.status(201).json({ emailed: true });
          return;
        }
        res.status(201).json({ token: result.token, verifyUrl: result.verifyUrl });
      })
      .catch(next);
  });

  app.get('/api/auth/verify', (req, res, next) => {
    void auth
      .inspectMagicLink(firstQuery(req.query.token))
      .then((result) => {
        res.json(result);
      })
      .catch(next);
  });

  app.post('/api/auth/verify', (req, res, next) => {
    const body = req.body as { token?: string; acceptedTerms?: boolean };
    void auth
      .verify({ token: body.token ?? '', acceptedTerms: Boolean(body.acceptedTerms) })
      .then((result) => {
        res.json(result);
      })
      .catch(next);
  });

  app.get('/api/auth/me', (req, res, next) => {
    void auth
      .me(bearerToken(req))
      .then((result) => {
        res.json(result);
      })
      .catch(next);
  });

  app.post('/api/auth/logout', (req, res, next) => {
    void auth
      .logout(bearerToken(req))
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  });

  app.post('/api/tables', (req, res, next) => {
    const body = (req.body ?? {}) as { protocolId?: 'blackjack' | 'poker' | 'zilch' };
    void auth
      .createTable(bearerToken(req), { protocolId: body.protocolId })
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  });

  app.get('/api/tables/:tableId', (req, res, next) => {
    void tables
      .snapshot(bearerToken(req), req.params.tableId ?? '')
      .then((result) => {
        res.json(result);
      })
      .catch(next);
  });

  app.post('/api/tables/:tableId/invites', (req, res, next) => {
    const body = req.body as CreateInviteInput;
    const tableId = req.params.tableId ?? '';
    void auth
      .createInvite(bearerToken(req), tableId, {
        channel: body.channel as InviteChannel,
        email: body.email,
        phone: body.phone,
        openingChips: body.openingChips,
      })
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  });

  app.post('/api/tables/:tableId/actions', (req, res, next) => {
    const body = req.body as {
      actionId?: string;
      amount?: number;
      boxId?: string;
      targetUserId?: string;
      outcome?: string;
      winners?: string[];
      payoutAmount?: number;
    };
    void tables
      .act(bearerToken(req), req.params.tableId ?? '', {
        actionId: body.actionId ?? '',
        amount: body.amount,
        boxId: body.boxId,
        targetUserId: body.targetUserId,
        outcome: body.outcome,
        winners: body.winners,
        payoutAmount: body.payoutAmount,
      })
      .then((result) => {
        res.json(result);
      })
      .catch(next);
  });

  app.post('/api/tables/:tableId/buy-in', (req, res, next) => {
    const body = req.body as { amount?: number };
    void tables
      .buyIn(bearerToken(req), req.params.tableId ?? '', Number(body.amount))
      .then((result) => {
        res.json(result);
      })
      .catch(next);
  });

  app.post('/api/tables/:tableId/hand-display', (req, res, next) => {
    const body = req.body as { text?: string; photo?: string };
    void tables
      .setHandDisplay(bearerToken(req), req.params.tableId ?? '', body)
      .then((result) => {
        res.json(result);
      })
      .catch(next);
  });

  app.get('/api/invites/preview', (req, res, next) => {
    void auth
      .previewInvite(firstQuery(req.query.token))
      .then((result) => {
        res.json(result);
      })
      .catch(next);
  });

  app.post('/api/invites/mates/join', (req, res, next) => {
    const body = req.body as { token?: string; deviceId?: string };
    void auth
      .joinMates({ token: body.token ?? '', deviceId: body.deviceId ?? '' })
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  });

  app.get('/api/standings', (req, res, next) => {
    void tables
      .standings(bearerToken(req))
      .then((result) => {
        res.json(result);
      })
      .catch(next);
  });

  app.post('/api/standings/save', (req, res, next) => {
    const body = req.body as { otherUserId?: string };
    void tables
      .saveStandings(bearerToken(req), body.otherUserId)
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  });

  app.post('/api/standings/clear', (req, res, next) => {
    const body = req.body as { otherUserId?: string };
    void tables
      .clearStandings(bearerToken(req), body.otherUserId ?? '')
      .then((entry) => {
        res.json({ entry });
      })
      .catch(next);
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
