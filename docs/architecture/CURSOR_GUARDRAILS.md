# Cursor bootstrap guardrails

Add the following instruction to Cursor project rules as the first mandatory rule:

> Before planning, editing, running commands, or responding to any implementation request, read the root `.cursorfile` completely. Treat it as the repository's living operating contract. After each accepted change, update `.cursorfile` whenever architecture, invariants, state transitions, accounting, permissions, deployment commands, or implementation status changed. Never bypass or silently contradict it.

## Repository requirements

- Commit `.cursorfile` at repository root in the first commit.
- Add a test or CI check that fails if `.cursorfile` is missing.
- Add `npm run guardrails` to validate required project files, prohibited dependencies, and architectural boundaries.
- Run `npm run guardrails` before tests and build in CI.
- Keep `classic` as a replaceable visual skin, not a fork of the application.
- Domain services and tests must run without importing any skin.
- No new game, action, balance mutation, phase, or payout type may be added without updating `.cursorfile` first.

## Required initial structure

```text
.cursorfile
CHANGELOG.md
docs/architecture/
design/reference/classic/
src/domain/blackjack/
src/domain/ledger/
src/domain/tables/
src/ui/core/
src/ui/skins/classic/
src/ui/skins/registry.ts
scripts/check-guardrails.mjs
```

## Initial automated guardrails

The first implementation slice must verify:

- `.cursorfile` exists and is non-empty.
- The Classic reference directory exists.
- Domain files do not import `src/ui/skins/`.
- UI skin files do not import database access directly.
- No payment, crypto, card-dealing, RNG, or hand-evaluation package is introduced.
- Blackjack is the only enabled game identifier.
- Tests and build cannot run in CI until the guardrail check passes.
