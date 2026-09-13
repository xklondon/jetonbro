# Route manifest

Single registry for every REST route, socket event, and app-defined action type. Before adding any of the three, grep this table for an existing equivalent — extend it, do not duplicate it.

Identity is unique across the table. Use `GET /path` or `POST /path` for REST, the event name for sockets, and the action type string for app-defined actions.

| Kind | Identity | Owner module | Notes |
| --- | --- | --- | --- |
| REST | POST /api/auth/request-magic-link | src/http/registerRoutes.ts | Shared by email, WhatsApp, QR contact capture, and guest upgrade. |
| REST | GET /api/auth/verify | src/http/registerRoutes.ts | Peek only: validate the token and return the confirmation payload. Never accepts T&Cs or creates an account/wallet. Query `acceptedTerms` is ignored. |
| REST | POST /api/auth/verify | src/http/registerRoutes.ts | Explicit tap: accept T&Cs and complete account creation / guest upgrade. |
| REST | GET /api/auth/me | src/http/registerRoutes.ts | Session user + master wallet + table memberships. |
| REST | POST /api/auth/logout | src/http/registerRoutes.ts | Drops the bearer session. |
| REST | POST /api/tables | src/http/registerRoutes.ts | Verified owner (T&Cs already accepted). Body `protocolId`: blackjack \| poker \| zilch. |
| REST | GET /api/tables/:tableId | src/http/registerRoutes.ts | Phase, roles, stacks, pot, boxes, allowed actions, hand-display fields. |
| REST | POST /api/tables/:tableId/invites | src/http/registerRoutes.ts | `channel`: email \| whatsapp \| qr \| mates. WhatsApp is a share-intent wrapper around the same magic-link, not a second auth path. |
| REST | POST /api/tables/:tableId/actions | src/http/registerRoutes.ts | Protocol action + escrow lock/resolve/release on the same update. |
| REST | POST /api/tables/:tableId/buy-in | src/http/registerRoutes.ts | Fund the game wallet from master. |
| REST | POST /api/tables/:tableId/hand-display | src/http/registerRoutes.ts | Display-only text/photo. No parse, OCR, or scoring. |
| REST | GET /api/invites/preview | src/http/registerRoutes.ts | Tells the client whether contact + T&Cs are required. |
| REST | POST /api/invites/mates/join | src/http/registerRoutes.ts | Device-scoped guest. No contact, no magic-link, no T&Cs. |
| REST | GET /api/standings | src/http/registerRoutes.ts | Personal-ledger net standing per other user. |
| REST | POST /api/standings/save | src/http/registerRoutes.ts | Snapshot; does not change nets. |
| REST | POST /api/standings/clear | src/http/registerRoutes.ts | Writes MANUAL_SETTLEMENT; never deletes RELEASE history. |
