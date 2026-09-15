# Changelog

## Unreleased

### Setup invites, next-round restart, and Player celebrations

- The setup mask shows compact game tiles, table name and starting jetons, then the full shared QR (`SCAN TO JOIN TABLE`, `COPY LINK`, `SHARE`), then a compact `OR INVITE BY EMAIL` row. `SET UP TABLE` stays sticky. The QR is no longer clipped under the form.
- `NEXT ROUND NOW` is enabled once every box and required Insurance stake is settled, including a PAYOUT snapshot that already shows those settlements. A blocked restart returns `NEXT_ROUND_BLOCKED` instead of a generic phase conflict. Round logs include table, round, actor, phase, unresolved counts, deadline, and a stable code.
- Major win/loss/push/Blackjack celebrations play on the affected Player device after a confirmed snapshot. The Dealer keeps compact row confirmation only.

### Dealer payouts, next round, and table close

- Bank/Dealer PAYOUT is a compact vertical player list. Each unresolved box is settled independently: swipe right WIN, swipe left LOSS, double-tap PUSH, with accessible Win/Push/Lose/Blackjack. Labels come from `suggestedPayout`; balances update only after the snapshot confirms settlement.
- After every required box and Insurance stake is settled, `NEXT ROUND NOW` and `NEXT ROUND IN 7 SECONDS` replace Start next hand. The countdown uses `Round.nextRoundDeadlineAt`. Immediate start during the countdown still creates only one next BETTING round.
- Short Classic outcome celebrations run only after confirmed settlement, respect `prefers-reduced-motion`, and never change accounting.
- Owner SAVE TABLE pauses the table (`pausedAt`) without moving balances. CLOSE TABLE & SAVE BALANCES moves each Player’s AVAILABLE into `PLAYER_POCKET` with `TABLE_TRANSFER_OUT`, then later tables credit `TABLE_TRANSFER_IN` on join. Closed tables reject gameplay commands. The Bank virtual reserve is not stored or transported.

### Table setup and betting

- `CREATE A TABLE` immediately creates or reuses one `TABLE_SETUP` draft and opens `/tables/{tableId}` with a single setup mask over the real Dealer table. The mask already shows the shared table QR.
- `SET UP TABLE` finalizes name, starting jetons, and invitations, then closes the mask. There is no separate waiting-room page.
- During `TABLE_SETUP` the Dealer table shows `CURRENT PHASE: TABLE SETUP`, player boxes for Invited/Joined/Ready, a compact QR overlay, `+ PLAYER`, and `OPEN BETTING`. `OPEN BETTING` is enabled after the first Player joins and is the `TABLE_SETUP → BETTING` command.
- During BETTING the Bank can `DEAL CARDS NOW` or `DEAL IN 7 SECONDS`. The seven-second option stores `Round.bettingCloseDeadlineAt`; refresh resumes from that deadline and the close happens once.
- Repeated create clicks reuse the same empty draft. Refresh returns to that draft and QR. Finalizing is idempotent. An unused draft can be abandoned only before another Player joins.
- Joining credits starting jetons to that membership exactly once (`starting-jetons:{tableId}:{userId}`).
- Tapping a jeton now fails with a domain error such as `You do not have enough jetons` instead of a generic 500. The previous production bet failure was `creditTableAvailable` throwing a plain `Error` when AVAILABLE was 0 because join never credited starting jetons.
- Join/redeem retries are idempotent. Live Dealer seats use SSE plus a short snapshot poll so `Invited` becomes `Joined`/`Ready` without a manual refresh.

### Authenticated home

- Empty authenticated home is a welcome screen with game cards, `CREATE A TABLE`, and `JOIN A TABLE`.
- First landing of a browser session plays a short decorative jeton rain that never blocks actions, runs once per session, and is skipped when `prefers-reduced-motion` is set.
- Existing tables appear as cards with game, phase, player count, role, and `RETURN TO TABLE`.
- Create-table is one Classic setup mask on the Dealer table: Blackjack is selectable; Poker and Zilch show `Coming later`. Blackjack settings use domain defaults and persist `maxBoxesPerPlayer` and `insuranceEnabled`.
- Creator becomes Bank/Dealer on the real table route immediately. Betting does not start automatically.
- Auth.js redirects and magic-link URLs are rewritten onto `AUTH_URL`. Localhost and `*.railway.internal` origins are never kept in production callbacks. Invitation `/join/{token}` destinations are preserved.

### Email

- Replaced SMTP/Nodemailer with the Resend HTTP API for magic-link and invitation delivery.
- Production requires `RESEND_API_KEY` and `EMAIL_FROM`. The development mailbox never runs in production.

### Staging baseline

- Shortened the Player bet placeholder to `Amount` and stacked it on narrow screens so it is not clipped at 320px.
- Player Payout title is `Waiting for the Bank` until every box is resolved, then `Hand complete`.
- Railway manifest pins one replica, `/api/health`, and Prisma migrate as the pre-deploy command.

### Acceptance audit

- Documented unlimited Bank virtual reserve and both sides of every value move.
- Split payout profit from total return in millijeton tests and accounting docs.
- Closed `/api/dev/*` in production even if `ALLOW_DEV_MAILBOX` is accidentally true.
- Added `/api/health` and single-instance SSE deployment rules.
- SSE reconnect no longer throws after a client disconnects.

### Blackjack MVP

- Added explicit Blackjack phase machine, millijeton ledger, table membership, and Classic skin.
- Player and Bank screens follow the approved Classic reference, including the permanent Player jeton dock and independent Insurance side pot.
- Passwordless email authentication, email/QR invitations, and SSE snapshots are included.

### Bootstrap

- Added repository operating contract at `.cursorfile`.
- Added Cursor bootstrap guardrails at `docs/architecture/CURSOR_GUARDRAILS.md`.
- Added Classic visual source of truth at `design/reference/classic/`.
- Added `npm run guardrails` via `scripts/check-guardrails.mjs`.
