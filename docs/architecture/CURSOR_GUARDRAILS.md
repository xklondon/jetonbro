# Cursor bootstrap guardrails

Canonical agent instructions:

1. Root `AGENTS.md`
2. Scoped rules in `.cursor/rules/*.mdc` (permanent invariants in `00-core-product.mdc`)
3. Compatibility pointer `.cursorfile` (must remain present and non-empty for existing guardrails/Docker)
4. Detailed docs: `docs/DESIGN_AUTHORITY.md`, `docs/MVP_FILE_MAP.md`, `docs/IMPLEMENTATION_LOG.md`, `CHANGELOG.md`

Do not treat `.cursorfile` as a second full contract. After accepted architectural changes, update the applicable `.mdc` rule and/or docs — not a monolithic copy in `.cursorfile`.

## Repository requirements

- Keep `AGENTS.md`, `.cursorfile`, and `.cursor/rules/*.mdc` version-controlled.
- Add a test or CI check that fails if `.cursorfile` is missing (existing guardrails).
- Add `npm run guardrails` to validate required project files, prohibited dependencies, and architectural boundaries.
- Run `npm run guardrails` before tests and build in CI.
- Keep Classic as a replaceable rollback skin, not a fork of the application. Tabletop is the default skin.
- Required structure includes `src/domain/poker/` for Texas Hold’em.
- No new game, action, balance mutation, phase, or payout type may be added without updating the applicable scoped rule (and docs when release status changes).

## Required initial structure

```text
AGENTS.md
.cursorfile
.cursor/rules/
CHANGELOG.md
docs/architecture/
design/reference/classic/
src/domain/blackjack/
src/domain/ledger/
src/domain/tables/
src/ui/core/
src/ui/skins/classic/
src/ui/skins/tabletop/
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
- Blackjack and Texas Hold’em are the enabled game identifiers. Zilch remains coming later.
- Tests and build cannot run in CI until the guardrail check passes.
