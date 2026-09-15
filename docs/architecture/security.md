# Security assumptions

- Session cookies are HTTP-only database sessions from Auth.js.
- Magic links and email invitations expire. Email invitations are single-use and email-bound.
- QR invitations are table-specific tokens, not sequential table IDs. The owner can rotate or disable them.
- Sign-in and invite responses do not disclose whether an unrelated email already has an account.
- Email and invite creation are rate-limited.
- Players receive snapshots that omit other players' balances and boxes.
- The server is authoritative. Displayed balances come from the snapshot or command result.
- `ALLOW_DEV_MAILBOX` is ignored in production. `/api/dev/*` always 404s when `NODE_ENV=production`.
- Real email delivery requires `RESEND_API_KEY` and `EMAIL_FROM`. The API key is never placed in a URL or logged.
- The development mailbox is local/CI only (`NODE_ENV !== "production"` and `ALLOW_DEV_MAILBOX=true`). Production never falls back to it.
- Jetons have no built-in cash value. The product does not take deposits, hold funds, or process payments.
- The Bank issues virtual jetons from an unlimited virtual reserve. That reserve is not cash and is not stored as a finite balance.
