# JetonBro

JetonBro is a live companion for people playing physical games together around a real table. Version 1 supports Blackjack.

The application tracks virtual jetons, boxes, bets, Bank/Dealer phases, and payouts that people enter at the physical table. Cards and any cash stay offline. Jetons have no built-in cash value.

## Classic skin

The approved Player and Bank/Dealer screens live in `design/reference/classic/`. Classic is a replaceable visual skin, not a second copy of the game.

## Local setup

1. Copy `.env.example` to `.env` and set `AUTH_SECRET`.
2. For Playwright and the local mailbox, set `ALLOW_DEV_MAILBOX=true` in `.env` only.
3. Start Postgres: `npm run db:up`
4. Install: `npm install`
5. Migrate: `npx prisma migrate deploy`
6. Run: `npm run dev`

Verification:

```bash
npm run guardrails
npm test
npm run build
npm run test:e2e
```

## Deployment

One Next.js process and one PostgreSQL database. **Run exactly one application instance.** In-process SSE will not replicate across multiple Railway replicas.

`npm start` applies migrations and serves the app locally. Railway staging uses `npx prisma migrate deploy` as the pre-deploy command, then `npx next start`. Health: `GET /api/health`. The Railway service is pinned to **one replica**.

Email invitations and magic links are delivered with the Resend HTTP API when `RESEND_API_KEY` and `EMAIL_FROM` are set. See `docs/architecture/deployment.md` and `docs/architecture/invitations.md`.
