# Invitations

Three different things are involved when someone joins a table:

| Step | What it is |
| --- | --- |
| Email invitation generation | Owner submits emails. The app stores an expiring, single-use, email-bound token and builds `/join/{token}`. |
| Email delivery | Requires `EMAIL_SERVER`. If unset, the link is written to `tmp/mailbox.jsonl` only. Production SMTP was not tested in this MVP unless that variable is configured. |
| QR join-link generation | A table-specific multi-use token until rotated or expired. Scanning opens the same `/join/{token}` flow. QR join does not use `/api/dev/session`. |
| Authentication | Passwordless Auth.js email magic link. After sign-in the user is returned to `/join/{token}` then to the table. |
| Test sessions | `POST /api/dev/session` exists only when `ALLOW_DEV_MAILBOX=true` and `NODE_ENV` is not `production`. Playwright uses it. Production always 404s. |

Invitation tokens expire. QR tokens can be rotated or disabled. Email-bound tokens cannot be redeemed by a different authenticated email.
