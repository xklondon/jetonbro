# Route manifest

Single registry for every REST route, socket event, and app-defined action type. Before adding any of the three, grep this table for an existing equivalent — extend it, do not duplicate it.

Identity is unique across the table. Use `GET /path` or `POST /path` for REST, the event name for sockets, and the action type string for app-defined actions.

| Kind | Identity | Owner module | Notes |
| --- | --- | --- | --- |
| REST | POST /api/auth/request-magic-link | src/http/registerRoutes.ts | Shared by email, WhatsApp, QR contact capture, and guest upgrade. |
| REST | GET /api/auth/verify | src/http/registerRoutes.ts | Completes the magic-link. `acceptedTerms` required to create/upgrade an account. |
| REST | GET /api/auth/me | src/http/registerRoutes.ts | Session user + master wallet + table memberships. |
| REST | POST /api/auth/logout | src/http/registerRoutes.ts | Drops the bearer session. |
| REST | POST /api/tables | src/http/registerRoutes.ts | Verified owner (T&Cs already accepted). |
| REST | POST /api/tables/:tableId/invites | src/http/registerRoutes.ts | `channel`: email \| whatsapp \| qr \| mates. WhatsApp is a share-intent wrapper around the same magic-link, not a second auth path. |
| REST | GET /api/invites/preview | src/http/registerRoutes.ts | Tells the client whether contact + T&Cs are required. |
| REST | POST /api/invites/mates/join | src/http/registerRoutes.ts | Device-scoped guest. No contact, no magic-link, no T&Cs. |
