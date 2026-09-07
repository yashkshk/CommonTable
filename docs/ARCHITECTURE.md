# Architecture

## Runtime

React 19 + TypeScript are rendered through Vinext on a Cloudflare Worker. Base UI-backed Shadcn components supply dialog, select and tabs behavior. A single `/api/[action]` route handles a small allowlisted set of actions, keeping shared authentication, request validation and errors consistent. D1 is the durable source of truth. React state holds only transient tray selections and presentation state.

## Data model

- `departments`: campus membership groups.
- `users`: staff identity, salted password hash, department, role and cached coin balance.
- `sessions`: SHA-256 hash of a random session token, owner and expiration.
- `login_attempts`: email/IP rate-limit counters with a 15-minute window.
- `spaces`: department restriction, location and capacity.
- `menu`: current descriptions, integer prices and stock.
- `orders`: immutable purchase snapshot, user, seating choice, status, total and idempotency information.
- `ledger`: immutable debit/credit records, actor and timestamp.

There is no independent occupancy counter to drift out of sync: capacity queries count active dine-in orders. Old order items are stored as a JSON snapshot so later menu changes cannot rewrite purchase history.

## Atomic checkout

The API validates a bounded list of item IDs and quantities and loads current menu prices. It derives a canonical request fingerprint and checks the per-user checkout key. It inserts one order. A `BEFORE INSERT` trigger rechecks quantities, unique menu lines, current price, stock, wallet and department seating/capacity. An `AFTER INSERT` trigger decrements stock and inserts a debit ledger row; a ledger trigger updates the wallet. SQLite rolls back the entire statement on any failure.

This avoids relying on a read-then-write application race or an unsupported interactive transaction. Distinct simultaneous requests serialize through D1/SQLite. Retried checkout inserts resolve to the original order only when the stored fingerprint matches. The database unique constraint prevents duplicate charges.

Cancellation uses a conditional status update. Triggers permit only valid transitions, restore stock and append a uniquely identified refund once. D1's `meta.changes` includes changes caused by triggers; a successful status update is detected using `> 0`, not `=== 1`.

## API contract

All responses disable caching. Except the public state endpoint and login/logout, requests require a valid staff session. All writes require JSON and same-origin requests.

| Method | Path                | Access                                        | Input / result                                             |
| ------ | ------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| GET    | `/api/state`        | Public / staff                                | Public menu/spaces; personal data only for current session |
| POST   | `/api/login`        | Public, throttled                             | email, password; HttpOnly session cookie                   |
| POST   | `/api/logout`       | Session optional                              | Revokes session, clears cookie                             |
| POST   | `/api/orders`       | Staff                                         | items, nullable spaceId, key; orderId                      |
| POST   | `/api/order-status` | Owner for cancellation; admin for progression | id, status                                                 |
| GET    | `/api/admin`        | Admin                                         | Kitchen queue and staff wallet list                        |
| POST   | `/api/stock`        | Admin                                         | id, integer stock 0–10000                                  |
| POST   | `/api/credit`       | Admin                                         | userId, integer amount 1–10000, reason, key                |

Errors use `{ error: string }` and appropriate 4xx/5xx statuses. Server errors log details without returning database internals. Login failures use a generic credential error. The browser never selects a role, supplies the charged total, or modifies the wallet directly.

## Optional WebMCP

If `document.modelContext` exists, `stage_canteen_tray` lets an agent stage validated items in the same visible tray. Its name and result explicitly state that no order or charge is completed. Checkout stays a separate user action. Registration is feature-detected and cleaned up; unsupported browsers continue normally. A real WebMCP-enabled browser contract run has not been performed.

## Boundaries

The request's implementation supports a campus demonstration and a staging handoff. It does not provide SSO, email recovery, cash processing, multi-campus tenancy, automatic kitchen devices, procurement, seat sensors, or reservations for future time slots. A deployment must provision real staff and validate operational identity and retention requirements. Vinext remains a beta upstream framework.
