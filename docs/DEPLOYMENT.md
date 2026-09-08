# Deployment and handoff

## Target

This is a server-backed Cloudflare Workers application with D1, not a static export. It cannot run on GitHub Pages. The source includes Sites-compatible logical binding metadata but has not been registered or published to Sites. Publishing the source repository does not deploy the application or provision any Cloudflare resources.

## Run the deployment build locally

```sh
npm ci
npm run build
npm start
```

Run local database setup first, as described in the README. `npm start` uses the generated `dist/server/wrangler.json`. Keep `node_modules`, `dist`, `.wrangler`, local passwords and session data out of source control.

## Deploy to your own Cloudflare account

These are operator steps to execute in the receiving account, not actions already performed.

1. Authenticate with `npx wrangler login`.
2. Create a D1 database: `npx wrangler d1 create common-table-production`.
3. In `wrangler.json`, replace `database_id` and `database_name` with the actual returned values and set an available Worker name. Keep the binding named `DB`. The all-zero ID is a local-only placeholder.
4. Apply migrations to the new remote database:

   ```sh
   npx wrangler d1 migrations apply DB --remote --config wrangler.json
   ```

5. Generate the non-user catalog and review the SQL before applying it:

   ```sh
   npm run catalog:sql
   npx wrangler d1 execute DB --remote --config wrangler.json --file work/catalog.sql
   ```

   This inserts departments, spaces and the sample menu; it creates no users or allowances. Replace sample menu descriptions/allergens, capacities and campus names as appropriate. Never run a copied local demo seed against production.

6. Provision an initial administrator with a unique password in the shell:

   ```powershell
   $env:STAFF_PASSWORD = Read-Host 'Choose a unique administrator password (12+ characters)'
   npm run staff:sql -- administrator@your-campus.edu "Canteen Administrator" admin admin
   npx wrangler d1 execute DB --remote --config wrangler.json --file work/new-staff.sql
   Remove-Item -LiteralPath work/new-staff.sql
   Remove-Item Env:STAFF_PASSWORD
   ```

   On macOS/Linux use `read -rs STAFF_PASSWORD; export STAFF_PASSWORD`, followed by the same npm/Wrangler steps, then remove the generated SQL and unset the variable. Do not put a password in an npm argument or commit password-hash SQL files.

7. Provision staff individually with the same script, a real department and `staff` as the final argument. Accounts begin with zero coins; the administrator issues allowances in the management view.
8. Run `npm run check`, then `npm run build` after final configuration changes.
9. Deploy the generated configuration:

   ```sh
   npx wrangler deploy --config dist/server/wrangler.json
   ```

10. Confirm HTTPS sign-in, correct department membership, persistent data, concurrent checkout, cancellation, and administrator-only access in staging before campus rollout. Set backup/restore, logs, ownership and retention procedures for your institution.

The generated build embeds the selected D1 configuration. Rebuild after changing `wrangler.json`; do not edit only the generated `dist` file. The local setup script is explicitly local-only and never sends seed data to a remote database.

## Account maintenance

The `staff:sql` script adds accounts; duplicate emails fail safely. There is no self-service password-reset flow. An authorized operator can replace a user's salted hash and revoke all sessions for that user using a reviewed database change. Do not email or share one password for a whole department. Changing a department is also an authorized database administration action.

## Operational decisions still required

- Institution-approved authentication, recovery and account deprovisioning policies; evaluate campus SSO before a broad rollout.
- Real recipes, allergen verification, opening times and inventory replenishment responsibility.
- Whether meal collection or the end of a dining visit should trigger completion. This version retains a seat until completion; staff should mark it when the visit ends.
- Expected peak load, monitoring and tested recovery procedures. The active queue/history displays the latest 100 records; pagination is a future requirement if this is insufficient.
- Vinext is a beta dependency. Evaluate it against your organization's support requirements.

No remote deployment or browser acceptance test is claimed in this handoff.
