# Changelog

## Unreleased

### Compact Blackjack rows and Poker felt

- Dealer Blackjack uses one shared compact `DealerBlackjackBoxRow` in BETTING, PLAYING, PAYOUT, and ROUND_COMPLETE. Circular betting spots are gone. The DEALER hand is the same compact row at the top of the list. PLAYING keeps a small inline `+ CARDS` control; entered ranks stay in the row. PAYOUT swipe/button behaviour is unchanged.
- Poker optional cards are collapsed by default. `+ HOLE CARDS` (own seat only) and `+ BOARD CARDS` (Owner, from FLOP) open a temporary sheet with CLEAR / CANCEL / SAVE. Hole ranks stay private; board cards stay public. The permanent rank/suit keyboard is gone.
- The mobile Poker felt is a compact shared layout: table name once in the header, street rail, community slots, pot, `TO CALL` only when owed, and seat rows. The large oval, gold dots, and duplicate cloth name are gone.
- `CALL` uses the authoritative amount owed and is never `CALL 0`. A zero stack cannot Call/Bet/Raise. All-In and Folded Players still get no actor controls. Short stacks that cannot cover the owed amount get All-In, not a zero Call.

### Blackjack layout, in-box cards, and DEALER WON

- The Classic Blackjack table is a single phone/felt frame. The nested wood/leather rail from the realistic restyle is gone; decorative pseudo-elements cannot receive pointer events.
- `ROUND_COMPLETE` (and PAYOUT next-round) shows `NEXT ROUND NOW` and `IN 7 SECONDS` as equal-width compact buttons on one row. Commands and deadlines are unchanged.
- Optional `+ CARDS` and entered ranks sit inside each Player betting box and a dedicated Dealer box (PLAYING, PAYOUT, ROUND_COMPLETE). The large full-width Add Cards control is gone. Card Assist OFF / CONFIRM / AUTO is unchanged; physical cards stay authoritative.
- Owner-only `DEALER WON` in PAYOUT settles every currently unresolved active Player box as `LOST` in one transaction using the existing per-box ledger rules. Already-settled boxes and Insurance are untouched. Duplicate submissions are idempotent.
- Payout swipes bind to the complete unresolved row with Pointer Events and `setPointerCapture`, ignore non-primary pointers, and do not start from outcome buttons.

### Realistic Classic table visuals

- Blackjack and Texas Hold’em share one CSS table system: emerald felt texture, antique-gold rails, cream serif headings, ivory cards, denomination-coloured jetons, and a matte-black bottom dock.
- The configured table name is printed on the cloth in every live phase. Mockup names are never hard-coded.
- Poker setup uses a compact oval table with POT 0 and no D/SB/BB until DEAL CARDS. Active hands show a `PRE-FLOP · FLOP · TURN · RIVER · SHOWDOWN` rail and five community-card slots. Optional card entry stays display-only.
- Payout rail order and gestures are unchanged: LOST, STAND OFF, BLACKJACK, WON; swipe left/right and double-tap STAND OFF.

### Poker streets, optional cards, and Classic table shell

- `DEAL RIVER` now starts a real River betting street: street contribution and action-completion reset, totals and pot stay, first actor is left of the rotating D, and `actionCount` / `Table.updatedAt` move so SSE cannot keep a completed-street snapshot. `SHOWDOWN` enables only after River matches. All-in runout still deals remaining streets without inventing an actor.
- Owner and Players share a compact `DEAL → PRE-FLOP → FLOP → TURN → RIVER → SHOWDOWN` rail.
- Optional community and hole cards are display-only. Community values are public; hole values stay private to that Player. They never advance a street or change the ledger. Manual Showdown stays authoritative.
- Community cards render large in the centre pot; a Player’s own hole cards sit at their seat. Blackjack optional ranks move out of the bottom strip into larger cards inside the betting box; rank controls stay below.
- `CREATE NEW TABLE` goes to `/tables/new` and opens one reused draft on `/tables/{id}` immediately. Setup uses the green felt plus the black bottom dock.
- Classic CSS tokens (`--emerald`, `--felt`, `--cream`, `--gold`, `--dock`) are shared across table phases.

### Compact Blackjack betting, game switching, and Texas Hold’em

- The Create Table mask selects Blackjack, Texas Hold’em, or Zilch — Coming later. Confirming Poker opens `POKER_SETUP` with no Blackjack round. Owner-only `DEAL CARDS` starts one hand, posts blinds once, and marks the first actor. Seat order is compact up/down in the table menu during `POKER_SETUP` before the first hand, then locked. Owner and Players share the same felt: pot chips and total, `TO CALL` only when owed, D/SB/BB markers, and street commitment. `NEXT HAND NOW` / `NEXT HAND IN 7 SECONDS` use `PokerHand.nextHandDeadlineAt`. Shared UI projects the active Poker hand phase (`Texas Hold’em · PRE-FLOP`) instead of a leftover Blackjack round phase. Save/close is blocked while `LOCKED_POKER` exists or a hand is unsettled. The current actor is marked `YOUR TURN`.
- Blackjack Deal stays blocked until a locked bet exists and shows `WAITING FOR THE FIRST BET`.
- Limited Bank on the Betting screen is one compact Open/Limited toggle, visible and usable only by the Bank/Dealer during BETTING. Players never see that toggle.
- The Table Owner can switch to Texas Hold’em when no value is locked. Memberships, AVAILABLE balances, invitations, and frozen Limited Bank buckets are preserved. Zilch stays coming later.
- Texas Hold’em is a separate `src/domain/poker` module with blinds, actor-only actions, side pots, Showdown awards, and no digital cards. Table Owner, rotating Dealer button, and current actor are distinct. CALL stays live while BET/RAISE is composed; chips stage an amount until CONFIRM. Owner street controls sit above the shared Player wallet and stay disabled with `Waiting for bets to match` until the street is complete. Snapshot loads skip Blackjack close-betting while Poker is active so game switches cannot 400 the table.

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
