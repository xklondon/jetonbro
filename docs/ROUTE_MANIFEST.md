# Route manifest

Single registry for every REST route, socket event, and app-defined action type. Before adding any of the three, grep this table for an existing equivalent — extend it, do not duplicate it.

Identity is unique across the table. Use `GET /path` or `POST /path` for REST, the event name for sockets, and the action type string for app-defined actions.

| Kind | Identity | Owner module | Notes |
| --- | --- | --- | --- |
| REST | POST /api/auth/request-magic-link | src/http/registerRoutes.ts | Shared by email, WhatsApp, QR contact capture, and guest upgrade. When `RESEND_API_KEY` is set, email-channel (home + email invite) sends the frontend `/verify?token=` link via Resend and the response is `{ emailed: true }` with no raw token. No key: in-memory `emailOutbox` + `{ token, verifyUrl }` (dev). WhatsApp/QR never send mail. |
| REST | GET /api/auth/verify | src/http/registerRoutes.ts | Peek only: validate the token. Never creates an account/wallet. T&Cs not required in v1 friends-only. |
| REST | POST /api/auth/verify | src/http/registerRoutes.ts | Explicit tap to complete account creation / guest upgrade / table join. T&Cs not gated in v1. |
| REST | GET /api/auth/me | src/http/registerRoutes.ts | Session user + master wallet + table memberships. |
| REST | POST /api/auth/logout | src/http/registerRoutes.ts | Drops the bearer session. |
| REST | POST /api/tables | src/http/registerRoutes.ts | Verified owner (not a guest). T&Cs not required in v1 friends-only. Body `protocolId`: blackjack \| poker \| zilch. |
| REST | GET /api/tables/:tableId | src/http/registerRoutes.ts | Phase, roles, stacks, pot, boxes, allowed actions, hand-display, owner invite roster (pending/joined). |
| REST | POST /api/tables/:tableId/invites | src/http/registerRoutes.ts | Owner add-player. `channel` email \| whatsapp \| qr \| mates; optional `openingChips`. WhatsApp is a share-intent wrapper around the same magic-link. |
| REST | POST /api/tables/:tableId/actions | src/http/registerRoutes.ts | Protocol action + escrow lock/resolve/release on the same update. Optional `payoutAmount` edits the RESOLVED suggestion before a per-box release. |
| ACTION | assign-bank | src/protocol/configs.ts | Table-owner setup. Sets standing authority (`targetUserId`); omit to clear. One Bank at a time. |
| ACTION | open-betting | src/protocol/configs.ts | Shown as Start betting. Bank only; requires a seated Player besides Bank. |
| ACTION | bet | src/protocol/configs.ts | Shared blackjack/poker lock into box or pot. |
| ACTION | close-betting | src/protocol/configs.ts | Bank; locks all boxes. |
| ACTION | signal-cards-dealt | src/protocol/configs.ts | Bank; offline deal marker. |
| ACTION | open-insurance-window | src/protocol/configs.ts | Bank flag toggle. |
| ACTION | double | src/protocol/configs.ts | Owned-box lock. |
| ACTION | split | src/protocol/configs.ts | Owned-box lock + second box. |
| ACTION | insurance | src/protocol/configs.ts | Owned-box lock; requires insuranceWindow. |
| ACTION | begin-resolution | src/protocol/configs.ts | Shared blackjack/zilch phase advance. |
| ACTION | declare-outcome | src/protocol/configs.ts | Shared. Blackjack: per-box resolve + optional payoutAmount + release. Zilch: resolve+release pot. |
| ACTION | attach-hand-display | src/protocol/configs.ts | Display-only; no parse/OCR/score. |
| ACTION | finish-resolution | src/protocol/configs.ts | Bank; release leftover + new-round. |
| ACTION | reopen-betting | src/protocol/configs.ts | Bank; may rotate authority. |
| ACTION | start-hand | src/protocol/configs.ts | Poker dealer. |
| ACTION | confirm-blind | src/protocol/configs.ts | Poker lock. |
| ACTION | begin-betting | src/protocol/configs.ts | Poker dealer. |
| ACTION | call | src/protocol/configs.ts | Poker lock. |
| ACTION | raise | src/protocol/configs.ts | Poker lock. |
| ACTION | check | src/protocol/configs.ts | Poker. |
| ACTION | fold | src/protocol/configs.ts | Poker. |
| ACTION | advance-betting-round | src/protocol/configs.ts | Poker dealer. |
| ACTION | begin-showdown | src/protocol/configs.ts | Poker dealer. |
| ACTION | declare-winners | src/protocol/configs.ts | Poker even-split resolve. |
| ACTION | finish-showdown | src/protocol/configs.ts | Poker release. |
| ACTION | new-hand | src/protocol/configs.ts | Poker; rotates dealer. |
| ACTION | start-turn | src/protocol/configs.ts | Zilch. |
| ACTION | stake | src/protocol/configs.ts | Zilch lock. |
| ACTION | next-turn | src/protocol/configs.ts | Zilch; rotates turn-holder. |
| REST | POST /api/tables/:tableId/buy-in | src/http/registerRoutes.ts | Fund the game wallet from master. |
| REST | POST /api/tables/:tableId/hand-display | src/http/registerRoutes.ts | Display-only text/photo. No parse, OCR, or scoring. |
| REST | GET /api/invites/preview | src/http/registerRoutes.ts | Tells the client whether contact is required. T&Cs not required in v1 friends-only (`requiresTerms` is always false). |
| REST | POST /api/invites/mates/join | src/http/registerRoutes.ts | Device-scoped guest. No contact, no magic-link, no T&Cs. |
| REST | GET /api/standings | src/http/registerRoutes.ts | Personal-ledger net standing per other user. |
| REST | POST /api/standings/save | src/http/registerRoutes.ts | Snapshot; does not change nets. |
| REST | POST /api/standings/clear | src/http/registerRoutes.ts | Writes MANUAL_SETTLEMENT; never deletes RELEASE history. |
