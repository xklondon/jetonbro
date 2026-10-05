# JetBro II design authority

Documentation only. These boards and rules control presentation. They do not change ledger, phase, permission, or payout behaviour.

## Authority order

1. Original approved PNGs under `design/reference/classic/approved/`
2. Product phase / control / role contracts (`blackjack-phase-controls`, snapshots, permissions)
3. Tabletop implementation (`src/ui/skins/tabletop/`)
4. `design/reference/classic/jetonbro-player-bank-insurance.html` — secondary token colour reference only
5. Historical screenshots, compressed JPG copies, and FAIL images — never design authority

Default production skin is **Tabletop** (`ACTIVE_SKIN_ID = "tabletop"`). Classic remains registered only as rollback and must not load Classic CSS into Tabletop screens.

## Valid boards (primary)

| Approved file | Role | SHA-256 |
|---|---|---|
| `ChatGPT Image Sep 22, 2026, 12_50_26 PM (1)(2).png` | Blackjack Player phases | `9d53d58afcb294b5626abdbf6eb3739cfd6aad702ab0a607aa270b3707c5ed2e` |
| `ChatGPT Image Sep 22, 2026, 12_50_27 PM (2)(2).png` | Home, Create Table, Table Setup, Game Selection | `2ffa477db6ac46bae88c5abb3e43ac7c28b39e7aae753e2287d3e969fd3ba1ea` |
| `ChatGPT Image Sep 22, 2026, 12_50_27 PM (3)(2).png` | Blackjack Dealer/Owner phases | `c401ddec54e305d60bcb4f6ce025f635afb184a405893e5f5bc69cb5f326c5d1` |

Verified aliases (identical SHA): `blackjack-player-phases.png`, `table-owner-setup.png`, `blackjack-dealer-owner-phases.png`.

Do not use as primary references: `design/reference/tabletop/approved/*.jpg`, `docs/design-reference/*.jpg`, `fail-*.png`, implementation screenshots, or the HTML prototype for layout.

Documented phone-panel crops for comparison live under `docs/screenshots/tabletop/approved-crops/` (extracted from the 1024×554 sheets; each panel ~256×554, scaled proportionally to 390×844).

## Blackjack PNG composition (literal)

The supplied PNG screens are literal composition specifications for visual anatomy, shapes, typography, palette, density and component appearance.

Game state determines which information and legal actions exist. The PNG determines how those elements are visually arranged.

Existing JSX, CSS, component anatomy, selectors and tests have no visual authority when they conflict with the PNGs.

Blackjack presentation markup may be replaced completely without changing game logic, commands, handlers, accounting, permissions or snapshots.

Where live product content differs from a mock (balances, names, seat count, product command labels), keep the product data and place it in the closest visual slot. Do not invent an alternative layout system. Do not treat the PNGs as loose inspiration.

The Dealer PNG layout must be implemented as a dense ledger/row composition. Do not invent kidney plaques, spatial capsules, or giant empty felt bands.

Player boxes follow the visual arrangement in the Player PNG. Stable `data-box-id` targeting is required. Do not require a fixed three-column CSS grid or `data-arc`.

A screen passes only when it is both **SPEC CORRECT** (role, phase, commands, privacy, real box count) and faithful to the PNG anatomy (typography, density, hierarchy, palette, shapes). Spec-mandated content differences from a static mock are not visual failures by themselves.

`blackjack-phase-controls.ts` controls which buttons exist, enabled state, command semantics, and accepted labels (`START BETTING`, `DEAL CARDS`, `ENTER PAYOUT`, `ADD PLAYER`, `INS WON` / `INS LOST`). Product labels replace obsolete mock wording (`OPEN BETTING`, `CLOSE BETTING`, `START NEXT ROUND`) in the same visual slots.

## Reference-to-component mapping (Tabletop)

| Board region | Tabletop primitive |
|---|---|
| Phone chrome, header, menu, badges/balance | `Shell` / `TableSurface` |
| Structural curved gold rail | `TableRail` |
| Compact phase / status | `PhaseDisplay` |
| Cloth table name | `TableName` |
| Layered jetons | `Jeton` / `ChipStack` |
| Canonical controls | `TableButton` |
| Player box | `PlayerBox` |
| Dealer ledger | `DealerLedger` / `DealerLedgerRow` |
| Payout result keys | `ResultControls` |
| Bottom Dealer dock | `ActionDock` |
| Player tray | `JetonTray` |

FAIL evidence only (not design references):

- `docs/design-reference/fail-home-empty.png`
- `docs/design-reference/fail-create-table-incomplete.png`
- `docs/design-reference/fail-phase-zero-placeholder.png`

## Home / Create Table / Phase 0

Dominant board: `12_50_27 PM (2)(2)` / `table-owner-setup.png`.

Canonical journey:

```text
HOME / TABLE INDEX
    → CREATE TABLE (complete setup on this screen, including invitations)
    → START TABLE
    → PHASE 0 waiting table
    → START BETTING / START HAND when legal
    → existing Blackjack or Poker phase screens
```

There is no second configuration screen after `START TABLE`. Create Table remains the current one-screen functional journey. Invitations remain functional. Do not recreate obsolete mock navigation.

Phase 0 reuses the shared Dealer dock (`START BETTING | ADD PLAYER` or `START HAND | ADD PLAYER`). A seated Player sees the Player waiting board with their wallet, not Dealer controls.

## Behaviour versus presentation

### Behaviour (not the boards)

```text
Existing verified JetBro II engine
→ written game specification
→ acceptance tests
```

### Presentation

```text
Original approved PNG boards
→ Tabletop primitives
→ live product data in those slots
```

Boards control screen anatomy, element position, hierarchy, density, palette, Player and Dealer rows, box appearance, action placement, jeton construction, spacing, and typography.

Do not reproduce generated-image mistakes (fake USD, invented names, duplicate table titles, made-up payout math, fabricated six-player rows).

The live table name appears exactly once on the felt (`TableName` / `data-table-name`), integrated into the table—not a giant page heading. No ornamental outline/emboss fonts. Header has menu plus role/balance only.

## Seven-zone mobile grid (390×844)

Maximum game width approximately 480px. Minimum touch target 44px. At 360×800, 390×844 and 430×932 the table occupies `100dvh`. The document must not scroll. Only the Dealer Player/box list may scroll internally when needed. Header, phase actions and Player tray stay fixed.

1. Compact app header
2. Phase / status
3. Dealer summary (Dealer boards)
4. Felt and table identity
5. Players / boxes / ledger
6. Current controls
7. Fixed jeton tray (Player) or Dealer dock (Dealer)

## Shared colour and type (Tabletop tokens)

Canonical values live in `src/ui/skins/tabletop/tabletop.css` token section. HTML prototype colours may inform hex values only.

| Token role | Use |
|---|---|
| Felt / emerald | Designed cloth surface (not hatch wallpaper) |
| Night / surround | Outer frame |
| Gold / gold-hi | Metal accents, primary actions |
| Ivory / cream | Primary type |
| Display serif | Table name, phase titles |
| Interface sans | Controls, ledger, badges |

## Screen routing (`selectTableBoard`)

Unchanged. Never infer role from name, email, or a leftover Auth.js session. Guest cookie wins on the invited table. A seated non-Dealer Player never receives the Dealer board.

## Blackjack Player screen contract

Dominant board: Player PNG. Reproduce that composition: header chrome, phase display, dealer mark, owned boxes at the board’s size and grouping, contextual ADD BOX / Insurance, action row, fixed tray with layered jetons.

Visible controls follow `blackjackPlayerControls()`.

## Blackjack Dealer / Owner screen contract

Dominant board: Dealer/Owner PNG. Implement dense row composition for **actual** Players and boxes. Compact Dealer status/summary. Bottom product dock:

```text
TABLE_SETUP: START BETTING | ADD PLAYER
BETTING:     DEAL CARDS | ADD PLAYER
PLAYING:     ENTER PAYOUT | OPEN INSURANCE
INSURANCE:   ENTER PAYOUT | CLOSE INSURANCE
PAYOUT:      START BETTING (full width; disabled until resolved)
```

## Poker

Poker boards under `docs/design-reference/poker-*.jpg` / `design/reference/tabletop/approved/poker-*.jpg` remain historical copies when the original `12_50_27 PM (5)` file is unavailable. Use the same Tabletop palette, rail, jetons and button primitives. Do not invent a second skin.

## Must never appear

- Kidney / spatial Dealer plaques as the finished Dealer board
- Dashed-circle chips as the finished jeton
- Repeated diamond-hatch wallpaper felt
- 2px decorative ellipse as the finished rail
- Giant empty felt caused by top-clustered content
- Table name as a page heading / embossed outline display
- Duplicate table name in the header
- Fabricated other-Player data on Player boards
- Classic CSS or Classic class names in the Tabletop bundle
- Owner-selectable visual templates / additional skins
