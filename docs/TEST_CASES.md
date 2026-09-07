# Test cases and execution record

## Automated database tests — 19 scenarios

Run `npm test`. Each case creates an isolated in-memory SQLite database and executes the actual versioned migrations and triggers.

| ID    | Scenario                                   | Expected result                                 | Status |
| ----- | ------------------------------------------ | ----------------------------------------------- | ------ |
| DB-01 | Buy two thalis                             | One order, 170-coin debit, stock minus two      | Passed |
| DB-02 | Order above balance                        | No order, charge or stock change                | Passed |
| DB-03 | Purchase final serving then another        | First succeeds; second rejected; no overselling | Passed |
| DB-04 | Order into another department's room       | Rejected; own room accepted                     | Passed |
| DB-05 | All departments use common space           | Accepted for each department                    | Passed |
| DB-06 | Reserve final seat then another            | Second rejected without charge                  | Passed |
| DB-07 | Cancel then cancel again                   | One refund and stock restoration only           | Passed |
| DB-08 | Skip kitchen stage / cancel prepared meal  | Invalid transitions rejected                    | Passed |
| DB-09 | Complete dine-in order                     | Seat available for next order                   | Passed |
| DB-10 | Cancel dine-in order                       | Seat available for next order                   | Passed |
| DB-11 | Reuse checkout key                         | Unique constraint prevents duplicate charge     | Passed |
| DB-12 | Tamper with price or total                 | Rejected before charge                          | Passed |
| DB-13 | Quantity 0, negative, fraction or above 10 | Rejected without mutation                       | Passed |
| DB-14 | Unknown menu item / unknown space          | Rejected                                        | Passed |
| DB-15 | Credit wallet then rewrite/delete ledger   | Balance credited once; ledger immutable         | Passed |
| DB-16 | Purchases and cancellation reconciliation  | Balance equals sum of ledger                    | Passed |
| DB-17 | Run seed again                             | Existing wallet, orders and inventory preserved | Passed |
| DB-18 | Change menu after purchase                 | Purchase snapshot and total unchanged           | Passed |
| DB-19 | Duplicate item lines                       | Rejected without stock loss                     | Passed |

## Live API integration tests — 14 scenarios

Run `npm run test:api` with `TEST_API_BASE` and `DEMO_PASSWORD` against the local application. The Node runner also counts the parent test, reporting 15 passes. The test suite intentionally mutates demo data and rejects non-local targets.

| ID     | Scenario                                   | Expected result                                                          | Status |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------ | ------ |
| API-01 | Read anonymous state                       | Public menu; no private user, orders or wallet                           | Passed |
| API-02 | Anonymous protected request                | 401                                                                      | Passed |
| API-03 | Sign in each department                    | Correct membership; HttpOnly/SameSite cookie; no password in response    | Passed |
| API-04 | Staff calls admin/stock/credit             | 403                                                                      | Passed |
| API-05 | Cross-origin write                         | 403                                                                      | Passed |
| API-06 | Invalid item quantities                    | 400                                                                      | Passed |
| API-07 | Wrong-department seating                   | 409 without charge                                                       | Passed |
| API-08 | Two concurrent requests, same checkout key | Same order; one charge and one stock deduction; changed payload rejected | Passed |
| API-09 | Read/cancel another user's order           | Not visible; 403 on cancellation                                         | Passed |
| API-10 | Two concurrent cancellations               | Exactly one success and one refund                                       | Passed |
| API-11 | Staff/admin kitchen progression            | Staff forbidden; admin valid sequence succeeds                           | Passed |
| API-12 | Two concurrent buyers, one serving         | One order succeeds and one fails                                         | Passed |
| API-13 | Retry administrator credit                 | Credited once and visible in ledger                                      | Passed |
| API-14 | Logout then reuse cookie                   | Session revoked; anonymous state                                         | Passed |

## Manual acceptance matrix — not yet executed

These are review cases for the receiving team. They are deliberately not marked as passed without browser testing.

| ID    | Area                 | Steps and expected result                                                                    |
| ----- | -------------------- | -------------------------------------------------------------------------------------------- |
| UI-01 | Sign-in dialog       | Open, tab through email/password/submit, close with Escape; focus returns to trigger.        |
| UI-02 | Invalid credentials  | Submit wrong password; readable generic error; password stays masked.                        |
| UI-03 | Menu category        | Choose each category; matching dishes only; reset All items.                                 |
| UI-04 | Search               | Find by name and description; no-match screen offers reset.                                  |
| UI-05 | Quantity             | Add, increment, decrement; zero removes line; maximum stock/10 respected.                    |
| UI-06 | Sold out             | Item is clearly unavailable and cannot be added.                                             |
| UI-07 | Tray totals          | Multiple prices and quantities sum correctly; insufficient balance disables checkout.        |
| UI-08 | Session expiry       | Expire session, attempt checkout; no charge; user can sign in again.                         |
| UI-09 | Restricted space     | Another department's card is disabled; permitted room can be selected.                       |
| UI-10 | Full space           | Last seat taken from second browser; checkout fails without debit.                           |
| UI-11 | Stock race           | Another browser buys last serving; stale cart is rejected with useful message.               |
| UI-12 | Order status         | Administrator advances queue; staff sees status after refresh, including ready instructions. |
| UI-13 | Wallet               | Debit, cancellation credit and administrator allowance displayed with timestamp.             |
| UI-14 | Network failure      | Disconnect before checkout; error is visible, tray retained. Retry same request key safely.  |
| UI-15 | Small viewport       | At 360px/390px, cards stack, tray is reachable and navigation scrolls without clipping.      |
| UI-16 | Tablet/desktop       | At 768px, 1024px and 1440px, menu and tray remain readable.                                  |
| UI-17 | 200% text zoom       | No controls disappear; content reflows and can scroll.                                       |
| UI-18 | Keyboard             | Skip link, tabs, filters, select, quantity controls and submit are usable without mouse.     |
| UI-19 | Assistive technology | Dialog title, field labels, live messages, vegetarian marker and image alt announced.        |
| UI-20 | Reduced motion       | System preference suppresses smooth scrolling/transition effects.                            |
| UI-21 | Loading/failure      | Slow or failed state request cannot place an order using seed-only content.                  |
| UI-22 | Admin credit         | Invalid amount/reason rejected; correct staff credited; personal wallet unaffected.          |
| UI-23 | Long content         | Long staff/menu names and messages wrap without covering actions.                            |
| UI-24 | Real deployment      | HTTPS cookie is Secure; public API reveals no personal data; headers are present.            |
| UI-25 | WebMCP               | Supported browser registers stage tool, validates input, updates tray, and never charges.    |

## Further institution-specific testing

Peak lunch-time load, accessibility audit, independent security review, backup/restore, actual campus network behavior, password-recovery/deprovisioning procedures, and real recipe/allergen data must be assessed for the target deployment. This matrix documents expected coverage without claiming that every possible test case has been executed.
