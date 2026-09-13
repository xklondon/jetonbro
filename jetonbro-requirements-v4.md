# JetonBro requirements — v4 (consolidated)

Supersedes `jetonbro-requirements-v3.md`. Single source of truth for this project. Standalone repo, no dependency on sxmcards. The app is a betting-action layer with a role/phase permission model — never a game engine.

## Principles

- No real money, no card/dice simulation, no hand evaluation. Physical cards/dice are played by humans, offline.
- One escrow primitive everywhere: **confirm → lock → resolve → release**.
- Protocols (blackjack/poker/zilch) are config objects (actions, phases, roles, payout rule) — never bespoke code per game.
- Sharp, simple frontend; minimal backend. If a feature seems to require the app to understand cards, dice, or hand rankings, it's out of scope — offer a manual-entry/display field instead, never an automated evaluation.

## Roles

- **Table owner**: creates the table, sets stakes/rules, invites players, manages settings. Always has settings access regardless of game phase. Not necessarily a player or the bank.
- **Bank/dealer**: the protocol-defined authority that opens/closes betting, and declares/confirms outcomes. Who holds this role, and whether it rotates, is protocol-specific (below).
- **Player**: bets, acts on their turn (where turn order applies), sees their own stack and the shared pot/box areas.

## Wallet & escrow

- Master wallet (per user, persists) → Game wallet (per table, funded from master at buy-in).
- Escrow states: `CONFIRMED → LOCKED → RESOLVED → RELEASED`, each transition an immutable ledger row (actor, amount, timestamp).
- RESOLVED supports: (a) outcome × protocol multiplier (blackjack), suggested and always editable before release; (b) declared winner(s), pot split evenly (poker/zilch).
- Manual hand-entry/photo fields are **display aids only** — shown to the bank/dealer or other players to help them decide, never parsed or evaluated by the app.

## Personal ledger (new in v4)

Purpose: across every table and game two people have ever shared, show a single running net standing — "Steve owes Bob 20" — the plain-language settlement instruction that the whole confirm/lock/resolve/release trail across all those virtual chip movements ultimately implies in the real world.

- **Not a wallet.** No new escrow state, no new balance type. This is a reporting/aggregation layer over existing RELEASE ledger rows.
- **Derivation**: every RELEASE event that moves value from player A to player B (or vice versa), at any table, in any game, appends a personal-ledger entry `{from, to, amount, tableId, timestamp}`. Never written to independently of a real escrow release.
- **Net standing**: for any pair of users, `net = sum(transfers B→A) − sum(transfers A→B)`, shown as "X owes Y [amount]" or "settled."
- **Standings screen**: for the current user, one row per other user they have shared history with, showing the net standing.
- **Save**: snapshot the current net standing (for one pair, or all) as an archived, point-in-time record. Does not alter the underlying transfer history.
- **Clear**: an explicit user action marking a standing as settled in real life. This writes its own "manual settlement" ledger entry (net standing resets from that point) — it never deletes the underlying game/transfer history, which stays intact for reference.
- No automated real-money settlement of any kind — this is visibility only, consistent with the rest of the app.

## Blackjack — roles × phases

Bank role: **standing** by default, table setting for **rotating** (passes each round).

| Phase | Bank/dealer can | Player can |
|---|---|---|
| **Setup** | Start betting, only after the table owner has assigned Bank and at least one other Player has joined. (Table owner — who may or may not be Bank — assigns the standing Bank role, one person at a time, and assigns starting chips when inviting each player. Owner and Bank are different roles.) | See own stack; wait |
| **Betting open** | Open the betting round | Bet — type an amount or tap denominations from their stack — confirm (locks into their box) |
| **Betting closed** | Close betting (locks all boxes); signal "cards dealt" (offline deal happens now) | — |
| **Post-deal actions** | Optionally open an "insurance window" (toggle) | Double (locks matching amount), Split (locks matching amount, creates second box), Insurance — only if bank has opened that window |
| **Resolution** | Per box: declare outcome (Win / Blackjack / Push / Lose) — app suggests payout via multiplier, editable before confirming. Optionally view a player's manually entered/photographed hand as a decision aid | Optionally type or attach a photo of their hand as a display aid for the bank; see their own box's declared result and updated stack |
| **New round** | Re-open betting | — |

## Poker — roles × phases

Dealer role: **rotates every hand**, following the table's turn-order setting. Buy-ins/rebuys are handled by the table owner (poker has no house bank — money only ever moves player to player via the pot).

| Phase | Dealer can | Player can |
|---|---|---|
| **Setup** | — | See own stack; wait |
| **Hand start** | Dealer button assigned/rotated automatically per turn order; prompts small/big blind | The two players in blind position confirm their blind (locks into pot) |
| **Betting round** (repeats per street, dealer-triggered) | Advance to the next betting round when current round is settled | Whoever holds the turn: Bet, Call, Raise, Check, or Fold (turn-order enforced — only the current player's buttons are active) |
| **Showdown** | Declare winner(s) among non-folded players (or accept a player's own claim) — pot splits evenly across declared co-winners. Optionally view players' manually entered/photographed hands as a decision aid (never evaluated by the app) | Optionally type or attach a photo of their hand as a display aid |
| **New hand** | Dealer button rotates to next player in turn order | — |

Side-pot math for uneven all-ins is out of scope for v1 — single pot only.

## Zilch — roles × phases

Kept intentionally simple: no separate scorer role. The current turn-holder self-reports; this matches the trust-network model the whole app is built on.

| Phase | Turn holder can | Other players can |
|---|---|---|
| **Setup** | — | See own stack; wait (table owner assigns buy-in) |
| **Turn start** | Stake an amount for the turn (locks) | Wait for their turn |
| **Turn resolution** (after offline roll) | Declare the turn's outcome (kept the points / lost the stake) — release follows directly, no multiplier | — |
| **Next turn** | Turn passes to next player per turn order | — |

## Visual/UI requirements

- **Stack + betting/pot area**: confirming any locking action visually moves chips from the player's stack into the shared betting/pot area (this *is* CONFIRMED→LOCKED, shown). Release animates chips from that area to the winner's stack (RESOLVED→RELEASED, shown). One state update drives both the ledger and the animation — never two separate states.
- **Manual hand-entry/photo field**: available wherever the tables above list it, purely for display between players/bank — no OCR, no parsing, no automated scoring.
- **Skins**: Simple, Casino, Bank, Fun — one component tree, theme tokens only (background, accent, button colors, one icon per skin).
- **Chip-visual mode**: renders wallet integers as denominated chip-stack graphics. Presentational layer only.
- **Nav**: hamburger → Table / Wallet / Standings / Fun. Fun → Yellow card, Red card (generic, no licensed imagery), Magic 8-ball — all static, zero backend dependency. Standings is the personal-ledger screen described above.
- Mobile only.

## Out of scope for v1

- Card/dice simulation, hand evaluation of any kind (including the manual hand-entry fields — display only, never computed).
- Poker side-pots (uneven all-ins) — single pot only.
- Real-money rails.
- Cross-table aggregate "all games" wallet view (leave the seam, don't build the screen) — distinct from the personal ledger above, which is cross-table but is a net-standing report, not a spendable balance.
- Third-party financial escrow — the ledger-based lock/release model is the whole of "escrow."
- Automated settlement of personal-ledger balances (no payment triggering, no reminders) — visibility only.

## Build order

1. Wallet + escrow engine, unit-testable, no UI.
2. Protocol configs (blackjack/poker/zilch) as data, including the role/phase tables above, wired to the escrow engine. Turn-order model for poker/zilch.
3. Personal ledger as a read-model derived from escrow RELEASE events (§ Personal ledger), including Save and Clear actions.
4. Auth/invite (magic-link email + WhatsApp share + QR-with-contact + Mates-mode guest).
5. Core UI: stack/betting-area visual, phase-gated action buttons per role, one skin (Simple), manual hand-entry/photo field, Standings screen.
6. Remaining skins + chip-visual mode.
7. Fun nav (parallelizable with anything above).
