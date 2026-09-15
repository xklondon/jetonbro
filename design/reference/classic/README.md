# JetonBro Classic screen pack

These files are the visual source of truth for the new Blackjack MVP.

## Screens

`jetonbro-player-bank-insurance.html` is the approved interactive reference. Open it in a browser and switch between:

- Player — Betting
- Player — Playing
- Player — Payout
- Bank/Dealer — Betting
- Bank/Dealer — Playing
- Bank/Dealer — Payout

The Insurance side-pot interaction is included in the Playing and Payout states.

## Design contract

- This design is the `classic` skin.
- Player sees all their own open boxes together.
- Player controls change by phase, but the bottom jeton stack and available value never move or disappear.
- Bank sees all active boxes.
- Bank phase and phase-transition action stay at the top.
- Insurance is a separate side pot with separate settlement.
- Cards and real money remain entirely offline.

Future skins must implement the same semantic component slots without changing game rules or accounting.
