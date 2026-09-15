# Two-device acceptance checklist

Use one Bank/Owner phone or browser and two Player sessions.

1. Create table
2. Invite one Player by email
3. Invite another by QR
4. Distribute starting jetons
5. Open Betting
6. Player creates two boxes
7. Player bets using jetons and exact amount
8. Bank presses Deal cards
9. Player doubles one box
10. Player splits another box
11. Bank opens Insurance
12. Player buys Insurance
13. Bank closes Insurance
14. Bank enters Payout
15. Bank settles every normal box independently
16. Bank settles Insurance independently
17. Confirm all Player balances and ledger entries
18. Start the next hand
19. Refresh every device
20. Confirm table, members, balances and history remain correct

Automated coverage: `src/application/services/blackjack-round.test.ts` and `e2e/invitations.spec.ts`.
