# Database schema summary

PostgreSQL via Prisma. Values are `bigint` millijetons (1000 = 1 jeton).

| Entity | Role |
| --- | --- |
| User, Account, Session, VerificationToken | Auth.js identity and HTTP-only sessions |
| PlayerAccount | Pocket jetons not currently allocated to a table |
| Table | Persistent table, game id, Bank/Dealer, limits, payout rule, phase |
| TableMember | One active allocation per player per table |
| Invitation | Email (single-use) or QR (multi-use until rotated) |
| Round | One Blackjack round and Insurance window |
| BettingBox | Ordinary stake, split parent, unique settlement key |
| InsuranceBet | Side pot, unique settlement key, independent of box outcome |
| LedgerEntry | Append-only history |
| IdempotencyRecord | Prevents duplicate value-changing commands |

Constraints include non-negative table balances, unique box/Insurance settlement keys, unique invitation tokens, and unique round numbers per table.
