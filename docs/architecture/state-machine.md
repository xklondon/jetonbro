# Blackjack state transitions

The only legal sequence is:

| From | Command | To |
| --- | --- | --- |
| TABLE_SETUP | `startBetting` | BETTING |
| BETTING | `dealCards` | PLAYING |
| PLAYING | `enterPayout` | PAYOUT |
| PAYOUT | all boxes and Insurance settled | ROUND_COMPLETE |
| ROUND_COMPLETE | `startNextRound` | BETTING |

Invalid backwards transitions and skipped phases throw `ConflictError`.

During PLAYING the Bank may open and close an Insurance window. That window is not a round phase.

After the first round, table setup is not repeated. Members, invitations, Bank/Dealer, and table balances remain.

# Texas Hold’em betting

`POKER_SETUP -> PRE_FLOP -> FLOP -> TURN -> RIVER -> SHOWDOWN -> HAND_COMPLETE -> PRE_FLOP`

Blinds post once when the hand starts and become the street wager. Heads-up: the dealer posts the small blind and acts first pre-flop; the big blind acts first after the flop. Three or more players: action starts left of the big blind pre-flop and left of the dealer after the flop.

`toCall = max(0, currentBet - playerStreetContribution)`. CHECK is legal only when `toCall` is 0. Facing a wager the actor receives CALL, RAISE, ALL IN, and FOLD. BET opens a street; RAISE increases an existing wager using a **Raise to** amount. A full raise reopens action. A short all-in does not reopen raising for players who have already acted.

A betting round closes only after every non-folded, non-all-in player has acted since the latest full bet or raise and has matched the current bet. One remaining live player awards the pot immediately. All-in runout still uses dealer-controlled street commands with no invented actor.
