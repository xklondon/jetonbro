# JetonBro architecture

JetonBro is a single Next.js App Router application with one PostgreSQL database.

It records virtual jetons used alongside a physical Blackjack table. Cards, cash, deposits, withdrawals, dealing, and hand evaluation stay offline.

## Modules

- `src/domain/blackjack` — explicit phase machine, payout math, Blackjack actions
- `src/domain/poker` — Texas Hold’em blinds, legal actions, streets, and side pots
- `src/domain/ledger` — transaction types and bucket moves
- `src/domain/tables` — table status
- `src/domain/invitations` — invitation usability
- `src/application/services` — transactional commands
- `src/application/queries` — role-filtered snapshots
- `src/application/realtime` — in-process SSE publisher
- `src/ui/core` — semantic composition
- `src/ui/skins/classic` — Classic visual template
- `src/ui/skins/registry.ts` — active skin selection

## Runtime

- Auth.js passwordless email with HTTP-only database sessions
- Prisma transactions for every balance mutation
- Idempotency keys on value-changing commands
- SSE snapshots for live multi-phone updates on **one application instance**
- Railway-suitable single process + one Postgres instance
- Health: `GET /api/health` (database ping, no secrets)
