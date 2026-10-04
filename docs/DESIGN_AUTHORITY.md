# JetBro II design authority

Documentation only. These boards and rules control presentation. They do not change ledger, phase, permission, or payout behaviour.

## Valid boards

Default production skin is **Tabletop** (`src/ui/skins/tabletop/`, `ACTIVE_SKIN_ID = "tabletop"`). Classic remains registered only as rollback and must not load into Tabletop screens.

Primary visual authority for Tabletop is the approved PNG set under `design/reference/classic/approved/` plus `design/reference/classic/jetonbro-player-bank-insurance.html`. Those files outrank historical HTML prototypes, existing Classic CSS, previously generated screenshots, and Classic component anatomy.

| Approved file | Role |
|---|---|
| `ChatGPT Image Sep 22, 2026, 12_50_26 PM (1)(2).png` | Blackjack Player phases |
| `ChatGPT Image Sep 22, 2026, 12_50_27 PM (2)(2).png` | Home, Create Table, Table Setup, Game Selection |
| `ChatGPT Image Sep 22, 2026, 12_50_27 PM (3)(2).png` | Blackjack Dealer/Owner phases |

Aliases: `blackjack-player-phases.png`, `table-owner-setup.png`, `blackjack-dealer-owner-phases.png`. Historical copies under `docs/design-reference/` remain for Poker boards only.

## Blackjack PNG composition (literal)

The supplied PNG screens are literal composition specifications.

Game state determines which information and legal actions exist. The PNG determines how those elements are visually arranged.

Existing JSX, CSS, component anatomy, selectors and tests have no visual authority.

Blackjack presentation markup may be replaced completely without changing game logic, commands, handlers, accounting, permissions or snapshots.

Where live product content differs from a mock, preserve the closest visual composition and substitute the real content. Do not invent an alternative layout system.

The Dealer PNG layout must be implemented visually. It may look tabular, but it must use the typography, spacing, borders, hierarchy and density of the supplied design rather than invented plaques.

Player boxes follow the visual arrangement in the supplied board. Stable identity and correct command targeting are required, but the previous fixed three-column CSS grid is not a visual requirement.

The specification and live state control which screens exist, which Players and balances each role may see, how many boxes a Player owns, legal actions, the one-screen setup journey, commands, and labels.

Do not mark a screen a visual failure merely because:

- the fixture has 4 Players while the board illustrates 6;
- a Player snapshot intentionally does not expose other Players;
- a Player legitimately owns multiple boxes;
- the current one-screen setup replaces obsolete mock screens;
- obsolete bottom navigation was not copied;
- the specification requires an Amount field.

A screen passes only when it is both **SPEC CORRECT** (role, phase, commands, privacy, box count) and **VISUAL MATCH** (typography, density, hierarchy, balance, positioning, component styling). A spec-mandated content difference from a static mock is not a visual failure by itself.

`blackjack-phase-controls.ts` still controls which buttons exist, enabled state, command semantics, and accepted labels (`START BETTING`, `DEAL CARDS`, `ENTER PAYOUT`, `ADD PLAYER`, `INS WON` / `INS LOST`). Do not restore obsolete board wording (`OPEN BETTING`, `CLOSE BETTING`, `START NEXT ROUND`, `START ADDITIONAL BOX`).

Implement the Dealer PNG row composition. Do not invent plaque/capsule alternatives. Product labels (`START BETTING`, `DEAL CARDS`, `ENTER PAYOUT`) replace obsolete mock wording (`OPEN BETTING`, `CLOSE BETTING`, `START NEXT ROUND`) in the same visual slots.

## Reference-to-component mapping

| Board region | Component / slot |
|---|---|
| Phone chrome, 56–64px header, menu + badges/balance only | `PhoneShell` / `TableShell` |
| Table name in header on Blackjack PNGs | `TableShell` `title` |
| Compact phase title + one instruction | `.bj-phase` on Blackjack; `PhaseBar` elsewhere |
| Shared Dealer 65/35 bottom dock | `DealerActionDock` |
| Dealer insurance toggle | footer `.dealer-secondary-action` + `blackjackDealerControls().insurance` |
| Dealer betting rows | `DealerBlackjackBoxRow` inside `.bj-ledger` |
| Dealer primary (`START BETTING` / `DEAL CARDS` / `ENTER PAYOUT`) | footer `.dealer-primary` (65%) |
| Dealer secondary (`ADD PLAYER` / insurance) | footer `.dealer-secondary-action` (35%), invitation mask unchanged |
| Player dealer mark | `.bj-dealer-spot` |
| Player boxes | `BlackjackBox` / `FeltBox` in `.bj-boxes` |
| Player contextual panel (ADD BOX / Insurance) | `.bj-context` |
| Player action row above tray | `.game-controls` |
| Player tray | `PlayerWallet` / `JetonTray` |
| Home cards / Create Table / Phase 0 list | `ClassicHome`, `ClassicCreateTable`, `ClassicPhaseZero` |

FAIL evidence (not design references):

- `docs/design-reference/fail-home-empty.png`
- `docs/design-reference/fail-create-table-incomplete.png`
- `docs/design-reference/fail-phase-zero-placeholder.png`

## Home / Create Table / Phase 0 (Prompt 6)

Dominant board: Table Owner and Setup (`12_50_27 PM (2)` / `table-owner-setup.jpg`).

Canonical journey:

```text
HOME / TABLE INDEX
    → CREATE TABLE (complete setup on this screen, including invitations)
    → START TABLE
    → PHASE 0 waiting table
    → START BETTING / START HAND when legal
    → existing Blackjack or Poker phase screens
```

There is no second configuration screen after `START TABLE`. There is no later game-selection journey. Draft persistence for QR/email is internal; the owner stays on Create Table until `START TABLE`.

### Saved Tables / Home

Compact JetonBro header. `CREATE TABLE`. Compact saved-table cards: name, selected game, phase/status, player count, Owner/Dealer, `RESUME`, owner overflow. Owner-only `DELETE` (empty draft) or `CLOSE TABLE` (archive). No duplicate Resume label, no giant cards, no raw browser controls, no History. Join-by-code is not a second primary Home action.

### Create Table

One compact 390×844 screen that does not scroll the phone frame: table name and starting jetons, Owner identity, Blackjack/Poker segmented selector (Zilch as a coming-later note), Open/Limited Bank with Limited reserve only when Limited is selected, Poker blinds only when Poker is selected, Dealer, compact Player rows, inline Guest / Verified / Email invitation expanders, primary `START TABLE`. After `START TABLE`, Phase 0 uses `ADD PLAYER` to open the invitation dialog.

### Phase 0

The created table waiting for Players — not the setup form. Compact Player names on felt, not metadata under the table name. No giant empty placeholder. Compact `Table setup` for Dealer/Owner and `Waiting for the table to open betting.` for a seated Player. Never show `Waiting for players` merely because one Player is present. Blackjack `START BETTING` (`startBetting`) is Dealer-only and enabled only when a real seated Player exists. Poker `START HAND` follows existing `pokerControls()` / command legality. Phase 0 reuses the shared 65/35 `DealerActionDock` (`START BETTING | ADD PLAYER` or `START HAND | ADD PLAYER`). `ADD PLAYER` opens the same invitation mask used on Create Table. A seated Player sees the Player waiting board with their wallet, not Dealer controls. An Owner who assigned the Bank to someone else still sees the Owner Phase 0 board.

## Behaviour versus presentation

### Behaviour (not the boards)

```text
Existing verified JetBro II engine
→ written game specification
→ acceptance tests
```

Boards do not control example balances, generated names, payout arithmetic, legal actions, phase transitions, or permissions.

### Presentation

```text
Attached design boards
→ shared fixed-grid rules
→ existing JetBro II Classic assets
→ developer interpretation
```

Boards control screen anatomy, element position, hierarchy, density, the green/gold/ivory/black palette, Player and Dealer rows, Blackjack box appearance, action placement, the fixed jeton tray, spacing, and typography.

Do not reproduce generated-image mistakes (fake USD, invented names, duplicate table titles, made-up payout math).

The live table name appears exactly once on the felt (`ClothName` / `data-table-name`), 12–18px below the compact phase heading. It is a printed cloth mark: Georgia 15–20px, cream/antique-gold at restrained opacity, one line with ellipsis. No ornamental rules, dots, metadata, subtitle, panel, or header title. The header has menu plus role/balance only. Phase copy is compact Inter in the phase rail: Dealer `Table setup` / `Betting open`; Player `Waiting for the table to open betting.` / `Betting is open.` Never use a giant `WAITING FOR PLAYERS` heading.

## Seven-zone mobile grid (390×844)

Maximum game width approximately 480px. Minimum touch target 44px. At 360×800, 390×844 and 430×932 the table occupies `100dvh`. The document must not scroll (`scrollHeight <= innerHeight + 2`, `scrollWidth <= clientWidth + 2`). Only the Dealer Player/box list may scroll internally, with hidden scrollbars. Header, phase actions and Player tray stay fixed. The tray never covers controls.

1. Compact app header
2. Phase header
3. Dealer phase action (Owner/Dealer only; Players omit this row)
4. Felt and table identity
5. Players and Blackjack boxes
6. Current Blackjack controls
7. Fixed jeton tray (Player) or anchored Dealer primary action (Dealer)

Phase lives in the compact phase rail. Player available balance appears at the header right and with the tray. Player actions sit directly above the tray. Dealer round-progression primary is anchored at the bottom. There is no PLAYERS / BOXES / ON TABLE footer. Bank reserve lives in the table menu. Dealer identity, column labels, and row density follow the Dealer PNG.

## Shared colour and type

Classic tokens already match the boards. Canonical values live in `src/ui/skins/classic/tokens.css`. CSS ownership: `tokens.css` tokens only; `blackjack-classic.css` Blackjack Dealer/Player composition; `board.css` shared shell; `layouts.css` responsive grids; `home.css` Home and Create Table only. Do not layer obsolete Blackjack rules under the canonical Blackjack sheet.

| Token | Role |
|---|---|
| `--felt` / `--felt-deep` / `--emerald` | casino felt |
| `--panel` / `--control-surface` / `--dock` | deep black-green surfaces |
| `--gold` / `--gold-hi` / `--gold-dim` | restrained metal |
| `--ivory` / `--cream` | primary type |
| `--muted` | secondary type |
| `--gold-line` | borders |
| `--radius` / `--radius-card` | radii |
| `--shadow` | elevation |
| `--font-display` / `--title-size` | display headings |
| `--font-ui` / `--label-size` / `--body-size` | operational labels |
| `--space-1`…`--space-4` | compact spacing |
| `--control-height` (44px) | interactive targets |
| `--tray-height` | fixed Player tray |

Shared components: `TableShell`, `PhaseBar`, `PhaseActionDock`, `TableIdentity`, `SheetOverlay`, `ClassicInviteMask`, `PlayerWallet` / `JetonTray`. Create Table, Phase 0 and Dealer Betting reuse one invitation mask.

Visible Blackjack controls are derived from `src/ui/core/blackjack-phase-controls.ts` (`blackjackDealerControls` / `blackjackPlayerControls` / `playerBoxSlots`). Engine command ids are unchanged. Presentation labels override snapshot strings `CLOSE BETTING` and `START NEXT ROUND`. Do not scatter phase conditions across Player and Dealer JSX.

## Screen routing (`selectTableBoard`)

| Viewer | Blackjack TABLE_SETUP | Blackjack live | Poker with `setup` | Poker live / switch |
|---|---|---|---|---|
| Owner, setup not completed | CREATE_TABLE | — | CREATE_TABLE | — |
| Owner or Dealer | PHASE_ZERO_DEALER | Dealer board if `isDealer`, else Player if seated | PHASE_ZERO_DEALER | POKER_DEALER if Owner |
| Seated Player, not Owner/Dealer | PHASE_ZERO_PLAYER | BLACKJACK_PLAYER | PHASE_ZERO_PLAYER | POKER_PLAYER |
| Dealer who is also seated | PHASE_ZERO_DEALER | BLACKJACK_DEALER (primary) | PHASE_ZERO_DEALER | POKER_DEALER if Owner |
| Owner only, not seated, not Dealer | PHASE_ZERO_DEALER after start | WAITING | PHASE_ZERO_DEALER | POKER_DEALER |

Never infer role from name, email, or a leftover Auth.js session. Guest cookie wins on the invited table.

## Blackjack Player screen contract

Dominant board: approved Player PNG (`12_50_26 PM (1)(2)`). Reproduce that composition: header with table name and balance, large phase title, dealer mark, owned boxes at the board’s size and grouping, contextual ADD BOX / Insurance, action row, fixed tray.

Boxes follow the supplied arrangement (a centred pair when two exist; a single box where the board shows one). Stable `data-box-id` targeting is required. The obsolete three-column CSS grid is not a visual requirement.

If the board shows other Players, omit only privacy-forbidden amounts while keeping useful composition. Do not leave a giant empty felt.

### Betting / Playing / Insurance / Payout

Visible controls follow `blackjackPlayerControls()`. Betting: `ADD BOX`, Amount, `RETRACT`, `PLACE BET`. Playing: `2×` / `SPLIT` / `INSURANCE` by legal flags. Insurance: same card-action row plus compact purchase. Payout: results only. Tray always at the bottom.

## Blackjack Dealer / Owner screen contract

Dominant board: approved Dealer/Owner PNG (`12_50_27 PM (3)(2)`). Implement that layout visually (summary, phase actions, named rows, column density). It may look tabular. Do not invent plaques, circular DEALER objects, or giant cards.

Visible controls follow `blackjackDealerControls()`. Engine commands: `startBetting`, `dealCards`, `openInsurance` / `closeInsurance`, `enterPayout`, `startNextRound`. Mock labels `OPEN BETTING` / `CLOSE BETTING` / `START NEXT ROUND` map to `START BETTING` / `DEAL CARDS` / `START BETTING` in the same slots.

### Role header

Header follows the PNG: menu, table name, `OWNER` / `DEALER` badges.

### TABLE_SETUP / Betting / Playing / Insurance / Payout

Use the supplied row composition connected to real Player boxes and balances. Payout keys use the supplied arrangement at ≥44px. Dock:

```text
TABLE_SETUP: START BETTING | ADD PLAYER
BETTING:     DEAL CARDS | ADD PLAYER
PLAYING:     ENTER PAYOUT | OPEN INSURANCE
INSURANCE:   ENTER PAYOUT | CLOSE INSURANCE
PAYOUT:      START BETTING (full width)
```

## Owner utilities

These stay available and must not compete with play. They live in the compact menu/sheet:

- give extra jetons
- change Dealer/Bank
- save/close table
- switch game
- invite management after setup
- limits / Open vs Limited Bank
- optional Card Assist
- countdown extras (`DEAL IN 7 SECONDS`, `IN 7 SECONDS`)
- `DEALER WON` during Payout (owner bulk LOST for unresolved active boxes; never Insurance)

The shared Dealer dock only progresses the round:

```text
TABLE_SETUP: START BETTING | ADD PLAYER
BETTING:     DEAL CARDS | ADD PLAYER
PLAYING:     ENTER PAYOUT | OPEN INSURANCE
INSURANCE:   ENTER PAYOUT | CLOSE INSURANCE
PAYOUT:      START BETTING (full width)
```

## Card Assist

Physical cards remain authoritative. Card Assist must not appear by default on Setup, Betting, Playing, Insurance, or Payout. Do not delete the engine. Entry: Menu → Optional tools → Card Assist. It must not consume felt space, change phase, calculate results, block payout, or appear in Player primary controls.

## Poker Dealer / Owner / Player screen contract

Dominant board: Poker Dealer / Owner phases (`12_50_27 PM (5)`). Player screens use the same visual system. Do not copy illustrative balances or names.

### Shared grid

Same seven-zone 390×844 grid as Blackjack. Poker seats occupy zone 5 in every phase. One seat component across `SETUP`, `PRE_FLOP`, `FLOP`, `TURN`, `RIVER`, `SHOWDOWN`, and `HAND_COMPLETE`. Owner street actions live in zone 3. Player betting actions sit immediately above the fixed tray. The rotating Dealer button is a seat marker (`D`), never Owner chrome.

### Setup

Table name once on the felt. Compact Poker label. Participating Players with available balances. Dealer-button assignment when the engine has one. Small Blind and Big Blind. Owner `START HAND`. Seat order stays in the menu.

### Streets

Compact rail `DEAL → PRE-FLOP → FLOP → TURN → RIVER → SHOWDOWN`. Felt shows `POT [amount]` and `TO CALL [amount]` only when owed on a live street. Never `CALL 0`. Never To Call after Hand Complete. Side-pot lines only when side pots exist. Current actor: `YOUR TURN` on that device, `TURN` on others, gold pulse (static outline when reduced-motion). Player actions follow `legalActions` only.

### Showdown / Hand Complete

No actor, To Call, or betting controls. Owner awards eligible winners with compact controls; cards and hand strength stay offline. Hand Complete shows `POT PAID`, `{name} WON {amount}`, final balances, and Owner `NEXT HAND`. Tray remains visible and disabled on Player views.

### Hidden from the primary surface

Card Assist, community/hole-card graphics, `NEXT HAND IN 7 SECONDS`, seat ordering, switch game, and funding live in the table menu. Do not delete the commands.

## Must never appear

- Duplicate table name in the header
- Duplicate phase copy (`BETTING PHASE`, `PLAYING PHASE`, `PAYOUT PHASE`, `CURRENT PHASE:`)
- Long instructional sentences under the phase heading
- Other Players’ complete boxes on the Player felt
- Cards or totals on the default Player surface
- Spreadsheet / generic-form layouts for live play
- Generated-image USD signs, fake names, or invented payout math
- Owner utilities in the phase-action row
- Card Assist on the default felt
- The blank `12_50_26 PM (1)` image as a reference
- Poker visuals that ignore `12_50_27 PM (5)` after Prompt 3
