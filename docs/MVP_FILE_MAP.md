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

## Active UI areas (Prompt 2)

### Shared Classic shell

- `src/ui/skins/classic/components/TableShell.tsx`
- `src/ui/skins/classic/components/PhoneShell.tsx`
- `src/ui/skins/classic/components/PhaseBar.tsx`
- `src/ui/skins/classic/components/PhaseActionDock.tsx`
- `src/ui/skins/classic/components/TableIdentity.tsx`
- `src/ui/skins/classic/tokens.css`
- `src/ui/skins/classic/layouts.css`

### Setup

- `src/ui/skins/classic/components/ClassicSetupTable.tsx`
- `src/ui/skins/classic/components/ClassicCreateTable.tsx`
- `src/ui/skins/classic/components/ClassicWaitingTable.tsx`
- `src/ui/skins/classic/components/ClassicHome.tsx`
- `e2e/setup-invite-and-restart.spec.ts`
- `e2e/welcome-home.spec.ts`

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

## Deferred areas

Do not open unless blocked:

- Poker visuals (`ClassicPokerTable` and Poker CSS) — Prompt 3
- Card Assist expansion (`CardEntryPanel` engine stays; do not surface it on the default felt)
- Countdown control redesign
- Alternative skins
- Zilch
- Historical screenshot regeneration under `docs/screenshots/`
- Non-MVP management surfaces
- Architectural cleanup, route cleanup, test-library regeneration

## Slice rule

Identify one role/phase slice. Open only the mapped files for that slice. Maximum five production files per slice unless the slice is explained first (shared chrome + Player boxes + Dealer insurance cannot be split without the layout jumping).
