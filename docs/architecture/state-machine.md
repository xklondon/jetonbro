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
