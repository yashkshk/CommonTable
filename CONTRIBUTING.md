# Contributing to CommonTable

Thank you for helping improve CommonTable. Keep changes focused and explain the user-visible problem they solve.

## Development setup

1. Fork the repository and create a descriptive branch from `main`.
2. Follow the local setup in [README.md](README.md), using Node.js 24 and `npm ci`.
3. Use local demo accounts and synthetic data. Never commit real staff information, tokens, passwords, or database files.
4. Format only the files you change with `npm run format -- <paths>`.

## Before a pull request

- Run `npm run check` and include the relevant results.
- For authentication, checkout, stock, seating, wallet or order changes, run `npm run test:api` against a local development database.
- Add regression coverage for behavioral changes, especially transaction and authorization boundaries.
- For visible interface changes, check keyboard operation, small screens, errors, and loading states; include screenshots when useful.
- Update affected documentation and describe any validation you could not perform.

## Database changes

Update `db/schema.ts`, run `npm run db:generate`, and inspect the generated migration. Keep migrations bounded and schema-focused. Never rewrite a migration already applied to a shared environment; append a new migration. Keep seeds and operational data separate from schema migrations.

Preserve these invariants: no negative balance/stock; no overbooked seats; server-owned prices and permissions; exactly-once checkout effects; and append-only ledger records. Changes to transaction triggers must include failure and concurrency tests where applicable.

## Dependencies and generated code

Keep `package-lock.json` synchronized and use `npm ci` for reproduction. Do not commit `node_modules` or build output. Avoid incidental rewrites of `components/ui/`, which contains generated upstream primitives. Explain dependency upgrades and any license implications.

## Review process

Open a pull request with a concise problem statement, implementation summary, testing evidence, and any migration or operational steps. Keep unrelated refactors separate. The maintainer decides whether and when to merge; no response-time guarantee is made.

By submitting a contribution, you agree that your contribution may be distributed under this project's MIT License. Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issue discussions.
