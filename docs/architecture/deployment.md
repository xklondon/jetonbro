# Deployment

JetonBro is one Next.js application and one PostgreSQL database.

## Single instance

In-process SSE publishes table snapshots through memory of the running Node process.

**Railway (and any host) must run exactly one application instance for this MVP.** Multiple replicas will not share live bet or phase updates. `railway.json` sets `numReplicas` to 1.

Balances are stored in PostgreSQL. Refresh and SSE reconnect load a complete server snapshot. No jeton value exists only in process memory.

## Health

`GET /api/health` reports `{ ok, database }` and does not expose secrets. Railway health checks should use `/api/health`.

## Email

Real invitation and magic-link delivery requires `EMAIL_SERVER` (SMTP URL) and `EMAIL_FROM`.

Without `EMAIL_SERVER`, links are only written to `tmp/mailbox.jsonl`. That is local development, not production delivery.

## Development endpoints

`/api/dev/session` and `/api/dev/mailbox` are closed when `NODE_ENV=production`, even if `ALLOW_DEV_MAILBOX=true`.

Set `ALLOW_DEV_MAILBOX=true` only for local and CI Playwright helpers.
