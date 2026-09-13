# JetonBro progress

Agent-session memory. Update this file at the start and end of every build-order step. Do not start the next step until the current one is reviewed.

## Current

Build-order step 5 (core UI) is done and waiting for review. **Do not start step 6 until this is approved.** Step 4 is committed (`fea4fd2`).

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
| 6 | Remaining skins + chip-visual mode | not started | | |
| 7 | Fun nav (Yellow card, Red card, Magic 8-ball) | not started | | |

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

## Infrastructure

Not a requirements build-order step. Friends-only Railway deploy.

| Date | Change | Why |
| --- | --- | --- |
| 2026-09-13 | `railway.json` + `nixpacks.toml`: `npm ci && npm run build`, then `npm run start` | Auto-detect was copying `web/dist` before Vite created it. This is one root package (not workspaces); `npm run build` is `vite build` and writes `web/dist`. |
| 2026-09-13 | Single Railway service: Express serves `/api` and `web/dist` | `createApp` already static-serves `web/dist` when present. One origin, no CORS, one deploy. Two services would be extra moving parts for a v1 friends table. |
| 2026-09-13 | `DATABASE_URL` is optional; in-memory escrow if unset | Railway can attach Postgres later. The process must still boot without a DB while the store is in-memory. |
| 2026-09-13 | Pin Node 20: `engines.node` `>=20`, Nixpacks `nodejs_20` + `NIXPACKS_NODE_VERSION=20` | Railway was building on Node 18.20.5; webidl-conversions / whatwg-url require >=20. |

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
