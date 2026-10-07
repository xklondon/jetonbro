# JetonBro agent entry

JetonBro is a **virtual-jeton ledger for games played at a physical table**.

Physical cards, dealing, shuffling, randomness, player decisions, and winner determination stay **offline**. The dealer is authoritative for physical play. The **server is authoritative for balances, phases, and permissions**.

## Scope

- Responsible for: balances, locked bets, Blackjack boxes, Poker blinds/pots, phase progression, dealer-declared outcomes, ledger persistence.
- Not responsible for: digital decks, hand evaluation, automatic winners, game strategy, or payment processing.
- **Blackjack** and **Texas Hold’em** are separate domain modules. Do not fold Poker into the Blackjack engine. Zilch is deferred.

## Skin

- **Tabletop** is the default skin (`ACTIVE_SKIN_ID = "tabletop"`).
- **Classic** is registered rollback only and must not load Classic CSS into the active Tabletop bundle.

## Hard stops

- Never change accounting, phase machines, auth/identity, schema, or commands during visual-only work.
- Never push, merge, tag, migrate production data, or deploy without an **explicit** user request.
- Never invent parallel `V2` / `Fixed` / `New` implementations when a canonical component already exists.
- Never leave numbered-copy source files such as `* (1).ts` / `* (1).tsx`.

## Before work

1. Inspect current Git branch, HEAD, and status.
2. Apply the relevant `.cursor/rules/*.mdc` files (many attach by glob or description).
3. Prefer `docs/MVP_FILE_MAP.md` for which files to open first.

## Canonical detailed docs

| Doc | Use |
|---|---|
| `docs/DESIGN_AUTHORITY.md` | Visual authority order and anatomy |
| `docs/MVP_FILE_MAP.md` | Which files to open for a slice |
| `docs/IMPLEMENTATION_LOG.md` | Implementation / release history |
| `CHANGELOG.md` | Release and deployment notes |

Do not copy full game contracts into this file. Durable rules live in `.cursor/rules/`.
