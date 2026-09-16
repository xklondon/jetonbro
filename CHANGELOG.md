# Changelog

## Unreleased

### Optional Blackjack cards and Limited Bank

- Physical cards stay authoritative. Rank-only assistance is optional during PLAYING, never required to deal or settle, and never includes suits, decks, dealing, shuffling, or randomness.
- Card Assist `OFF` (default) shows totals and suggestions only. `CONFIRM` requires Dealer Apply in PAYOUT. `AUTO` settles complete valid boxes only when entering PAYOUT. Incomplete boxes stay manual. Split two-card 21 is ordinary 21.
- Open Bank keeps the unlimited virtual reserve. Limited Bank stores `BANK_AVAILABLE` and `BANK_LOCKED_EXPOSURE` with ledger-backed funding, exposure reservation, and settlement. Player settlement credits the Player exactly once; `BANK_PAYOUT` / `BANK_STAKE_TAKE` are Bank-side legs in the same transaction. `BANK_EXPOSURE_RESERVED` records `BANK_LOCKED_EXPOSURE` before/after. Accounting acceptance is complete.

### Table management and Blackjack payout rail

- Authenticated home uses compact open-table rows: name, game, phase, Dealer, Player names, owner-visible balances, player/box counts, and `RETURN TO TABLE`. Non-owners see names and only their own balance. The owner overflow shows `DELETE TABLE` on an unused draft, or `SAVE TABLE` and `CLOSE TABLE & SAVE BALANCES` on a started table.
- Empty unused `TABLE_SETUP` drafts may be permanently deleted. Started tables are archived through the existing close-table transaction, never hard-deleted. Locked Bet or Insurance blocks close/remove with `LOCKED_FUNDS`. Confirmation states whether the action is draft deletion or historical archival.
- The setup mask bottom action is `CREATE TABLE`. It still finalizes the existing draft and reveals the real `TABLE_SETUP` table.
- Dealer PAYOUT uses one horizontal result rail per box: `LOST`, `STAND OFF`, `BLACKJACK`, `WON`. Swipe left/right and double-tap still settle only that box. Blackjack always celebrates on the affected Player once; the Dealer keeps compact confirmation.

### Phase sequence repair

- `DEAL CARDS NOW` is idempotent once PLAYING, always clears `bettingCloseDeadlineAt`, and uses locked bets only. A leftover `originalStakeMillis` cannot enable Deal.
- `Table.currentPhase` is repaired to match the current `Round.phase`. Orphaned BETTING with no current round can resume through `OPEN BETTING`.
- Wrong-phase Deal, Open Betting, or Player bet returns `PHASE_CONFLICT` instead of a generic/no-op conflict. The client refreshes its snapshot after every command error.
- Snapshots carry a server `revision` (`Table.updatedAt`) and `roundNumber`. Clients and SSE compare that database revision, never local clock time. An older in-flight poll/SSE payload cannot replace a newer one.
- Bank copy states the four transitions: OPEN BETTING starts Betting; DEAL CARDS NOW closes Betting and starts Playing; PAYOUT PHASE moves Playing to Payout; NEXT ROUND NOW starts the next Betting round.
- Every attempted phase command logs sanitized table/round/actor/phase/deadline evidence and a stable result code.

### Setup invites, next-round restart, and Player celebrations

- The setup mask shows compact game tiles, table name and starting jetons, then the full shared QR (`SCAN TO JOIN TABLE`, `COPY LINK`, `SHARE`), then a compact `OR INVITE BY EMAIL` row. `CREATE TABLE` stays sticky. The QR is no longer clipped under the form.
- `NEXT ROUND NOW` is enabled once every box and required Insurance stake is settled, including a PAYOUT snapshot that already shows those settlements. A blocked restart returns `NEXT_ROUND_BLOCKED` instead of a generic phase conflict. Round logs include table, round, actor, phase, unresolved counts, deadline, and a stable code.
- Major win/loss/push/Blackjack celebrations play on the affected Player device after a confirmed snapshot. The Dealer keeps compact row confirmation only.

### Dealer payouts, next round, and table close

- Bank/Dealer PAYOUT is a compact vertical player list. Each unresolved box is settled independently: swipe right WIN, swipe left LOSS, double-tap PUSH, with accessible Win/Push/Lose/Blackjack. Labels come from `suggestedPayout`; balances update only after the snapshot confirms settlement.
- After every required box and Insurance stake is settled, `NEXT ROUND NOW` and `NEXT ROUND IN 7 SECONDS` replace Start next hand. The countdown uses `Round.nextRoundDeadlineAt`. Immediate start during the countdown still creates only one next BETTING round.
- Short Classic outcome celebrations run only after confirmed settlement, respect `prefers-reduced-motion`, and never change accounting.
- Owner SAVE TABLE pauses the table (`pausedAt`) without moving balances. CLOSE TABLE & SAVE BALANCES moves each Player’s AVAILABLE into `PLAYER_POCKET` with `TABLE_TRANSFER_OUT`, then later tables credit `TABLE_TRANSFER_IN` on join. Closed tables reject gameplay commands. The Bank virtual reserve is not stored or transported.

### Table setup and betting

- `CREATE A TABLE` immediately creates or reuses one `TABLE_SETUP` draft and opens `/tables/{tableId}` with a single setup mask over the real Dealer table. The mask already shows the shared table QR.
- `CREATE TABLE` finalizes name, starting jetons, and invitations, then closes the mask. There is no separate waiting-room page.
- During `TABLE_SETUP` the Dealer table shows `CURRENT PHASE: TABLE SETUP`, player boxes for Invited/Joined/Ready, a compact QR overlay, `+ PLAYER`, and `OPEN BETTING`. `OPEN BETTING` is enabled after the first Player joins and is the `TABLE_SETUP → BETTING` command.
- During BETTING the Bank can `DEAL CARDS NOW` or `DEAL IN 7 SECONDS`. The seven-second option stores `Round.bettingCloseDeadlineAt`; refresh resumes from that deadline and the close happens once.
- Repeated create clicks reuse the same empty draft. Refresh returns to that draft and QR. Finalizing is idempotent. An unused draft can be abandoned only before another Player joins.
- Joining credits starting jetons to that membership exactly once (`starting-jetons:{tableId}:{userId}`).
- Tapping a jeton now fails with a domain error such as `You do not have enough jetons` instead of a generic 500. The previous production bet failure was `creditTableAvailable` throwing a plain `Error` when AVAILABLE was 0 because join never credited starting jetons.
- Join/redeem retries are idempotent. Live Dealer seats use SSE plus a short snapshot poll so `Invited` becomes `Joined`/`Ready` without a manual refresh.

### Authenticated home

- Empty authenticated home is a welcome screen with game cards, `CREATE A TABLE`, and `JOIN A TABLE`.
- First landing of a browser session plays a short decorative jeton rain that never blocks actions, runs once per session, and is skipped when `prefers-reduced-motion` is set.
- Existing tables appear as compact rows with game, phase, Dealer, Players, owner-visible balances, counts, and `RETURN TO TABLE`.
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
