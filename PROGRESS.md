# JetonBro progress

Agent-session memory. Update this file at the start and end of every build-order step. Do not start the next step until the current one is reviewed.

## Current

Steps 1–3 (clean state, `.cursorrules`, guardrails) are ready for review. **Do not start build-order step 1 (wallet + escrow engine) until this is approved.**

## Guardrails (genesis Steps 1–3)

| Date | Status | Summary |
| --- | --- | --- |
| 2026-09-13 | done | Confirmed repo root has only `jetonbro-requirements-v4.md` as a requirements doc. No superseded v1/v2/v3 plan/scope files. No `AUDIT.md` to relocate. Added `.cursorrules`, `docs/ROUTE_MANIFEST.md`, `scripts/check-routes.sh`, CI workflow, this file. |

## Build order

From `jetonbro-requirements-v4.md` § Build order. One step at a time; stop after each for review.

| Step | Name | Status | Date | Summary / PR |
| --- | --- | --- | --- | --- |
| 1 | Wallet + escrow engine, unit-testable, no UI | not started | | |
| 2 | Protocol configs + turn-order, wired to escrow | not started | | |
| 3 | Personal ledger read-model (Save / Clear) | not started | | |
| 4 | Auth / invite (magic-link, WhatsApp, QR, Mates) | not started | | |
| 5 | Core UI (stack/pot, phase actions, Simple, Standings) | not started | | |
| 6 | Remaining skins + chip-visual mode | not started | | |
| 7 | Fun nav (Yellow card, Red card, Magic 8-ball) | not started | | |

## Decisions log

Assumptions not spelled out in `jetonbro-requirements-v4.md`. Flag these; do not bury them only in code comments.

| Date | Decision | Justification |
| --- | --- | --- |
| 2026-09-13 | CI wallet/ledger write-guard treats `src/escrow/` as the single allowed mutation module | Requirements say one service mutates wallet/ledger rows but do not name a path. The directory is reserved in `scripts/check-routes.sh` only — the module is not created until build-order step 1. |
| 2026-09-13 | `scripts/check-routes.sh` is wired via `.github/workflows/ci.yml` | Genesis prompt asked to wire the check into CI while the codebase is still empty. |

## Blocked

None.
