# Requirements and assumptions

## Source interpretation

The handwritten note describes a campus food canteen where staff can eat and hang out. It mentions a separate place per department, coin deduction, a concise menu, separate department login, and availability. It also asks for requirements and test cases. These statements are treated as domain requirements, not as instructions that override the user's request to build and package the repository.

## Functional requirements

| ID    | Requirement               | Implemented behavior                                                                                                                 | Verification                                   |
| ----- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| FR-01 | Separate department login | Individual staff accounts have a server-owned department. No shared department password and no client-selected department privilege. | API login / access tests                       |
| FR-02 | Separate department place | Engineering lounge, Science nook and Administration room are restricted to members of that department.                               | SQL and API authorization tests                |
| FR-03 | Shared hangout area       | Common courtyard accepts all signed-in staff.                                                                                        | SQL common-space test                          |
| FR-04 | Concise menu              | Eight sample items, descriptions, categories, allergen notes and integer coin prices; search and filters.                            | API menu; manual UI cases                      |
| FR-05 | Availability              | Serving stock and seating capacity read from D1. UI refreshes every 30 seconds. Zero stock disables adding.                          | SQL/API stock tests                            |
| FR-06 | Coin deduction            | Checkout calculates prices on the server and checks the current database prices again during insertion.                              | SQL price and balance tests                    |
| FR-07 | Complete order recording  | One SQL insert and its triggers atomically record the order, deduct stock, reserve a seat and create a wallet debit.                 | SQL atomicity + concurrent API tests           |
| FR-08 | No duplicate charge       | Per-user idempotency key and payload fingerprint protect checkout retries.                                                           | API simultaneous retry / changed payload tests |
| FR-09 | Track orders              | Staff see their own latest 100 orders; administrators see the latest 100 active orders.                                              | API privacy and lifecycle tests                |
| FR-10 | Cancellation              | Only placed orders may cancel. Refund, stock restoration and seat release happen atomically once.                                    | SQL + simultaneous API cancellation tests      |
| FR-11 | Wallet history            | Latest 100 ledger entries; transactions are append-only and balance is updated by ledger insert.                                     | SQL ledger reconciliation / immutability tests |
| FR-12 | Canteen management        | Administrators adjust stock, issue coin allowances with reasons, and advance placed → preparing → ready → completed.                 | API role, credit, stock and lifecycle tests    |
| FR-13 | Durable state             | D1 database persists independently of browser state and server restarts.                                                             | Local persistence smoke check                  |
| FR-14 | Repository handoff        | README, migration files, setup scripts, requirements, test cases, CI, lockfile and deployment notes.                                 | Source archive review                          |

## Non-functional requirements

- All financial quantities use integer coins. No client price or balance is authoritative.
- Parameterized SQL and server-side ownership/role checks on protected routes.
- Opaque random session cookies, only hashed session tokens in storage, 8-hour expiry, logout revocation.
- Salted PBKDF2-SHA256 password hashes; no plaintext passwords stored. The work factor is 100,000 iterations to fit the current Workers WebCrypto limit. Reassess identity policy for an institutional rollout; campus SSO is a future integration.
- Same-origin, JSON-only mutation requests; SameSite cookies; sign-in throttling by email and edge-provided client IP.
- Responsive single-page working interface, native buttons, labeled fields, keyboard-accessible dialog/select/tabs, clear errors and confirmation messages.
- No external food-image or font dependency. Respect reduced-motion preferences.
- Versioned migrations and an auditable test suite. No schema creation during HTTP requests.

## Explicit product assumptions

1. Staff accounts belong to exactly one department. There is a single canteen administrator role.
2. Coins represent an internal meal allowance, not money. A coin-to-currency exchange rate is deliberately unspecified.
3. An order may contain 1–20 distinct menu entries and 1–10 servings per entry.
4. One dine-in order reserves one seat, regardless of the number of food items. Group bookings and timed reservations are outside this version.
5. A seat stays reserved through placed, preparing and ready; it is released on completed or cancelled. An administrator marks completion when the dining visit is finished. There is no physical occupancy sensor.
6. Cancellation is available only before preparation starts. Prepared orders cannot be refunded in the staff UI.
7. Stock means servings available now. Daily replenishment is an administrator action; it does not reset on a timer.
8. Menu prices, recipes and department configuration are maintained through reviewed catalog/database changes; the UI manages availability, not full menu authoring.
9. The public menu and aggregate seating availability are visible without sign-in. Personal orders, balances and management are protected.
10. Department names, example staff names, seating capacities and allergen descriptions are sample data, not verified campus records.

## Acceptance walkthrough

An Engineering staff member signs in, sees the right department and wallet, adds a thali, chooses the Engineering lounge, and places an order. The order appears once, stock falls by one, wallet falls by 85 and one seat is reserved. A retry does not repeat the charge. Another department cannot cancel or view the order. The user can cancel before preparation for a complete refund; otherwise an administrator progresses it through collection and completion, releasing the seat.
