# Common Table — Campus Canteen

A complete campus canteen application with individual staff sign-in, department seating, a concise food menu, stock availability, coin wallets, and a kitchen management view.

Built from the supplied handwritten brief. The brief is treated as requirements input; the requested deliverable is this upload-ready repository. No live site, GitHub repository, or real financial service has been created.

## What works

- Browse, search and filter eight example vegetarian menu items; sold-out items cannot be ordered.
- Staff accounts are tied to Engineering, Sciences, or Administration. Department membership is checked on the server.
- Shared seating welcomes all staff; department rooms accept their own members. A dine-in order reserves one seat.
- Checkout validates current stock, space capacity and wallet balance atomically. Retrying the same checkout cannot charge twice.
- View personal orders and wallet activity. Cancel an unprepared order for a full coin refund and restored inventory.
- Administrators manage servings, progress the kitchen queue, and credit staff wallets with an audit reason.
- Durable Cloudflare D1 storage, generated database migrations, accessible UI primitives, responsive layouts and a bundled food image.

## Quick start

Requires **Node.js 24 or newer** and npm. No Cloudflare account is needed to run locally. Run commands inside this repository.

```sh
npm ci
```

Choose your own local demo password. The seed script refuses passwords shorter than 12 characters. It does not automatically load `.env.example`.

PowerShell:

```powershell
$env:DEMO_PASSWORD = Read-Host 'Choose a local demo password (12+ characters)'
npm run db:setup
npm run dev
```

macOS/Linux:

```sh
read -rs DEMO_PASSWORD
export DEMO_PASSWORD
npm run db:setup
npm run dev
```

Open the local URL printed in the terminal, normally `http://localhost:3000`.

| Account                 | Department     | Access        |
| ----------------------- | -------------- | ------------- |
| engineering@campus.test | Engineering    | Staff         |
| science@campus.test     | Sciences       | Staff         |
| admin@campus.test       | Administration | Administrator |

All three local demo accounts use the password you selected and begin with 500 demo coins. Re-running setup preserves existing passwords, balances, stock and orders. It does not reset the database. Demo coins have no cash value and there is no payment gateway.

## Typical walkthrough

1. Sign in as Engineering staff and add a meal to your tray.
2. Choose Engineering lounge or the common table; Sciences seating is restricted.
3. Place an order. Open **My orders** and **Coin wallet** to see the order and deduction.
4. Cancel while the order is **placed** to check the refund, or sign in as the administrator.
5. Under **Manage canteen**, advance the order through preparing → ready → completed. Completion frees its seat.
6. Change available servings or add an allowance to a staff member with a reason.

## Verification

```sh
npm run check
npm audit --audit-level=moderate
```

`check` runs TypeScript, lint, database tests and the deployment build. Lint covers application-owned source; the generated UI catalog and its unused mobile hook are excluded from lint because of upstream baseline findings. TypeScript still checks the entire project.

To run the additional live API suite, keep the development server running and retain your local demo password:

```powershell
$env:TEST_API_BASE = 'http://localhost:3000'
npm run test:api
```

On macOS/Linux use `export TEST_API_BASE=http://localhost:3000`. These integration tests exercise demo accounts and mutate the local test database. They refuse non-local URLs. They do not run automatically in CI; the database suite does.

See [test cases](docs/TEST_CASES.md) and [validation results](docs/VALIDATION.md) for tested behavior and remaining manual checks.

## Repository map

```text
app/                  React interface, layout and HTTP API routes
components/ui/        Generated accessible Base UI / Shadcn primitives
lib/                  Shared types, menu seed, server helpers, optional WebMCP tool
db/schema.ts         Drizzle schema (under db/)
drizzle/              Versioned schema and transaction-rule migrations
scripts/              Local setup and controlled staff provisioning
tests/               Database invariants and live API integration tests
public/               Optimized local food image and favicon
docs/                 Requirements, test cases, architecture, deployment notes
.github/workflows/    CI checks for pushes and pull requests
```

## Upload to GitHub

The ZIP is a **source repository**, not a static website bundle. Extract it and upload the contents of `campus-canteen/` into your repository root, including dotfiles such as `.github`, `.openai` and `.gitignore`.

For an empty GitHub repository, you can use Git instead of browser upload:

```sh
git init -b main
git add .
git commit -m "Build Common Table campus canteen"
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

The working folder supplied with this deliverable may already contain a Git repository; in that case start at adding your remote. Dependencies, build output, local databases, test sessions and credentials are excluded from the ZIP. Keep them excluded when uploading.

## Deployment and operational scope

This app targets **Cloudflare Workers + D1**, using React 19, TypeScript and Vinext. GitHub Pages cannot run its backend. See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for explicit setup, catalog provisioning and real staff account steps.

The generated Sites-compatible framework is currently a beta release. This is a tested implementation and handoff package, not a claim of institution-wide production certification. Browser interaction/visual QA, campus-specific identity policy, backups, monitoring and a staging deployment still need validation in the receiving environment. There is no self-service registration, password-reset email, campus SSO, paid top-up, seat time-slot scheduler, or inventory procurement system.

## Assets and rights

The thali photograph was generated for this project and encoded as a local WebP. Example names, campus details, menu prices, stock and allergens are sample content to replace before use. Third-party packages retain their own licenses. No open-source license is assigned to the original application code; choose one before making reuse permissions public.
