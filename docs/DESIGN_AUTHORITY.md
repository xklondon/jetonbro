# JetBro II design authority

Documentation only. These boards and rules control presentation. They do not change ledger, phase, permission, or payout behaviour.

## Valid boards

Store copies under `docs/design-reference/` when the source file can be copied safely. Do not store the blank/corrupt image. Do not regenerate mockups.

| Source filename | Role | Prompt | Stored file |
|---|---|---|---|
| `ChatGPT Image Sep 22, 2026, 12_49_42 PM (1).png` | Blackjack Player phases: Betting, Playing, Insurance Open, Payout/Result | 7 | `blackjack-player-phases.jpg` (also `.webp`) |
| `ChatGPT Image Sep 22, 2026, 12_50_27 PM (2).png` | Table Owner and Setup: Saved Tables, Create Table, Table Setup, Game Selection | 6–7 | `table-owner-setup.jpg` |
| `ChatGPT Image Sep 22, 2026, 12_50_27 PM (3).png` | Blackjack Dealer / Owner phases | 7 | `blackjack-dealer-owner-phases.jpg` |
| `ChatGPT Image Sep 22, 2026, 12_50_27 PM (4).png` | Poker Player phases | 7 | `poker-player-phases.jpg` |
| `ChatGPT Image Sep 22, 2026, 12_50_27 PM (5).png` | Poker Dealer / Owner phases | 7 | `poker-dealer-owner-phases.jpg` |

Ignore:

- `ChatGPT Image Sep 22, 2026, 12_50_26 PM (1).png` — blank/corrupt, not a reference.

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
    → OPEN BETTING / START HAND when legal
    → existing Blackjack or Poker phase screens
```

There is no second configuration screen after `START TABLE`. There is no later game-selection journey. Draft persistence for QR/email is internal; the owner stays on Create Table until `START TABLE`.

### Saved Tables / Home

Compact JetonBro header. `CREATE TABLE`. Compact saved-table cards: name, selected game, phase/status, player count, Owner/Dealer, `RESUME`, owner overflow. Owner-only `DELETE` (empty draft) or `CLOSE TABLE` (archive). No duplicate Resume label, no giant cards, no raw browser controls, no History. Join-by-code is not a second primary Home action.

### Create Table

One compact 390×844 screen that does not scroll the phone frame: table name and starting jetons, Owner identity, Blackjack/Poker segmented selector (Zilch as a coming-later note), Open/Limited Bank with Limited reserve only when Limited is selected, Poker blinds only when Poker is selected, Dealer, compact Player rows, inline Guest / Verified / Email invitation expanders, primary `START TABLE`. After `START TABLE`, Phase 0 uses `ADD PLAYERS` to open the invitation dialog.

### Phase 0

The created table waiting for Players — not the setup form. Compact Player rows from the Table Setup board. No giant empty placeholder. `WAITING FOR PLAYERS` until the engine’s start command is legal. Blackjack `OPEN BETTING` is Dealer-only. Poker `START HAND` follows existing `pokerControls()` / command legality. `ADD NEW PLAYER` opens the same invitation mask used on Create Table. A seated Player sees the Player waiting board with their wallet, not Dealer controls. An Owner who assigned the Bank to someone else still sees the Owner Phase 0 admin board.

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

The live table name appears exactly once, on the felt (`data-table-name`).

## Seven-zone mobile grid (390×844)

Maximum game width approximately 480px. Minimum touch target 44px. Felt may scroll internally. The tray never covers controls. Avoid full-page body scroll during active play.

1. Compact app header
2. Phase header
3. Dealer phase action (Owner/Dealer only; Players omit this row)
4. Felt and table identity
5. Players and Blackjack boxes
6. Current Blackjack controls
7. Fixed jeton/balance tray (Player), or compact Dealer stats (Dealer who is not personally betting)

Phase lives in the phase header. Player available balance lives with the tray. Phase controls sit directly above the tray for Players, and in zone 3 for Dealer round progression.

## Shared colour and type

Classic tokens already match the boards. Canonical values live in `src/ui/skins/classic/tokens.css` and are consumed by `layouts.css` / `home.css`, not per-phase sheets:

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

Shared components: `TableShell`, `PhaseBar`, `PhaseActionDock`, `TableIdentity`, `SheetOverlay`, `ClassicInviteMask`, `PlayerWallet` / `JetonTray`. Create Table and Phase 0 reuse one invitation mask.

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

Dominant board: Player phases (`12_49_42 PM (1)`).

**Fixed box stage (user correction).** Player boxes occupy a permanent 3-slot grid (box 1 / 2 / 3). A box never recentres, resizes, or slides when another box is added, dropped, or when Insurance, Playing, or Payout chrome appears. Empty slots keep their space. Extra split boxes wrap to the next row of the same three columns. Controls, Insurance copy, and Card Assist never live inside the box stage.

### Betting

- Table name near the top of the felt.
- Compact Dealer state only — do not fill the felt with other Players’ complete boxes.
- The Player’s own boxes occupy the fixed stage.
- Selected box: restrained gold border.
- Each box shows stake and chip pile.
- `START ADDITIONAL BOX`, `RETRACT`, `PLACE BET` in the control dock.
- Jeton tray fixed at the bottom; available balance beside/above the tray.

### Playing

- Same owned boxes in the same slots.
- `DOUBLE` / `SPLIT` / `INSURANCE` directly above the tray.
- No cards or totals on the default surface.

### Insurance

- Same selected box and main stake.
- Insurance as a separate side bet.
- Copy: `INSURANCE` / `Up to half the box stake`.
- Place Insurance when legal. Do not invent a retract-Insurance command.
- Keep the Double/Split/Insurance row structurally consistent.

### Payout / Result

- Same box component: Won, Lost, Stand-off, Blackjack, returned/won amount, updated available balance.
- Do not show Double/Split/Insurance as enabled controls.
- Tray remains visible and disabled.

## Blackjack Dealer / Owner screen contract

Dominant board: Dealer/Owner phases (`12_50_27 PM (3)`). Do not copy its illustrative arithmetic.

### Role header

Separate badges: `OWNER`, `DEALER`. A Dealer who also plays may show `DEALER · PLAYING`. Do not create a duplicate Player seat for the Dealer.

### Betting

Phase; `CLOSE BETTING` in the phase-action row; every Player; balances; main stakes; boxes; compact actions. No Player jeton tray unless the Dealer is placing a personal bet.

### Playing

Same Player rows and boxes. Show Double/Split and Insurance state. `ENTER PAYOUT`.

### Insurance

`OPEN INSURANCE` / `CLOSE INSURANCE` in the phase-action row. Main bet and Insurance in separate fields labelled `MAIN` and `INSURANCE`. Do not call per-box Insurance an “insurance pot”.

### Payout

Same Player/box structure. Settle `LOST` / `STAND-OFF` / `WON` / `BLACKJACK`. Insurance separately: `INS WON` / `INS LOST`. `START NEXT ROUND` stays disabled until everything is resolved.

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

The main phase-action row only progresses the round:

```text
START BLACKJACK
CLOSE BETTING
OPEN INSURANCE / CLOSE INSURANCE
ENTER PAYOUT
START NEXT ROUND
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
- `CURRENT PHASE:` and long instructional sentences
- Other Players’ complete boxes on the Player felt
- Cards or totals on the default Player surface
- Spreadsheet / generic-form layouts for live play
- Generated-image USD signs, fake names, or invented payout math
- Owner utilities in the phase-action row
- Card Assist on the default felt
- The blank `12_50_26 PM (1)` image as a reference
- Poker visuals that ignore `12_50_27 PM (5)` after Prompt 3
