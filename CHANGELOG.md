# Changelog

## Unreleased

### Prompt 6 — migration gate tests (not merged)

- Release-gate fixtures use accessible payout names, `BETTING` copy, Game Session switch sheets, and a local-only admin email fixture for wipe screenshots. Production deploy and live acceptance are still required before merge/tag.

### Prompt 5 — Game Sessions, payout density, personal ledger

- Unresolved Dealer payout is one horizontal result row. Betting copy is `BETTING` only.
- Owner top-right DEALER / game badges open existing sheets at safe boundaries.
- Persisted Game Session + participants; switch-game closes the session and opens a fresh allocation. Poker Dealer must be seated and funded at session start.
- Verified GAME LEDGER. Admin-only `WIPE ALL MY TABLES` (`JETONBRO_ADMIN_EMAIL`, phrase `WIPE ALL TABLES`). Local Table Mode documented, not implemented.

### RC3 live acceptance candidate (JetBro II Web)

- Branch `fix/rc3-live-acceptance` at `9ff89cb` deployed to Railway project `tranquil-unity` / production / service JetBro II Web only (`0850b377-e73a-4ef0-be83-fc008255cc23`, SUCCESS / Online).
- Pre-deploy gate: stale Poker e2e aligned to frozen Blackjack copy; deterministic flop CALL capture `07-flop-player-facing-call-390x844.png`; focused Playwright + guardrails + build green.
- Live isolated-context acceptance against `https://jetbro-ii-web-production.up.railway.app` passed (roles, create/join QR, BJ round, Poker streets through award + NEXT HAND, save). Production shots under `docs/screenshots/production-live/`. Not merged or tagged.

### Approved Tabletop visual system

- Implemented PNG-authority presentation primitives under `src/ui/skins/tabletop/components/primitives/`: `TableRail`, `Jeton` / `ChipStack`, `TableButton`, `PhaseDisplay`, `TableName`, `PlayerBox`, `DealerLedger` / `ResultControls`, `ActionDock`, `JetonTray`.
- Rewrote `tabletop.css` with designed cloth felt (soft grain/vignette), structural SVG gold rail, layered jetons, gold-gradient primary buttons, and dense Dealer ledger — no kidney plaques, diamond-hatch wallpaper, or dashed-circle chips as finished anatomy.
- Wired Blackjack `BankTable`, `PlayerTable`, `PhaseZero`, `WaitingTable`, and Shell/Dock/Tray into those primitives. Playfair Display loads as `--font-display` for table name / phase titles only.
- Behavioural render tests assert docks, tray/wallet, payout labels, and board ids; they no longer require `data-arc` / `data-dealer-positions` or forbid Dealer rules text.

### Tabletop visual recovery

- Reverted the rejected `c9fea51` visual restyle. Restored `tabletop.css` and layout typography from `bfd4f3c`.
- Retained Classic CSS isolation: registry imports `./classic/skin` only; Classic stylesheets are not loaded while Tabletop is active.

### Tabletop skin (default)

- New isolated skin at `src/ui/skins/tabletop/` with its own `tabletop.css` (`.tabletop-skin` / `data-skin="tabletop"`). Does not import Classic CSS.
- Registry default is `tabletop`; Classic remains registered for rollback only.
- Immersive felt board for Blackjack and Poker: cloth identity, Dealer ledger / Player boxes, bottom rail actions/tray. Home/Create Table/Delete All use the same palette.
- Visual captures under `docs/screenshots/tabletop/`.

### Blackjack PNG composition and owner delete-all

- Approved Player and Dealer PNGs are literal composition. Canonical markup lives in `ClassicPlayerTable` / `ClassicBankTable` with `blackjack-classic.css`. Plaques, 3-slot grids, and giant Dealer cards are gone.
- Owner-only `DELETE ALL MY TABLES` archives and hides every table the verified user owns after typing `DELETE ALL`. Ledger is kept. Other owners are untouched.

### Classic visual rebuild and owner table cleanup

- Home uses a dedicated heading and compact saved-table cards (name + game/state). Owner/Dealer metadata lives in the overflow and swipe reveal.
- Owners can swipe-left or use the card menu. `END & DELETE` is an Owner-only recoverable archive of an abandoned active table: invitations revoked, members hidden, ledger kept, no settlement.
- Classic CSS ownership: tokens / layouts / table / home / invite / board. Invite/sheet styles live in `invite.css`. Home CSS does not style a live table. Classic CSS has no `!important`.
- Live felt uses explicit Dealer 1 / 2 / 3–4 / 5–6 and Player 1 / 2 / 3 compositions. Table name is a single embroidered cloth mark. Player boxes and Dealer positions share an SVG betting-plaque silhouette (128×92 Player; larger solo Dealer).

### Classic screen pack and Blackjack phase-control matrix

- Classic table UI follows `design/reference/classic/jetonbro-player-bank-insurance.html` tokens (Georgia + Inter, emerald/gold/ivory) and `blackjack-phase-controls.ts` for visible actions.
- Dealer: Phase 0 `START BETTING` + `ADD PLAYER`; Betting `DEAL CARDS` + `ADD PLAYER`; Playing exclusive insurance + `ENTER PAYOUT`; Payout `START BETTING` after resolution.
- Player: Betting `PLACE BET` / `RETRACT` / `ADD BOX`; Playing `2×` / `SPLIT` / conditional `INSURANCE`; Payout idle tray. Box 1 starts centred; Box 2 fills left without jumping.
- Dealer live boxes use the approved compact ledger (one short row per Player/box). Giant oval cards, the dashed felt frame, and the PLAYERS / BOXES / ON TABLE footer are gone. Gameplay header shows the table name once. Dealer primary actions sit in the bottom dock. Player Playing keeps a consistent `2×` / `SPLIT` / `INSURANCE` row. Owner `DEALER WON` remains a table-menu action.
- Classic composition: Player felt is a full-height grid that centres the 3-slot stage; a reserved contextual row holds ADD BOX or the compact Insurance panel so boxes do not jump; Dealer ledger fills leftover felt for 1–4 rows and scrolls only at 5+; desktop frames the whole app inside one rounded 480px phone. Approved PNG boards are visual authorities, not data contracts.
- Classic visual polish: live table name sits on the felt; Dealer chrome/rules/column headings are gone; Dealer actions use a 65/35 bottom dock; payout keys are a large 2×2; Player boxes are rectangular betting cards.
- Casino-felt correction: Phase 0 reuses the shared 65/35 Dealer dock; the table name is a printed cloth mark without ornaments or metadata; Dealer boxes are compact betting positions rather than admin ledger rows.
- Blackjack presentation: compact role/phase copy (`Table setup`, `Betting open`, `Waiting for the table to open betting.`, `Betting is open.`); Owner Change Dealer / Change Game stay in the existing table menu during eligible Betting; no duplicate commands or routes.

### Live identity repair — request cookies, inline Create Table invites

- Guest join writes `jetonbro.guest` and reloads `/tables/{id}` as a full document. Snapshot, stream, command, and table page resolve the actor from the request Cookie header; a matching guest cookie wins over leftover Auth.js.
- Create Table invitations are compact and inline. Phase 0 uses `ADD PLAYERS` to open the invitation dialog.
- Table poll is 500ms. Failed commands stay visible as inline errors.

### POST-RC3 repair 1 — compact shell, invitation mask, live role routing

- Create Table is a dense 390×844 app screen. `ADD NEW PLAYER` opens one Classic invitation mask with exclusive Guest QR, Verified QR, and Email Invite tabs.
- Guest cookie wins over an unrelated Auth.js session for the invited table. `selectTableBoard()` chooses Player vs Dealer boards from snapshot flags. Blackjack Phase 0 keeps the Owner on the admin board after they assign a different Dealer. `canStartBetting` follows a real seated non-bank Player.
- Shared Classic tokens: deep felt, control surface, gold, ivory, compact spacing, 44px targets, fixed Player tray.

### Prompt 10 — two-phone Guest vs Verified invitations

- Create Table keeps the specified hierarchy and shows Guest QR and Verified QR inline before START TABLE, with dock padding so pending email rows stay visible. Add Local Player is Owner-menu only.
- A table-scoped signed guest session replaces same-device “Add Local Player” as the second-phone journey. Verified join still uses Auth.js/Resend.
- Join bumps table revision so the Dealer snapshot sees the seated Player and `OPEN BETTING` can enable. Guest QR requires a connection to JetBro II Web.
- Unresolved Dealer payout rows no longer render a WON swipe ghost.

### Prompt 9 — player payout phase controls and RC2

- Player DOUBLE / SPLIT / INSURANCE render only during PLAYING and only dispatch when the snapshot legal flags allow them. Payout keeps the wallet and tray, not playing or betting commands.
- Create Table keeps the typed name and starting jetons when a later snapshot arrives.
- `v1.0.0-rc.2` merge commit `8b3aafe` deployed to JetBro II Web (`81005e2a`). Production screenshots: `docs/screenshots/production/`.

### Prompt 8 — payout overlap, viewer wallet, Phase 0 density

- Player payout boxes stack identity, MAIN, and Insurance on separate lines inside the same 154px gold cards. Insurance is omitted when the box has none.
- Poker Hand Complete marks the authenticated viewer’s seat as YOU and binds the tray AVAILABLE to that viewer’s snapshot balance.
- Phase 0 keeps compact dealer/player rows and a small empty-waiting card. Assign Dealer stays in the table menu.

### Prompt 7 — approved Blackjack and Poker phase screens

- Classic game screens follow the five stored boards in `docs/design-reference/`. Player boxes are rectangular gold cards; Dealer rows stay compact; Poker actions sit in one board-style row above the tray.
- Owner close then delete: archived tables remain on Home without Resume; Owner Delete hides them without deleting ledger rows.
- Contact sheets: `docs/screenshots/approval/`.

### Prompt 6 — restore Create Table, invitations, and Phase 0

- Home is a compact Saved Tables index with `CREATE TABLE`, `RESUME`, and owner-only `DELETE` / `CLOSE TABLE`.
- `CREATE TABLE` opens one full setup screen on a draft table. `START TABLE` (`finalizeSetup`) opens Phase 0.
- Phase 0 uses compact Player rows and `OPEN BETTING` / `START HAND`. The giant empty seat and start-game controls above setup are gone.
- Invitations (email, QR, copy link) work on the draft before start. Unused drafts stay off Home.
- Poker Phase 0 keeps `setup` / `waiting` on the snapshot while `TABLE_SETUP` so Start Table does not fall through to the live Poker Dealer screen.

### Prompt 5 — staging packaging repair

- Railway `prebuild` runs guardrails. The image now includes `.cursorfile`, `CHANGELOG.md`, and `docs/architecture/CURSOR_GUARDRAILS.md`. Test screenshots and Playwright specs stay out of the runtime image.
- Staging deploy of `c21fc8b` to JetBro II Web (`https://jetbro-ii-web-production.up.railway.app`). Tag `v1.0.0-rc.1`. Automated three-role Railway Playwright passed. Real two-phone pass is still required.

### Prompt 4 — complete product lifecycle and release candidate

- Home is a compact entry: `CREATE TABLE`, saved tables with one `RESUME`, table name, `SETUP` or current game, player count, Owner/Dealer, and resume status. Per-player balances and box counts are not on Home cards.
- Owner administration can rename the table, add a local Player by name without email, invite by email when configured, assign Dealer, fund, switch games at a safe boundary, and save/close. Those utilities stay in the table menu, not the phase dock.
- A joined Dealer uses Blackjack phase controls and their own Player actions. They cannot rename, switch games, assign Dealer, remove Players, save, or close. Players see shared state and only their own actions.
- Menu sheets restore focus, close on Escape and overlay click, and block the felt. Missing Resend configuration shows an unavailable email state and never blocks QR, copy link, local add, or starting a game.
- Full two-device release journey: `e2e/release-lifecycle.spec.ts`.

### Prompt 3 — Poker Dealer/Owner/Player screens

- Approved Poker board `12_50_27 PM (5)` is documented as visual authority. The source file was not available to copy into `docs/design-reference/poker-dealer-owner-phases.webp`; do not regenerate it.
- Owner and Player Poker screens share the Classic seven-zone shell. One seat row across every street. Owner phase actions live in zone 3 (`START HAND`, street deals, `AWARD POT`, `NEXT HAND`). Player actions sit above the fixed tray. Card Assist, seat order, switch game, and `NEXT HAND IN 7 SECONDS` stay in the table menu.
- Actor devices show `YOUR TURN`; other devices show `TURN`. `CALL 0`, leftover To Call, and Waiting seats never appear after Hand Complete.

### Prompt 2 — design authority, Blackjack polish, MVP workflow

- Design boards and the seven-zone grid are the visual authority (`docs/DESIGN_AUTHORITY.md`). Player boxes occupy a fixed 3-slot stage and do not jump across Betting, Playing, Insurance, or Payout.
- Owner utilities, Card Assist, and countdown extras live in the table menu. Phase-action only advances the round. Insurance labels are `MAIN` / `INSURANCE` / `INS WON` / `INS LOST`.
- MVP file map (`docs/MVP_FILE_MAP.md`) keeps engine files frozen and limits Cursor to the active Classic UI slice.

### Prompt 1 — simple setup, shared visual system, Blackjack screens

- Home → Create Table → one Table Setup → invite Players → `START BLACKJACK` or `START POKER`. Create asks only for table name, host name if unknown, and starting jetons. Blackjack defaults stay 3:2, 3 boxes, Insurance on.
- Blackjack labels: `START BLACKJACK`, `CLOSE BETTING`, `ENTER PAYOUT`, `START NEXT ROUND`. Command handlers are unchanged. Poker reducer/protocol is unchanged.
- Shared Classic slots: TableShell, PhaseBar, TableIdentity, DealerRow, PlayerRow, BlackjackBox, PhaseActionDock, JetonTray. Player box selection is tap-only. Card Assist stays out of the default main UI.
- Insurance PAYOUT buttons are `INSURANCE WON` / `INSURANCE LOST`. A jeton tray tap still places when the pointer did not drop on a box.

### Product boundary restated

- JetonBro is a virtual-jeton ledger for physical tables. The dealer owns cards, decisions, and winners. The application owns balances, locks, blinds, pots, turn indication, dealer-declared payout, and ledger persistence.
- Protocol work must not add digital-card play, hand evaluation, automatic winners, or a visual redesign.

### Texas Hold’em fold-complete and pot authority

- A completed hand now clears the actor, street wager, and amount to call. `HAND COMPLETE` cannot keep `TO CALL`, a Waiting seat, or leftover Fold/Call controls.
- Fold-out awards the complete pot once. The felt shows `{name} WON {amount}` and `POT PAID` instead of an unexplained `POT 0`.
- Bank and Player snapshots use one `legalActions` / `liveAmountToCall` path. A player who cannot post a blind is All-In for the posted short amount.
- Next hand still rotates the Dealer once and posts blinds once. Manual `NEXT HAND NOW` and the countdown share that transition.

### Blackjack headers, box swipe, and Poker betting protocol

- Blackjack table chrome is now nav + compact phase heading + essential phase controls. The live table name is printed only on the cloth. Duplicate names, `CURRENT PHASE`, and repeated instructional sentences are gone across TABLE SETUP, BETTING, PLAYING, and PAYOUT.
- Players with two or more Blackjack boxes swipe the box cluster to change the selected box: left for next, right for previous, wrapping at the ends. Taps and vertical movement do not navigate. Box-specific controls follow the selected box. Payout row gestures are unchanged.
- Heads-up and multi-way Poker snapshots use the posted big blind as the live street wager, so the small blind faces `CALL` rather than `CHECK`. RAISE stays visible with CHECK when a wager already exists (big-blind option). ALL IN shows the stack amount. The composer uses a **Raise to** convention with the legal minimum.
- A player who has already acted cannot raise a short all-in. Full raises still reopen action. Bank and Player views share the same actor, pot, street contribution, and to-call amounts. The Poker table name sits on the cloth; seat amounts are labelled AVAILABLE and STREET.

### Compact Blackjack rows and Poker felt

- Dealer Blackjack uses one shared compact `DealerBlackjackBoxRow` in BETTING, PLAYING, PAYOUT, and ROUND_COMPLETE. Circular betting spots are gone. The DEALER hand is the same compact row at the top of the list. PLAYING keeps a small inline `+ CARDS` control; entered ranks stay in the row. PAYOUT swipe/button behaviour is unchanged.
- Poker optional cards are collapsed by default. `+ HOLE CARDS` (own seat only) and `+ BOARD CARDS` (Owner, from FLOP) open a temporary sheet with CLEAR / CANCEL / SAVE. Hole ranks stay private; board cards stay public. The permanent rank/suit keyboard is gone.
- The mobile Poker felt is a compact shared layout: table name once on the cloth, street rail, community slots, pot, `TO CALL` only when owed, and seat rows. The large oval, gold dots, and duplicate header name are gone.
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
