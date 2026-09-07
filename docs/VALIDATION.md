# Validation report

Validated on 7 September 2026 using Node.js 24.15.0 on Windows.

| Check                                     | Result                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| TypeScript (`npm run typecheck`)          | Passed                                                                                                |
| Application lint (`npm run lint`)         | Passed                                                                                                |
| Database suite (`npm test`)               | 19 of 19 scenarios passed                                                                             |
| Live API suite against final built Worker | 14 of 14 scenarios passed; runner reports 15 including parent                                         |
| Deployment build (`npm run build`)        | Passed; Worker, SSR and client assets emitted                                                         |
| Drizzle schema consistency                | No schema changes pending                                                                             |
| Dependency audit                          | 0 known vulnerabilities across 566 audited packages at validation time                                |
| Built homepage                            | HTTP 200                                                                                              |
| Bundled WebP image                        | HTTP 200; approximately 274 KiB                                                                       |
| Built response headers                    | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` verified                                   |
| Oversized API payload                     | HTTP 413 verified                                                                                     |
| Persistent local data                     | Preserved through development restarts and built Worker startup using explicit `.wrangler/state` path |
| Production catalog generator              | Generated catalog SQL contains no demo users or opening allowance rows                                |

The live API suite covers authentication, role and department authorization, private data isolation, simultaneous checkout retries, simultaneous cancellation, the final serving race, idempotent credits and logout. See TEST_CASES.md for the full matrix.

## Resolved issues during validation

- Updated vulnerable generated dependencies and their compatible peers; npm audit reports zero known findings.
- Corrected D1 status-update success detection to account for trigger side effects, ensuring successful refunds return success.
- Set the built preview's persistence directory explicitly so it uses the initialized local database.
- Bounded and consumed request bodies before early rejection to preserve local Worker keep-alive behavior after a denied cross-origin write.
- Added response middleware after confirming configuration-only headers did not cover the built dynamic route.

## Honest limits

No browser clicking, screenshot comparison, mobile-device test, assistive-technology audit or real WebMCP browser contract test was performed. The manual matrix identifies these as pending. No remote deployment, GitHub Actions execution, Linux execution, load test or institutional security certification is claimed. CI configuration is supplied for the receiving repository.

Vinext emits non-failing upstream notices about beta route classification, plugin build timings and the legacy middleware naming convention. The build and built Worker checks pass. The generated UI catalog is excluded from lint because of upstream baseline findings; application-owned code is linted, and the entire project is type-checked.

The provided source ZIP excludes local database files, local passwords, sessions, dependencies, build output and Git internals. It includes a lockfile, versioned migrations, CI, setup scripts and operational documentation. A dependency audit is a point-in-time check, not a security guarantee.
