# Deployment

JetonBro is one Next.js application and one PostgreSQL database.

## Single instance

In-process SSE publishes table snapshots through memory of the running Node process.

**Railway (and any host) must run exactly one application instance for this MVP.** Multiple replicas will not share live bet or phase updates. `railway.json` sets `numReplicas` to 1.

Balances are stored in PostgreSQL. Refresh and SSE reconnect load a complete server snapshot. No jeton value exists only in process memory.

## Health

`GET /api/health` reports `{ ok, database }` and does not expose secrets. Railway health checks should use `/api/health`.

## Email

Real invitation and magic-link delivery uses the Resend HTTP API.

Required variables:

- `RESEND_API_KEY`
- `EMAIL_FROM`

The API key is read only from `process.env.RESEND_API_KEY`. It is never placed in a URL, client bundle, API response, log line, or error message.

The local development mailbox (`tmp/mailbox.jsonl`) is used only when `NODE_ENV` is not `production` and `ALLOW_DEV_MAILBOX=true`. Production never falls back to that mailbox.

## Development endpoints

`/api/dev/session` and `/api/dev/mailbox` are closed when `NODE_ENV=production`, even if `ALLOW_DEV_MAILBOX=true`.

Set `ALLOW_DEV_MAILBOX=true` only for local and CI Playwright helpers.
