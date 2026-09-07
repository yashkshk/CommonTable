import { seedSql } from './setup.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
// Demo identities and opening ledgers must never enter the production catalog.
const catalog = seedSql('unused-catalog-password')
  .split('\n')
  .filter(
    (line) =>
      !line.startsWith('INSERT OR IGNORE INTO users') &&
      !line.startsWith('INSERT OR IGNORE INTO ledger'),
  )
  .join('\n');
mkdirSync('work', { recursive: true });
writeFileSync('work/catalog.sql', catalog);
console.log(
  'Created work/catalog.sql: departments, seating areas and menu only. Review menu and allergens before applying remotely.',
);
