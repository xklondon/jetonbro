# Admin global wipe + Dealer box rows

Date: 2026-10-07

- Branch `fix/blackjack-stable-anatomy-v1` from `fb0beae`.
- Removed Owner `DELETE ALL MY TABLES`; single admin-only `WIPE ALL TABLES` (all owners/statuses, users + personal ledger retained).
- Blackjack Dealer uses full-width `DealerLedgerRow` list in every phase (`BlackjackDealerTable`); Player BJ and Poker unchanged.
- Focused Playwright + serial wipe Vitest + full Vitest + guardrails + production build green. Not pushed / not deployed.

---

# Prompt 5 — acceptance repairs + Game Sessions

Date: 2026-10-06

- Branch `fix/rc3-live-acceptance` from SHA `9ff89cb6a2362678dc043f8e24e9dc70260d604c`.
- Migration `20261006120000_game_sessions_and_stakes`.
- Payout row, BETTING copy, Owner badges, Game Session close/open with GAME_SESSION_CLOSE/OPEN, personal ledger, admin wipe, Local Table Mode note only.
- Not pushed. Not deployed.

---

# Prompt 4 RC3 — clean release gate + Railway live acceptance

Date: 2026-10-05

- Candidate SHA: `9ff89cb6a2362678dc043f8e24e9dc70260d604c` on `fix/rc3-live-acceptance` (matches origin).
- Railway: tranquil-unity / production / JetBro II Web only — deployment `0850b377-e73a-4ef0-be83-fc008255cc23` SUCCESS / Online.
- Start command: `prisma migrate deploy && next start` → 12 migrations, no pending; Next production build Compiled; `/api/health` 200 database connected; `/api/dev/*` 404.
- Live Playwright (`e2e/prompt4-live-railway.spec.ts` @ mobile-390 against Railway): pass — Alex/Casey/Blair isolated contexts, Guest+Verified QR, Blair as Dealer (Owner retains controls; Blair `switchGame` FORBIDDEN), BJ two-box settle to 85, Poker through SHOWDOWN award + NEXT HAND rotate + SAVE TABLE.
- Screenshots: `docs/screenshots/production-live/*-390x844.png` (18 files).
- Not merged. Not tagged. Other Railway projects untouched.
- Deferred for human two-phone: side-pot smoke, BJ Double/Split/Insurance, reduced-motion, full END & DELETE phrase path. Bulk table wipe is admin-only `WIPE ALL TABLES` (not Owner DELETE ALL).

---

# Prompt 6 diagnosis — setup / Phase 0 journey

Inspected only Home, Create Table, setup routes, Phase 0/waiting, invitations, deletion, session routing, related CSS/tests at `4ad450d`, `66e6f8c`, `945ef0d`, and current `ec96aa0`.

## 1. Which component renders each failure screenshot?

| Failure | Component | Evidence |
|---|---|---|
| Rejected Home / table index (`image(3)`, oversized index `image(2)`) | `ClassicHome` | Staging `app-staging-home-390x844.png`: welcome email heading, `JOIN TABLE`, empty giant felt. Populated cards still use `.home-table-card` with duplicate `RESUME` label + button. |
| Rejected incomplete Create Table (`image(4)`) | `ClassicCreateTable` via `/tables/new` | Staging `app-staging-create-390x844.png`: name / host / starting jetons only; primary action is `CREATE TABLE`. No game, bank, invite, QR, or `START TABLE`. |
| Rejected Phase 0 (`image.png`) | `ClassicSetupTable` | Staging `app-staging-setup-390x844.png`: `TABLE SETUP` with `START BLACKJACK` / `START POKER` in `PhaseActionDock` above the felt, then a giant empty `.setup-seat` “Player / Waiting to join”. |
| Rejected unstyled Owner sheet (`image(1)`) | `ClassicSetupTable` / `ClassicHome` overflow + `SheetOverlay` | Menu and overflow actions are raw `<button>` elements. `.sheet-panel button` has no Classic gold/panel rule, so the browser paints white native controls. |

## 2. Did Prompt 4 change the setup journey?

Yes. `89db038` (`feat: simplify JetBro table setup`) cut `ClassicCreateTable` from a full game/bank/QR/email form to name + starting jetons. Confirming `CREATE TABLE` POSTed a **completed** `TABLE_SETUP` table (`setupCompletedAt` set) and jumped to `ClassicSetupTable`, where `START BLACKJACK` (`startBetting`) and `START POKER` (`switchGame`) sat in the phase dock. Prompt 4 did **not** put full configuration on Create Table and did **not** introduce a waiting Phase 0 before betting/hand start.

`4ad450d` / `66e6f8c` already used that simplified create form. `945ef0d` / `ec96aa0` only recorded the release; they did not restore the pre-`89db038` setup screen.

## 3. Duplicate Classic / non-Classic setup components?

One Classic skin. Three overlapping screens:

- `ClassicCreateTable` — incomplete first form (`/tables/new`)
- `ClassicSetupTable` — post-create felt used as both config and start-game
- `ClassicWaitingTable` — thin player waiting copy; almost unused for owners

Backend already had `ensureDraftTable` / `finalizeSetup` / `setupCompleted`; the UI never used them as Home → full setup → `START TABLE` → Phase 0.

## 4. Is the correct component present but routed incorrectly?

Partially. `SetupTableView` already carries game options, bank mode, join URL, members, `canStartBetting`, `setupCompleted`, and `emailConfigured`. `TableSession` always renders `ClassicSetupTable` whenever `snapshot.setup` is set, including incomplete drafts and completed waiting. `ClassicCreateTable` is only mounted on `/tables/new`. The waiting/Phase 0 component exists as `ClassicWaitingTable` but is not the owner Phase 0 screen.

## 5. Why are Owner-sheet buttons raw white browser buttons?

Owner menu buttons in `ClassicSetupTable` and several overflow actions omit `.gold-button`. There is no `.sheet-panel > button` Classic rule, so they inherit the user-agent stylesheet.

## 6. Why does Phase 0 contain a giant empty placeholder?

`ClassicSetupTable` always renders a `.setup-seat` box. With zero players it fabricates `data-seat-status="empty"` (“Player / Waiting to join”). CSS sets `.setup-seat` to 96px tall and `.setup-seats.one .setup-seat` to 220px wide, which reads as a giant empty card.

## 7. Why are Start Blackjack/Poker controls shown before the setup content?

Prompt 4 placed them in `PhaseActionDock` inside `PhaseBar`, which is grid row 2 of the phone shell, **above** `main.felt`. Game selection is not on the create screen; start-game controls are the first actions the owner sees.

## Repair

Reuse `POST /api/tables { draft: true }` / `ensureDraftTable` and `finalizeSetup` as `START TABLE`. Keep the user on one Create Table screen. After `START TABLE`, route completed `TABLE_SETUP` (and Poker `POKER_SETUP` while the Blackjack phase is still `TABLE_SETUP`) to a compact Phase 0 waiting table whose primary actions are `OPEN BETTING` / `START HAND`. Stop routing owners to `ClassicSetupTable`’s giant seat + start-game dock.

## Follow-up: Poker snapshot stripped setup

`loadSnapshot` built a `setup` object whenever `currentPhase === TABLE_SETUP`, then returned `setup: blackjack ? setup : null`. After `START TABLE` with Poker, Phase 0 therefore fell through to `PokerDealer` (`POKER SETUP` streets + chip rail) with no join URL. Repair: keep `setup` / `waiting` on Poker tables while they remain in `TABLE_SETUP`. Switching from a live Blackjack table still has `currentPhase !== TABLE_SETUP`, so existing Poker Dealer `POKER_SETUP` screens stay unchanged.
