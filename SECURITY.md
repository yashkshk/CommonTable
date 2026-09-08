# Security policy

## Supported versions

Security fixes are targeted at the latest code on `main`. Older snapshots and deployments are not guaranteed backports. Operators are responsible for applying updates and validating their deployment.

## Reporting a vulnerability

Do not open a public issue containing an exploit, real staff data, passwords, cookies, tokens, or other sensitive information.

If GitHub's private **Report a vulnerability** option is available in this repository's Security tab, use it. Otherwise, contact the repository owner through a private contact method listed on their [GitHub profile](https://github.com/yashkshk), and request a private reporting channel before sharing details. The presence of this file does not mean private vulnerability reporting has been enabled.

Include affected commit/version, reproduction steps with synthetic data, expected versus actual behavior, impact, and suggested mitigations if known. Allow the maintainer to investigate and coordinate disclosure. This project does not promise a response SLA or bug bounty.

## Deployment responsibilities

- Use HTTPS, unique individual accounts, and institution-approved recovery/deprovisioning procedures.
- Never deploy local demo identities or commit `.env`, `.dev.vars`, session data, database copies, or credential-bearing SQL.
- Keep the database binding and staff roles under operator control. The browser is not an authority for permissions, totals, stock, or balances.
- Review dependencies, monitor the deployment, and test backups and restores.
- Validate recipe/allergen data and campus operating rules before real use.

The project includes security controls and regression tests but has not received an independent security audit. Vinext is a beta dependency. Internal meal coins do not implement a payment system.
