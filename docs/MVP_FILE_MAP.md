# JetBro II MVP file map

Read this before searching the repository. Open only the slice you are changing. Frozen files stay frozen unless a failing acceptance step proves an engine defect.

## Frozen engine areas

Do not edit these unless a failing acceptance test proves a defect in ledger, phase, permission, or persistence.

### Ledger / accounting / balances

- `src/application/services/blackjack-round.ts` (settlement and Insurance accounting)
- `src/application/services/poker-hand.ts`
- `src/domain/blackjack/`
- `src/domain/poker/`
- `src/domain/ledger/` (if present)
- Prisma schema and migrations under `prisma/`

### Blackjack and Poker state transitions

- `src/application/services/tables.ts`
- `src/application/services/blackjack-round.ts`
- `src/application/services/poker-hand.ts`
- `src/application/queries/snapshot.ts`
- `src/application/queries/views.ts` (shape of engine-backed views)

### Idempotency / persistence / auth / invitations

- `src/application/services/invitations.ts`
- `src/app/api/` command and auth routes
- Auth.js configuration and session helpers

Related unit tests under `src/application/` and `src/domain/` prove these files. Do not regenerate that library.

## Active UI areas (Prompt 3)

### Poker screens

- `src/ui/skins/classic/components/ClassicPokerDealer.tsx`
- `src/ui/skins/classic/components/ClassicPokerPlayer.tsx`
- `src/ui/skins/classic/components/PokerFelt.tsx`
- `src/ui/skins/classic/components/PokerGameControls.tsx`
- `src/ui/skins/classic/components/PokerStreetRail.tsx`
- `src/application/queries/poker-controls.ts` (presentation labels/surfaces only)
- `src/ui/core/PokerTable.test.tsx`
- `e2e/poker-and-betting.spec.ts`
- `e2e/poker-turn-and-tray.spec.ts`
- `e2e/poker-two-device-protocol.spec.ts`
- `e2e/poker-two-hand-protocol.spec.ts`

Poker reducer, ledger, blinds, pots, settlement, and `poker-snapshot.ts` stay frozen unless a required acceptance step fails.

## Active UI areas (Prompt 2)

### Shared Classic shell

- `src/ui/skins/classic/components/TableShell.tsx`
- `src/ui/skins/classic/components/PhoneShell.tsx`
- `src/ui/skins/classic/components/PhaseBar.tsx`
- `src/ui/skins/classic/components/PhaseActionDock.tsx`
- `src/ui/skins/classic/components/TableIdentity.tsx`
- `src/ui/skins/classic/tokens.css`
- `src/ui/skins/classic/layouts.css`

### Setup / Home / Phase 0 (Prompt 6)

- `src/ui/skins/classic/components/ClassicHome.tsx`
- `src/ui/skins/classic/components/ClassicCreateTable.tsx`
- `src/ui/skins/classic/components/ClassicPhaseZero.tsx`
- `src/ui/skins/classic/components/ClassicInvitePanel.tsx`
- `src/ui/skins/classic/components/ClassicSetupTable.tsx` (adapter: incomplete → Create Table, completed → Phase 0)
- `src/ui/skins/classic/components/ClassicWaitingTable.tsx` (player Phase 0)
- `src/ui/core/TableSession.tsx`
- `src/app/tables/new/page.tsx` (creates/reuses a draft and redirects to `/tables/{id}`)
- `src/app/tables/new/create-table-client.tsx` **inactive** (no longer routed)
- `e2e/setup-phase-zero.spec.ts`
- `e2e/setup-invite-and-restart.spec.ts`
- `e2e/welcome-home.spec.ts`
- `e2e/home-delete.spec.ts`
- `e2e/helpers.ts`

`ClassicSetupTable` is no longer a giant felt with `START BLACKJACK` / `START POKER` in the phase dock. Do not route owners to that obsolete layout.

### Blackjack Player screens

- `src/ui/skins/classic/components/ClassicPlayerTable.tsx`
- `src/ui/skins/classic/components/FeltBox.tsx`
- `src/ui/skins/classic/components/BlackjackBox.tsx`
- `src/ui/core/PlayerTable.test.tsx`

### Blackjack Dealer screens

- `src/ui/skins/classic/components/ClassicBankTable.tsx`
- `src/ui/skins/classic/components/DealerBlackjackBoxRow.tsx`
- `src/ui/skins/classic/components/DealerHandBox.tsx`
- `src/ui/skins/classic/components/PlayerRow.tsx`
- `src/ui/skins/classic/components/DealerRow.tsx`
- `src/ui/core/BankTable.test.tsx`

### Jeton tray

- `src/ui/skins/classic/components/JetonTray.tsx`
- `src/ui/skins/classic/components/PlayerWallet.tsx`

### Relevant E2E

- `e2e/blackjack-complete-round.spec.ts`
- `e2e/blackjack-flow.spec.ts`
- `e2e/blackjack-payout-rail.spec.ts`
- `e2e/blackjack-box-nav.spec.ts`
- `e2e/dealer-payout-close.spec.ts`
- `e2e/two-device-betting.spec.ts`
- `e2e/two-round-phase-sequence.spec.ts`
- `e2e/table-start-countdown.spec.ts`
- `e2e/cards-and-limited-bank.spec.ts` (hiding Card Assist / Limited Bank menu only)
- `e2e/acceptance-screenshots.spec.ts`
- `e2e/helpers.ts`

## Active UI areas (Prompt 4)

### Product lifecycle / Owner administration / Home

- `src/ui/skins/classic/components/ClassicHome.tsx`
- `src/ui/skins/classic/components/ClassicSetupTable.tsx`
- `src/ui/skins/classic/components/ClassicBankTable.tsx`
- `src/ui/skins/classic/components/ClassicPlayerTable.tsx`
- `src/ui/skins/classic/components/ClassicPokerDealer.tsx`
- `src/ui/skins/classic/components/SheetOverlay.tsx`
- `src/application/services/invitations.ts` (local name-only add; email path unchanged)
- `src/application/services/tables.ts` (owner rename via `updateTableSettings`; `assignBankDealer` owner-only)
- `e2e/release-lifecycle.spec.ts`
- `e2e/home-delete.spec.ts`
- `e2e/welcome-home.spec.ts`

This slice is larger than five files because Home, Setup, Owner menus on every table surface, invitations, and persistence share one lifecycle. Do not treat that as a licence to edit frozen Blackjack/Poker accounting.

## Active packaging (Prompt 5)

- `.dockerignore` must keep `.cursorfile`, `CHANGELOG.md`, and `docs/architecture/CURSOR_GUARDRAILS.md` in the Railway image because `prebuild` runs guardrails. `e2e/` and screenshot docs stay excluded.
- `src/application/packaging.test.ts`
- `e2e/staging-release.spec.ts` (runs only when `PLAYWRIGHT_BASE_URL` is the Railway origin)

## Deferred areas

Do not open unless blocked:

- Card Assist expansion (`CardEntryPanel` engine stays; do not surface it on the default felt)
- Countdown control redesign
- Alternative skins
- Zilch
- Historical screenshot regeneration under `docs/screenshots/`
- Non-MVP management surfaces
- Architectural cleanup, route cleanup, test-library regeneration

## Slice rule

Identify one role/phase slice. Open only the mapped files for that slice. Maximum five production files per slice unless the slice is explained first (shared chrome + Player boxes + Dealer insurance cannot be split without the layout jumping).
