# Accounting rules

Values are stored as millijetons (`bigint`, 1000 = 1 jeton). Floating-point arithmetic is not used for balances.

The Bank has an **unlimited virtual reserve**. It is not a stored balance and is not a cash account. It is the explicit source of newly issued table jetons and of payout profit, and the explicit sink of lost ordinary and Insurance stakes.

Player-visible conservation is:

`AVAILABLE + LOCKED_BET + LOCKED_INSURANCE`

That sum plus the Bank virtual reserve is conserved for every command. The reserve itself is unbounded.

## Buckets

| Bucket | Meaning |
| --- | --- |
| AVAILABLE | `TableMember.availableMillis` |
| LOCKED_BET | `BettingBox.lockedBetMillis` |
| LOCKED_INSURANCE | `InsuranceBet.amountMillis` until Insurance is settled |
| BANK_VIRTUAL_RESERVE | Unlimited Bank source/sink. Not stored as a row. |
| PLAYER_POCKET | `PlayerAccount.globalAvailableMillis` when leaving a table |

## Payouts

Profit is paid by the Bank virtual reserve. Total return is what is credited to AVAILABLE.

| Result | Profit | Total return | 25 stake |
| --- | --- | --- | --- |
| Win | 1× stake | 2× stake | 50 |
| Push | 0 | 1× stake | 25 |
| Loss | — | 0 | 0 |
| Blackjack 3:2 | 1.5× stake | 2.5× stake | 62.5 |
| Blackjack 6:5 | 1.2× stake | 2.2× stake | 55 |
| Insurance 2:1 win | 2× Insurance stake | 3× Insurance stake | 10 → 30 |
| Insurance loss | — | 0 | 0 |

## Ownership of every move

| Operation | From | To |
| --- | --- | --- |
| Bank distributes jetons | BANK_VIRTUAL_RESERVE | AVAILABLE |
| Player places bet | AVAILABLE | LOCKED_BET |
| Player retracts bet | LOCKED_BET | AVAILABLE |
| Player doubles | AVAILABLE | LOCKED_BET |
| Player splits | AVAILABLE | LOCKED_BET (new box) |
| Player takes Insurance | AVAILABLE | LOCKED_INSURANCE |
| Player loses | LOCKED_BET | BANK_VIRTUAL_RESERVE |
| Player wins | LOCKED_BET consumed; BANK_VIRTUAL_RESERVE pays 1× profit | AVAILABLE receives 2× stake |
| Player pushes | LOCKED_BET | AVAILABLE |
| Player gets Blackjack | LOCKED_BET consumed; BANK_VIRTUAL_RESERVE pays 1.5× or 1.2× | AVAILABLE receives 2.5× or 2.2× stake |
| Insurance wins | LOCKED_INSURANCE consumed; BANK_VIRTUAL_RESERVE pays 2× | AVAILABLE receives 3× Insurance stake |
| Insurance loses | LOCKED_INSURANCE | BANK_VIRTUAL_RESERVE |
| Next round | AVAILABLE | AVAILABLE (unchanged) |
| Another table | AVAILABLE | PLAYER_POCKET, then destination AVAILABLE |

Box settlement never writes Insurance rows. Insurance settlement never writes box outcomes.

Ledger entries are append-only and required for every balance change.
