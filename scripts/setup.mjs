import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { MENU } from '../lib/catalog.ts';
const sqlString = (value) => "'" + String(value).replaceAll("'", "''") + "'";
export function runSql(file) {
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      'wrangler.json',
      '--file',
      file,
    ],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) throw new Error('Database setup failed.');
}
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `pbkdf2$100000$${salt}$${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`;
}
export function seedSql(password) {
  const departments = [
    ['engineering', 'Engineering'],
    ['science', 'Sciences'],
    ['admin', 'Administration'],
  ];
  const staff = [
    [
      'staff-engineering',
      'Aarav Sharma',
      'engineering@campus.test',
      'engineering',
      'staff',
    ],
    ['staff-science', 'Meera Nair', 'science@campus.test', 'science', 'staff'],
    ['staff-admin', 'Priya Menon', 'admin@campus.test', 'admin', 'admin'],
  ];
  const spaces = [
    [
      'common',
      'The common table',
      'Central courtyard',
      'Meet across departments in our open, light-filled courtyard.',
      null,
      40,
    ],
    [
      'engineering-lounge',
      'Engineering lounge',
      'East wing · ground floor',
      'A dedicated spot to unwind and catch up with your team.',
      'engineering',
      20,
    ],
    [
      'science-nook',
      'The science nook',
      'West wing · garden side',
      'A quieter corner for the Sciences department.',
      'science',
      16,
    ],
    [
      'staff-room',
      'Administration room',
      'Main building · first floor',
      'A comfortable lunch space for administrative staff.',
      'admin',
      12,
    ],
  ];
  return [
    ...departments.map(
      (d) =>
        `INSERT OR IGNORE INTO departments(id,name) VALUES(${d.map(sqlString).join(',')});`,
    ),
    ...staff.map(
      (s) =>
        `INSERT OR IGNORE INTO users(id,name,email,department_id,role,password) VALUES(${[...s, passwordHash(password)].map(sqlString).join(',')});`,
    ),
    ...staff.map(
      (s) =>
        `INSERT OR IGNORE INTO ledger(id,user_id,amount,description) VALUES(${sqlString('opening:' + s[0])},${sqlString(s[0])},500,'Opening meal allowance');`,
    ),
    ...spaces.map(
      (s) =>
        `INSERT OR IGNORE INTO spaces(id,name,location,description,department_id,capacity) VALUES(${s.map((v) => (v === null ? 'NULL' : typeof v === 'number' ? v : sqlString(v))).join(',')});`,
    ),
    ...MENU.map(
      (m) =>
        `INSERT OR IGNORE INTO menu(id,name,description,category,allergens,price,stock) VALUES(${[m.id, m.name, m.description, m.category, m.allergens, m.price, m.stock].map((v) => (typeof v === 'number' ? v : sqlString(v))).join(',')});`,
    ),
    'PRAGMA optimize;',
  ].join('\n');
}
if (process.argv[1]?.endsWith('setup.mjs')) {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      'Set DEMO_PASSWORD to a unique password of at least 12 characters before running setup.',
    );
  const migrate = spawnSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'migrations',
      'apply',
      'DB',
      '--local',
      '--config',
      'wrangler.json',
    ],
    { stdio: 'inherit', env: { ...process.env, CI: 'true' } },
  );
  if (migrate.status !== 0) process.exit(1);
  mkdirSync('work', { recursive: true });
  const seedFile = 'work/seed.local.sql';
  writeFileSync(seedFile, seedSql(password));
  try {
    runSql(seedFile);
  } finally {
    const { unlinkSync } = await import('node:fs');
    unlinkSync(seedFile);
  }
  console.log(
    'Local setup complete. Accounts: engineering@campus.test, science@campus.test, admin@campus.test. Use your DEMO_PASSWORD. Re-running preserves existing accounts and balances.',
  );
}
