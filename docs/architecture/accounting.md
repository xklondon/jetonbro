# Accounting rules

Values are stored as millijetons (`bigint`, 1000 = 1 jeton). Floating-point arithmetic is not used for balances.

The Bank has an **unlimited virtual reserve**. It is not a stored balance and is not a cash account. It is the explicit source of newly issued table jetons and of payout profit, and the explicit sink of lost ordinary and Insurance stakes.

Player-visible conservation is:

`AVAILABLE + LOCKED_BET + LOCKED_INSURANCE`

That sum plus the Bank virtual reserve is conserved for every command. The reserve itself is unbounded.

Limited Bank table conservation, excluding only explicit `BANK_VIRTUAL_RESERVE` funding or funding adjustment, is:

`AVAILABLE + LOCKED_BET + LOCKED_INSURANCE + BANK_AVAILABLE + BANK_LOCKED_EXPOSURE`

## Buckets

| Bucket | Meaning |
| --- | --- |
| AVAILABLE | `TableMember.availableMillis` |
| LOCKED_BET | `BettingBox.lockedBetMillis` |
| LOCKED_INSURANCE | `InsuranceBet.amountMillis` until Insurance is settled |
| BANK_VIRTUAL_RESERVE | Unlimited Open Bank source/sink. Not stored as a row. |
| BANK_AVAILABLE | Limited Bank spendable bankroll (`Table.bankAvailableMillis`) |
| BANK_LOCKED_EXPOSURE | Limited Bank reserved maximum profit (`Table.bankLockedExposureMillis`) |
| LOCKED_POKER | Poker street/pot contributions until awarded (`PokerParticipant.lockedMillis`) |

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
| Fund Limited Bank | BANK_VIRTUAL_RESERVE | BANK_AVAILABLE |
| Reserve Bank exposure | BANK_AVAILABLE | BANK_LOCKED_EXPOSURE |
| Release unused Bank exposure | BANK_LOCKED_EXPOSURE | BANK_AVAILABLE |
| Limited Bank takes a lost stake | LOCKED_BET | BANK_AVAILABLE |
| Limited Bank pays a win | BANK_LOCKED_EXPOSURE | AVAILABLE (Player is credited once by BET_WIN_RETURN / BLACKJACK_RETURN; BANK_PAYOUT is the Bank-side exposure consumption) |
| Limited Bank takes Insurance loss | LOCKED_INSURANCE | BANK_AVAILABLE |
| Increase Limited Bank | BANK_VIRTUAL_RESERVE | BANK_AVAILABLE |
| Player posts a Poker blind or wager | AVAILABLE | LOCKED_POKER |
| Uncalled Poker wager returns | LOCKED_POKER | AVAILABLE |
| Poker pot is awarded | LOCKED_POKER | AVAILABLE |
| Next round | AVAILABLE | AVAILABLE (unchanged) |
| Another table | AVAILABLE | PLAYER_POCKET, then destination AVAILABLE |

Box settlement never writes Insurance rows. Insurance settlement never writes box outcomes.

Ledger entries are append-only and required for every balance change. Player settlement writes one Player-side row (`playerId` set): `BET_WIN_RETURN`, `BET_PUSH_RETURN`, `BET_LOSS`, `BLACKJACK_RETURN`, `INSURANCE_WIN_RETURN`, or `INSURANCE_LOSS`. Limited Bank writes matching Bank-side rows in the same transaction (`playerId` null): `BANK_PAYOUT` consumes reserved exposure; `BANK_STAKE_TAKE` credits `BANK_AVAILABLE` with a lost stake; `BANK_EXPOSURE_RESERVED` / `BANK_EXPOSURE_RELEASED` move value between `BANK_AVAILABLE` and `BANK_LOCKED_EXPOSURE`. `BANK_PAYOUT` is never a second Player credit. Each of those rows has its own idempotency key, exact source and destination in the description, and exact millijeton amount.

Table-wide conservation is `AVAILABLE + LOCKED_BET + LOCKED_INSURANCE + LOCKED_POKER + BANK_AVAILABLE + BANK_LOCKED_EXPOSURE`, plus Player pockets outside the table. Poker never mints or burns `BANK_VIRTUAL_RESERVE`. Limited Bank buckets freeze unchanged while Texas Hold’em is active.
