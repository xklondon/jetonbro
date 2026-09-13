# JetonBro progress

Agent-session memory. Update this file at the start and end of every build-order step. Do not start the next step until the current one is reviewed.

## Current

Build-order step 4 (auth / invite) is done and waiting for review. **Do not start step 5 until this is approved.**

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
| 5 | Core UI (stack/pot, phase actions, Simple, Standings) | not started | | |
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
| 2026-09-13 | **Blackjack box-ownership enforcement is still open.** Step 4 did not resolve it. Address it in step 5 when box entities are introduced — not via the turn pointer. | Flagged again so it is not forgotten between invite work and core UI. |
| 2026-09-13 | WhatsApp invite is the same magic-link/verify pair as email; the only extra is a `wa.me/?text=` share URL | Requirements: different channel, not a second auth path. |
| 2026-09-13 | Mates guest user id is `guest:${deviceId}`; upgrade calls `EscrowService.reownMasterWallet` and never `ensureMasterWallet` on the verified id first | Wallet writes stay in `src/escrow/`. Creating the verified wallet first would hide a duplicate-wallet bug. |
| 2026-09-13 | Failed T&Cs on `GET /api/auth/verify` does not consume the magic link | Otherwise a share tap without the checkbox would burn the invite. |
| 2026-09-13 | REST identities are registered only in `src/http/registerRoutes.ts` with full paths on `app` | `scripts/check-routes.sh` extracts `app\|router.(get\|post\|…)` and matches the Identity column. First real exercise: clean pass → throwaway duplicate `POST /api/auth/request-magic-link` failed as designed → throwaway removed → pass. |

## Blocked

None.

## Step 4 PR questions

1. **Extend or new?** Extends `src/escrow/` with `listWallets` / `listMasterWallets` / `reownMasterWallet`. New: `src/auth/` (identity, invites, sessions) and `src/http/` (Express app + the single route registry).
2. **Route / event / action?** Yes — eight REST identities, all added to `docs/ROUTE_MANIFEST.md` in this step. Registered only in `src/http/registerRoutes.ts`. No socket events.
3. **Wallet / ledger writes?** Only through `EscrowService` (`ensureMasterWallet` on create, `reownMasterWallet` on guest upgrade). Auth never writes wallet rows.
4. **Card / dice / hand-eval?** No.
5. **Per-game branches?** No. Invite channels are config on the invite record, not protocol code.
