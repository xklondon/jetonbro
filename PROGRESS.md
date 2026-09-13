# JetonBro progress

Agent-session memory. Update this file at the start and end of every build-order step. Do not start the next step until the current one is reviewed.

## Current

Persistence PR B (Postgres adapters) is ready for review. Do not attach Railway Postgres until this PR is merged. `main` includes PR A at `dfb1d75`.

## Guardrails (genesis Steps 1–3)

| Date | Status | Summary |
| --- | --- | --- |
| 2026-09-13 | done | Confirmed repo root has only `jetonbro-requirements-v4.md` as a requirements doc. No superseded v1/v2/v3 plan/scope files. No `AUDIT.md` to relocate. Added `.cursorrules`, `docs/ROUTE_MANIFEST.md`, `scripts/check-routes.sh`, CI workflow, this file. |

## Build order

From `jetonbro-requirements-v4.md` § Build order. One step at a time; stop after each for review.

| Step | Name | Status | Date | Summary / PR |
| --- | --- | --- | --- | --- |
| 1 | Wallet + escrow engine, unit-testable, no UI | done | 2026-09-13 | In-memory master/game wallets + CONFIRMED→LOCKED→RESOLVED→RELEASED in `src/escrow/`. Local commit (no remote PR). |
| 2 | Protocol configs + turn-order, wired to escrow | done | 2026-09-13 | Three data-only protocol configs + shared handler/turn-order in `src/protocol/`. `canResolveForTable` is what `EscrowService` consumes. Local commit (no remote PR). |
| 3 | Personal ledger read-model (Save / Clear) | done | 2026-09-13 | `src/ledger/` derives pair transfers from RELEASE via an `EscrowStore` wrapper. Save snapshots; Clear writes `MANUAL_SETTLEMENT`. Local commit (no remote PR). |
| 4 | Auth / invite (magic-link, WhatsApp, QR, Mates) | done | 2026-09-13 | `src/auth/` + first REST routes in `src/http/registerRoutes.ts`. One magic-link path; WhatsApp is a share intent. Guest upgrade calls `reownMasterWallet`. Route guard exercised (duplicate throwaway failed, then removed). |
| 5 | Core UI (stack/pot, phase actions, Simple, Standings) | done | 2026-09-13 | Blackjack boxes + ownership gate. GET verify is peek-only; POST completes T&Cs. Simple skin is a token object. Standings wired to the personal ledger. |
| 6 | Remaining skins + chip-visual mode | done | 2026-09-13 | Casino/Bank/Fun token objects + chip-visual denoms. `117e668`. |
| 7 | Fun nav (Yellow card, Red card, Magic 8-ball) | done | 2026-09-13 | Static Fun hub + cards + 8-ball. `117e668`. |

## Decisions log

Assumptions not spelled out in `jetonbro-requirements-v4.md`. Flag these; do not bury them only in code comments.

| Date | Decision | Justification |
| --- | --- | --- |
| 2026-09-13 | CI wallet/ledger write-guard treats `src/escrow/` as the single allowed mutation module | Requirements say one service mutates wallet/ledger rows but do not name a path. The directory is reserved in `scripts/check-routes.sh` only — the module is not created until build-order step 1. |
| 2026-09-13 | `scripts/check-routes.sh` is wired via `.github/workflows/ci.yml` | Genesis prompt asked to wire the check into CI while the codebase is still empty. |
| 2026-09-13 | Store is in-memory only (no database) | Step 1 is a unit-testable service with no routes/UI. Persistence can be swapped behind `EscrowStore` later without a second write API. |
| 2026-09-13 | **Escrow store is swappable.** `EscrowService` depends only on the `EscrowStore` interface; `createMemoryStore()` is the default implementation, not inlined in service logic. `EscrowStore` and `createMemoryStore` are exported from `src/escrow` so a persisted adapter can be passed to `createEscrowService(store)` without changing callers. | Confirmed at the start of step 2. No service-logic rewrite required. |
| 2026-09-13 | Blackjack multipliers: `win=2`, `blackjack=2.5`, `push=1`, `lose=0` | Requirements name the outcomes but not the numeric multipliers. 2 / 2.5 / 1 / 0 is even-money, 3:2 blackjack, return-of-stake push, and zero on lose. |
| 2026-09-13 | Bridge actions (`begin-resolution`, `finish-resolution`, `begin-showdown`, `finish-showdown`, `start-hand`, `start-turn`) | The v4 tables list phases but not every transition verb. Shared handler needs an action id to change phase; these are data rows, not per-game code. |
| 2026-09-13 | Poker blinds act one at a time in seat order; after `new-hand`, current turn is the seat after the new dealer | Requirements say two blinds confirm and that the button follows turn order, not the exact first-to-act rule. |
| 2026-09-13 | Protocol table/turn state is plain in-memory objects, not `EscrowStore` | It is not a wallet or ledger. Keeping it off the escrow store avoids a second write path into wallet rows. |
| 2026-09-13 | `confirm` does not deduct; `lock` deducts from the game wallet | Matches CONFIRMED vs LOCKED: spendable stack is reduced only when chips move into the pot/box. |
| 2026-09-13 | The same `canResolve(actor, protocolConfig)` stub gates both RESOLVE and RELEASE | Real role/phase checks arrive in step 2; tests required an injected authorization callback now. |
| 2026-09-13 | Suggested payout is editable via `setResolvedPayout` while RESOLVED | Requirements say the multiplier / even-split suggestion is always editable before release. Edit writes a `PAYOUT_ADJUST` ledger row and does not change state. |
| 2026-09-13 | Even-split leftover chips go to the first listed winner | Integer chips; pot may not divide evenly. Plan is editable before release. |
| 2026-09-13 | Multiplier payouts use `counterpartyUserId` for pot shortfall or extra | Needed so win (payout > pot) and lose (payout < pot) can move chips without protocol-specific branches. |
| 2026-09-13 | `ensureMasterWallet(userId, openingBalance)` sets chips only on first create | Step 1 has no auth/account-creation flow; tests need a way to provision the master wallet. |
| 2026-09-13 | Personal ledger listens by wrapping `EscrowStore.insertLedger`, not by patching `EscrowService` | One-directional: escrow does not import `src/ledger`. Callers compose `createEscrowService(listenForReleases(store, ledger))`. |
| 2026-09-13 | RELEASE rows become pairwise transfers from pot contribute/receive nets | A RELEASE escrow row has no from/to. Deriving A→B from (credits − contribution), including counterparty extra/shortfall, is the chip movement the standing should reflect. |
| 2026-09-13 | Clear writes `MANUAL_SETTLEMENT` from the debtor to the creditor; net treats settlement A→B as cancelling A's debt to B | Same-direction as a RELEASE transfer would deepen the debt. Settlement is an offset, not another game transfer. |
| 2026-09-13 | Clear on an already-settled pair is a no-op (no row) | Requirements do not say to write a zero-amount settlement. |
| 2026-09-13 | **Blackjack box ownership (step 2 open question):** display-only turn should **not** let a player act on someone else's box. v4 says the player confirms into **their** box and that boxes act independently (no wait-your-turn between players). Step 2's handler currently only checks "seated player" for `bet`/`double`/`split`. Box-owner enforcement is missing and should be added when boxes exist as table state — not a turn-pointer job. | Answer recorded in step 3 as requested. |
| 2026-09-13 | **Blackjack box-ownership enforcement is still open.** Step 4 did not resolve it. Address it in step 5 when box entities are introduced — not via the turn pointer. | Flagged again so it is not forgotten between invite work and core UI. Resolved in step 5 (see later row). |
| 2026-09-13 | WhatsApp invite is the same magic-link/verify pair as email; the only extra is a `wa.me/?text=` share URL | Requirements: different channel, not a second auth path. |
| 2026-09-13 | Mates guest user id is `guest:${deviceId}`; upgrade calls `EscrowService.reownMasterWallet` and never `ensureMasterWallet` on the verified id first | Wallet writes stay in `src/escrow/`. Creating the verified wallet first would hide a duplicate-wallet bug. |
| 2026-09-13 | Failed T&Cs on `GET /api/auth/verify` does not consume the magic link | Otherwise a share tap without the checkbox would burn the invite. |
| 2026-09-13 | REST identities are registered only in `src/http/registerRoutes.ts` with full paths on `app` | `scripts/check-routes.sh` extracts `app\|router.(get\|post\|…)` and matches the Identity column. First real exercise: clean pass → throwaway duplicate `POST /api/auth/request-magic-link` failed as designed → throwaway removed → pass. |
| 2026-09-13 | Blackjack `Box` lives on `ProtocolTableState`; Bet/Double/Split/Insurance use `requiresOwnedBox` / `createsOwnedBox` flags | Ownership is a box-entity gate, not the display-only turn pointer. Same handler for all protocols; poker/zilch simply have no boxes. |
| 2026-09-13 | `GET /api/auth/verify` only inspects the token; `POST /api/auth/verify` completes T&Cs / account | Mail scanners auto-follow GET. Completing on GET with `acceptedTerms=1` was a real foot-gun. |
| 2026-09-13 | Simple is `SIMPLE_SKIN` (`SkinTokens`); Casino/Bank/Fun are reserved ids on the same type | One component tree reads CSS variables. Step 6 adds token objects, not new table/standings components. |
| 2026-09-13 | Bank assign/top-up credits the game wallet via `EscrowService.creditGame` | v4 setup phase assigns jetons to the game wallet. That write stays in `src/escrow/`. |
| 2026-09-13 | Lock + applyAction share one table snapshot (`stack` + `pot.amount`) | UI piles CSS-transition those fields. No separate animation state. |
| 2026-09-13 | **T&Cs were deliberately dropped for v1 friends-only testing.** `requiresTerms` is always false; verify/join no longer gates on `acceptedTerms`. Revisit and restore a terms gate before any wider / non-friends rollout. This is not a decision that the app never needs terms of use. | Live Railway testing: the checkbox blocked friends from joining while there is still no real email verification. Scoped removal, not a product-forever call. |
| 2026-09-13 | **No mailer in this deploy.** Typed email is an identity label, not a verified inbox. `requestMagicLink` writes an in-memory `emailOutbox` and returns the token in the JSON body; the home/invite UI navigates to `/verify?token=…` in the same browser. No SMTP/SendGrid/Resend/MAIL_* env or provider is configured. | Explains live "asks for email but not authing." Do not add a provider until the owner decides. Superseded the same day: see Resend row. |
| 2026-09-13 | **Resend over HTTPS for email-channel magic links.** `RESEND_API_KEY` + `APP_ORIGIN` send the frontend `/verify` URL. No key: `emailOutbox` + token in the JSON body (local/CI unchanged). WhatsApp and QR never call Resend. GET `/api/auth/verify` stays peek-only. | Simplest free-tier API (no SMTP). Same-tab round-trip is the bug live testing hit; hide the token in the HTTP response once mail actually goes out. |
| 2026-09-13 | **Setup chips come only from Add player.** `assign-chips` / `top-up` removed from the blackjack config and the table UI. | The old Credit player dropdown duplicated invite starting chips and confused the owner setup screen. |
| 2026-09-13 | **Standing Bank starts unset.** Table runtime passes `standingAuthorityUserId: null` until the owner `assign-bank`s. Protocol unit tests that omit the field still default to `playerIds[0]`. | Owner and Bank are different roles; the owner is not auto-Bank. |
| 2026-09-13 | **`open-betting` keeps its action id**; UI label is Start betting. Gated by `requiresNonAuthorityPlayer`. | Extends the existing action instead of a second start-betting identity. |
| 2026-09-13 | Setup/resolution UI is action- and payout-rule-gated, not `protocolId === blackjack`. Dead `creditsGame` / assign-chips / top-up paths removed. All protocol action ids listed in the manifest. | `.cursorrules`: no per-game branches; no dead code; every action type registered. |
| 2026-09-13 | Chip denoms are `100, 25, 10, 5, 1` — one greedy breakdown for any integer | Not a blackjack box/multiplier table. Poker pots and zilch stakes use the same function. No 500 denom so a large pile stays a short column. |
| 2026-09-13 | Skin + chip-visual are local appearance prefs (`localStorage`), not table or protocol state | Presentational only. Switching skin does not write a wallet or ledger row. |
| 2026-09-13 | **Store methods are async.** `EscrowStore`, `AuthStore`, `PersonalLedgerStore`, and `TableRuntimeStore` return `Promise`. Memory impls wrap the previous sync maps. Services/routes `await`. Signature change only — same operations, same writers. | `pg` is async. Keeping a sync interface would force write-behind or a fake blocking client. |
| 2026-09-13 | **`PersonalLedgerStore` extracted.** `recordRelease` / `clear` / `save` remain the only writers. Reads go through `listEntries` / `listSnapshots`. | Same extraction `EscrowStore` already had. Needed before a Postgres adapter. |
| 2026-09-13 | **`TableRuntimeStore` holds protocol + `boxEscrowIds` only.** `ensureRuntime` loads a stored record; a true miss still fabricates setup and `put`s it. Hand photos stay on `TableService` in memory. | Approved persist set. Photos are display-only and up to 4MB. |
| 2026-09-13 | **Postgres via `pg` + ordered `.sql` migrations. No ORM.** Four store adapters implement the existing interfaces. `createApp()` stays in-memory; `createPersistentApp(url)` is what `server.ts` uses when `DATABASE_URL` is set. | Minimal backend. Tests and local `npm test` without a URL stay on memory. |
| 2026-09-13 | ISO timestamps stored as TEXT; protocol/`boxEscrowIds`/payout/standings as JSONB. | Memory stores used ISO strings. `pg` Date objects would change equality in tests and APIs. |
| 2026-09-13 | `check-routes.sh` ignores `migrations/` and allows `personal_ledger*` writes in `src/ledger/`. | Schema DDL is not a second write API. Personal-ledger rows are not escrow wallet rows. |

## Infrastructure

Not a requirements build-order step. Friends-only Railway deploy.

| Date | Change | Why |
| --- | --- | --- |
| 2026-09-13 | `railway.json` + `nixpacks.toml`: `npm ci && npm run build`, then `npm run start` | Auto-detect was copying `web/dist` before Vite created it. This is one root package (not workspaces); `npm run build` is `vite build` and writes `web/dist`. |
| 2026-09-13 | Single Railway service: Express serves `/api` and `web/dist` | `createApp` already static-serves `web/dist` when present. One origin, no CORS, one deploy. Two services would be extra moving parts for a v1 friends table. |
| 2026-09-13 | `DATABASE_URL` is optional; in-memory stores if unset | Still true. When set, startup runs migrations and uses Postgres adapters. |
| 2026-09-13 | CI runs `npm test` against a Postgres 16 service (`DATABASE_URL`). Local suite skips those tests without a URL. | Same interface contract, two backends. |
| 2026-09-13 | Pin Node 20: `engines.node` `>=20`, Nixpacks `nodejs_20` + `NIXPACKS_NODE_VERSION=20` | Railway was building on Node 18.20.5; webidl-conversions / whatwg-url require >=20. |
| 2026-09-13 | **EBUSY `rmdir node_modules/.cache` during `npm ci`:** option 1 — `.npmrc` + `NPM_CONFIG_CACHE=/tmp/.npm-cache`. Also dropped the extra `npm ci` from `railway.json` `buildCommand` (install phase already runs it). Did not use option 2 (`--no-cache`) or option 3 (`npm install`). | Nixpacks mounts a cache at `node_modules/.cache`. A second `npm ci` in the build command tries to delete that mount. `npm ci` stays the install command. |

## Blocked

None.

## Step 4 PR questions

1. **Extend or new?** Extends `src/escrow/` with `listWallets` / `listMasterWallets` / `reownMasterWallet`. New: `src/auth/` (identity, invites, sessions) and `src/http/` (Express app + the single route registry).
2. **Route / event / action?** Yes — eight REST identities, all added to `docs/ROUTE_MANIFEST.md` in this step. Registered only in `src/http/registerRoutes.ts`. No socket events.
3. **Wallet / ledger writes?** Only through `EscrowService` (`ensureMasterWallet` on create, `reownMasterWallet` on guest upgrade). Auth never writes wallet rows.
4. **Card / dice / hand-eval?** No.
5. **Per-game branches?** No. Invite channels are config on the invite record, not protocol code.

## Step 5 PR questions

1. **Extend or new?** Extends `src/protocol/` (boxes + action flags), `src/escrow/` (`creditGame`, list helpers), `src/auth/` (inspect + `protocolId` on tables), `src/http/` (new routes). New: `src/table/` (composes protocol + escrow + ledger) and `web/` (Simple-skinned UI).
2. **Route / event / action?** Yes — `POST /api/auth/verify` plus table snapshot/actions/buy-in/hand-display and standings save/clear. `GET /api/auth/verify` notes updated. All in `docs/ROUTE_MANIFEST.md`. No sockets. No new protocol action *ids* (flags on existing rows).
3. **Wallet / ledger writes?** Only through `EscrowService` (lock/resolve/release/buy-in/credit). Standings Save/Clear go through `PersonalLedger`.
4. **Card / dice / hand-eval?** No. Hand-entry/photo is stored and shown as-is.
5. **Per-game branches?** No. Box/chip/credit behaviour is action flags. Authority role name is `protocol.authorityRole`.
6. **Do Simple tokens accommodate three more skins without restructuring components?** Yes, checked explicitly. `SkinTokens` already unions `simple | casino | bank | fun`. Components use `--skin-*` variables and `ThemeProvider tokens={…}` only. `SKINS` has reserved slots. A test applies dummy Casino/Bank/Fun objects through `applySkinTokens` + `StackAndPot` with no extra props. Step 6 is more token objects (plus chip-visual as a presentational layer on the same piles), not a new component tree.

## Auth diagnostic (live Railway, 2026-09-13)

Question: when a table owner types an email to invite/credit a player, does a real magic-link email go out and require a click, or does any typed email become an identity?

**No real email is sent. There is no email-sending provider on this deploy.**

Evidence:

- `.env.example` has only `PORT` and optional `DATABASE_URL`. No `SMTP_*`, `SENDGRID_*`, `RESEND_*`, `MAIL_*`, or API keys.
- Repo-wide search: no nodemailer / SendGrid / Resend / Postmark / Mailgun / transporter.
- `AuthService.requestMagicLink` appends `{ to, magicToken, verifyUrl }` to an in-memory `emailOutbox` and **returns the token in the HTTP response**.
- `HomePage` immediately navigates to `/verify?token=…` in the **same browser**. Tapping Continue on verify creates the session. Any typed address becomes that browser's identity — no inbox click.
- Until this follow-up, the live table screen had **no invite-by-email control**. The only player picker was **Credit player** (`assign-chips` / `creditsGame`) over people already at the table — top-up, not invite/auth.
- So "asks for email but not authing" is the owner bootstrap (home → same-tab token), not a mailed verify link. Credit-player never authed anyone.

Not fixed in this change set (waiting on the owner's call). The new Add player UI copies a join link and says no email is sent.

## Live-test follow-up PR questions

1. **Extend or new?** Extends `src/auth/` (invite `openingChips` / claim / `joinPath`), `src/table/` (invite roster on snapshot; opening chips via `creditGame`), and the existing table-owner setup screen. New UI only: `InvitePanel`, `InviteLandingPage`. Not a new backend module.
2. **Route / event / action?** No new REST identities. Extended notes on `POST /api/tables/:tableId/invites` (`openingChips`), `GET /api/tables/:tableId` (invite roster), verify/preview (T&Cs off). Frontend `/invite/:token` is SPA, not a REST identity. `scripts/check-routes.sh` run against this change.
3. **Wallet / ledger writes?** Only `EscrowService.creditGame` when a claimed invite has `openingChips` and has not yet been credited. Auth still does not write wallet rows.
4. **Card / dice / hand-eval?** No.
5. **Per-game branches?** No. Invite channel and opening chips are data on the invite record. Same snapshot/credit path for every protocol.

## Resend magic-link PR questions

1. **Extend or new?** Extends `src/auth/` (`requestMagicLink` + `src/auth/mailer.ts`). Home page stops same-tab navigation when `{ emailed: true }`. Not a new backend module.
2. **Route / event / action?** No new REST identities. Extended notes on `POST /api/auth/request-magic-link`. `GET /api/auth/verify` unchanged (peek-only). `scripts/check-routes.sh` run against this change.
3. **Wallet / ledger writes?** None. Mailer does not touch wallets.
4. **Card / dice / hand-eval?** No.
5. **Per-game branches?** No. Send vs outbox is keyed on invite channel (`email` vs WhatsApp/QR), not protocol.

## Setup-screen redesign PR questions

1. **Extend or new?** Extends `src/protocol/` (action flags: `assignsAuthority`, `requiresNonAuthorityPlayer`, `releasesBox`, `label`) and `src/table/` snapshot/act. New UI: `SetupPanel`, `ResolutionBoard`. Replaces `InvitePanel`. Not a new backend module.
2. **Route / event / action?** No new REST identities. New action id `assign-bank` (table-owner setup). `open-betting` kept, labeled Start betting. Manifest ACTION rows added. `scripts/check-routes.sh` run against this change.
3. **Wallet / ledger writes?** Opening chips still `EscrowService.creditGame`. Per-box confirm uses existing resolve / `setResolvedPayout` / release. No new wallet types or escrow states.
4. **Card / dice / hand-eval?** No. Resolution is Bank-declared outcome + multiplier suggestion.
5. **Per-game branches?** No. Flags live on action rows. Poker/zilch omit `assign-bank` / `releasesBox`.

## Step 6 PR questions

1. **Extend or new?** Extends `web/src/theme/tokens.ts` (Casino/Bank/Fun objects) and existing `ChipPile` / `ThemeProvider` / `Shell`. New helper only: `web/src/theme/chips.ts` (`denominationBreakdown`). No new table/standings/wallet component tree.
2. **Route / event / action?** No. No new REST identities, sockets, or protocol actions. Manifest unchanged for routes.
3. **Wallet / ledger writes?** None. Appearance is `localStorage`. Piles still read `snapshot.viewer.stack` / `snapshot.pot.amount` / master balance.
4. **Card / dice / hand-eval?** No.
5. **Per-game branches?** No. Denoms are not a protocol table. No `protocolId` check. Boxes render chips only when `snapshot.boxes.length > 0` (empty for poker/zilch). Outcome/multiplier code is not in this layer.

## Step 7 PR questions

1. **Extend or new?** Extends the existing Fun nav stub (`web/src/pages/FunPage.tsx` + `/fun` route). New static screens only under `web/src/pages/fun/`. No overlap with table/wallet/standings.
2. **Route / event / action?** No REST, sockets, or protocol actions. SPA paths `/fun/yellow`, `/fun/red`, `/fun/eight-ball` only. Manifest unchanged.
3. **Wallet / ledger writes?** None. Fun files do not import escrow, protocol, ledger, or auth.
4. **Card / dice / hand-eval?** No. Referee cards are generic coloured rectangles. 8-ball picks from a fixed string list with `Math.random`.
5. **Per-game branches?** No.

## Persistence PR A questions

1. **Extend or new?** Extends existing `EscrowStore` / `AuthStore` (async signatures). New interfaces only: `PersonalLedgerStore` (`src/ledger/store.ts`) and `TableRuntimeStore` (`src/table/store.ts`). No Postgres, no new feature module.
2. **Route / event / action?** No new REST identities, sockets, or protocol actions. Existing routes now `await` the same handlers. Manifest unchanged. `scripts/check-routes.sh` ok.
3. **Wallet / ledger writes?** Same writers, same modules. Escrow still only through `EscrowService`. Personal ledger still only `recordRelease` / `clear` / `save`. No second write path.
4. **Card / dice / hand-eval?** No. Hand photos still display-only and still not on the runtime store.
5. **Per-game branches?** No.

## Persistence PR B questions

1. **Extend or new?** Extends the four store interfaces with `src/*/pg.ts` adapters. New: `src/db/` (pool, migrations, test harness), `migrations/001_init.sql`. No new feature module and no ORM.
2. **Route / event / action?** No new REST identities, sockets, or protocol actions. Manifest unchanged. `scripts/check-routes.sh` ok.
3. **Wallet / ledger writes?** Still only `EscrowService` for wallets/escrow ledger (`src/escrow/pg.ts` is the store behind that). Personal ledger writes stay `recordRelease` / `clear` / `save` via `src/ledger/pg.ts`.
4. **Card / dice / hand-eval?** No. Hand photos still not in Postgres.
5. **Per-game branches?** No.

## Closing summary — all seven steps

| Step | Name | Commit on `main` | Notes |
| --- | --- | --- | --- |
| 1 | Wallet + escrow | `952faf2` | Guardrails `fc56454` first. |
| 2 | Protocol configs + turn-order | `37020ee` | |
| 3 | Personal ledger | `dc44165` | |
| 4 | Auth / invite | `be20d0b` | |
| 5 | Core UI (Simple, Standings) | `5732b3e` | |
| 6 | Skins + chip-visual | `117e668` | Same commit as step 7 and the live-test follow-ups. |
| 7 | Fun nav | `117e668` | Same commit. |

Infra (not a requirements step), already on `main`: `af3a91f` Railway build, `82a879c` Node 20, `e08f466` npm cache. Persistence PR A: `dfb1d75`.

Live-test follow-ups (invite roster, T&Cs dropped for friends-only, Resend mailer, owner setup + Bank assignment + per-box resolution) shipped in `117e668` together with steps 6 and 7. Pushed to `origin/main`.

### Known limitations (whole build)

- **Persistence is optional.** No `DATABASE_URL`: memory (local today). With `DATABASE_URL`: Postgres for escrow, auth, personal ledger, and table runtime. Hand photos / emailOutbox / Fun / appearance stay in-memory or `localStorage`.
- **Railway Postgres is not attached yet.** After this PR merges: add PostgreSQL, then set `DATABASE_URL=${{Postgres.DATABASE_URL}}` on the app service (name must match the DB service). Migrations run on boot — do not run SQL by hand.
- **Poker side-pots** are out of scope (v4). Single pot only.
- **No card/dice simulation or hand evaluation.** Hand photo/text is display-only.
- **No real-money rails** or payment integrations.
- **T&Cs are off** for v1 friends-only. Restore before any wider rollout.
- **Email:** Resend is wired (`RESEND_API_KEY` + `APP_ORIGIN`). Without those Railway vars, magic links still round-trip in the same tab via `emailOutbox`. Even with a key, Resend’s test sender only delivers to the account email until a domain is verified.
- **Table owner starting chips:** Add player credits invitees only. The owner has no starting-chip control (old assign/top-up was removed).
- **Auth identities and wallets die with the process** until Railway has `DATABASE_URL` pointed at Postgres. After that they survive redeploys. Hand photos still do not.
- **Appearance** (skin, chip-visual) is `localStorage` only.
- **Fun** is fully client-side; 8-ball is not seeded and not fair-audited (doesn’t need to be).
