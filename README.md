# CommonTable

**Department-aware campus dining, with transactional ordering and staff coin wallets.**

[![Quality checks](https://github.com/yashkshk/CommonTable/actions/workflows/ci.yml/badge.svg)](https://github.com/yashkshk/CommonTable/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-43853d.svg)](.nvmrc)

CommonTable brings menus, department seating, meal allowances, and kitchen operations into one application. Staff can order meals and track their coins; administrators manage availability, allowances, and the kitchen queue.

[Getting started](#getting-started) · [Architecture](docs/ARCHITECTURE.md) · [Deployment](docs/DEPLOYMENT.md) · [Test coverage](docs/TEST_CASES.md) · [Contributing](CONTRIBUTING.md)

## Features

- **Staff access:** individual accounts with server-enforced department membership and administrator permissions.
- **Menu and availability:** searchable, categorized dishes with prices, allergen notes, and serving counts.
- **Department seating:** restricted department rooms and a shared dining area, with capacity checked at checkout.
- **Transactional checkout:** one atomic operation records an order, deducts stock, reserves a seat, and debits the wallet.
- **Retry protection:** checkout keys and request fingerprints prevent duplicate charges.
- **Order lifecycle:** placed → preparing → ready → completed; cancellation before preparation restores coins and stock.
- **Auditable wallets:** append-only debit and credit records, with administrator-issued allowances.
- **Kitchen management:** order queue, serving updates, and staff wallet credits.

## Technology

| Layer               | Implementation                                            |
| ------------------- | --------------------------------------------------------- |
| Interface           | React 19, TypeScript, Tailwind CSS                        |
| UI primitives       | Base UI / Shadcn, Lucide icons                            |
| Application runtime | Vinext on Cloudflare Workers                              |
| Persistence         | Cloudflare D1 / SQLite                                    |
| Schema management   | Drizzle-generated migrations and SQL transaction triggers |
| Verification        | TypeScript, Oxlint, Node.js test runner, GitHub Actions   |

Vinext is a beta dependency. Evaluate its support model before an institutional rollout. This project targets Workers + D1; GitHub Pages cannot host the backend.

## Getting started

### Prerequisites

- Node.js **24 or newer**; `.nvmrc` selects the supported development major.
- npm and Git.
- A Cloudflare account is required for deployment, **not** for local development.

### 1. Clone and install

```sh
git clone https://github.com/yashkshk/CommonTable.git
cd CommonTable
npm ci
```

### 2. Initialize the local database

Choose a unique local demo password of at least 12 characters. Setup scripts read shell environment variables; copying `.env.example` alone does not configure them.

**PowerShell**

```powershell
$env:DEMO_PASSWORD = Read-Host 'Choose a local demo password (12+ characters)'
npm run db:setup
npm run dev
```

**Bash**

```bash
read -rsp 'Choose a local demo password (12+ characters): ' DEMO_PASSWORD
printf '\n'
export DEMO_PASSWORD
npm run db:setup
npm run dev
```

Open the URL printed by the development server, normally `http://localhost:3000`.

### 3. Sign in

| Local account             | Department     | Role          |
| ------------------------- | -------------- | ------------- |
| `engineering@campus.test` | Engineering    | Staff         |
| `science@campus.test`     | Sciences       | Staff         |
| `admin@campus.test`       | Administration | Administrator |

Each account uses your chosen `DEMO_PASSWORD` and begins with **500 demo coins**. Setup is repeatable: existing passwords, balances, inventory, and orders are preserved. Changing `DEMO_PASSWORD` and rerunning setup does not reset existing accounts.

These accounts are for local development only. Coins are an internal meal allowance with no cash value; there is no payment gateway.

### Try the core workflow

1. Sign in as Engineering staff, add a meal, and select Engineering lounge or the common table.
2. Place an order and inspect **My orders** and **Coin wallet**.
3. Cancel while the order is still placed to verify its refund, or sign in as the administrator.
4. In **Manage canteen**, move the order through preparation, ready, and completed.
5. Update serving availability or issue a staff allowance with a reason.

## Commands

| Command                                                   | Purpose                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                                             | Start the development server                                        |
| `npm run db:setup`                                        | Apply local migrations and seed demo accounts/catalog               |
| `npm run check`                                           | Type-check, lint, run database tests, and build                     |
| `npm run test:api`                                        | Run the live API suite against a local server                       |
| `npm run build`                                           | Build the Worker, SSR output, and client assets                     |
| `npm start`                                               | Preview the build using the same local D1 persistence directory     |
| `npm run db:generate`                                     | Generate a migration after schema changes                           |
| `npm run catalog:sql`                                     | Generate catalog SQL without demo identities                        |
| `npm run staff:sql -- <email> <name> <department> <role>` | Generate reviewed staff-provisioning SQL; requires `STAFF_PASSWORD` |
| `npm run format -- <paths>`                               | Format selected source files                                        |

## Testing

```sh
npm run check
npm audit --audit-level=moderate
```

The automated coverage includes **19 database scenarios** and **14 live API scenarios**, covering authorization, wallet reconciliation, stock/capacity enforcement, refunds, simultaneous checkout retries, and simultaneous final-serving purchases.

For API tests, keep a local server running and set `TEST_API_BASE` in the same shell as `DEMO_PASSWORD`:

```powershell
$env:TEST_API_BASE = 'http://localhost:3000'
npm run test:api
```

In Bash, use `export TEST_API_BASE=http://localhost:3000`. These tests mutate local demo data and refuse remote URLs. The API suite is a separate check; CI runs the database suite as part of `npm run check`.

Lint covers application-owned code. The generated UI catalog and its upstream mobile hook are excluded from lint; TypeScript still checks the entire project. See the [test matrix](docs/TEST_CASES.md) and dated [validation report](docs/VALIDATION.md) for executed checks and remaining manual coverage.

## Architecture

```text
Browser / React interface
           │ same-origin HTTP + staff session
           ▼
Cloudflare Worker / API
           │ validated, parameterized statements
           ▼
Cloudflare D1 / SQLite
  ├── staff, sessions, departments and spaces
  ├── menu inventory and order snapshots
  └── transactional triggers and append-only wallet ledger
```

The browser never supplies an authoritative balance, role, or charged total. Database triggers recheck stock, prices, balance, and seating before applying checkout side effects. A failed operation rolls back the entire statement. One dine-in order reserves one seat until the visit is marked completed or the order is cancelled.

See [architecture and API contracts](docs/ARCHITECTURE.md) and [requirements](docs/REQUIREMENTS.md).

## Project structure

```text
app/                    Application UI, layout and HTTP routes
components/             Canteen management view and generated UI primitives
lib/                    Shared models, API client, server helpers and WebMCP adapter
db/                     Drizzle schema and database types
drizzle/                Versioned SQL migrations and schema snapshots
scripts/                Local setup and controlled provisioning
tests/                  Database and live API integration tests
public/                 Local image assets and favicon
docs/                   Requirements, architecture, deployment and test records
.github/                CI, dependency updates, ownership and contribution templates
```

## Deployment

Follow the [deployment guide](docs/DEPLOYMENT.md) to create a D1 database, apply migrations, provision real staff, and deploy the built Worker. The all-zero database ID in `wrangler.json` is a local placeholder. Do not seed demo accounts in production.

No hosted deployment is included. Before campus rollout, complete staging/browser acceptance checks and define identity recovery, account deprovisioning, backup, monitoring, and data-retention procedures.

### Current scope

- Availability refreshes every 30 seconds and is rechecked during checkout.
- Order history, wallet history, and the active queue display at most 100 entries.
- Group/time-slot reservations, SSO, self-service password recovery, paid top-ups, and procurement are outside this version.
- Menu descriptions, allergens, campus details, and staff names are sample data to replace and verify.
- Browser interaction, accessibility, load, and WebMCP-enabled browser acceptance checks remain documented follow-up work.

## Contributing and security

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Use the issue templates for reproducible bugs and scoped feature proposals.

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md); do not post credentials or exploitable details in a public issue.

## License and attribution

Licensed under the [MIT License](LICENSE). Third-party dependencies retain their respective licenses. The bundled food image was generated for this project; attribution details are recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
