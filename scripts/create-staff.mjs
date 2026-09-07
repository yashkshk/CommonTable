import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
const [email, name, department, role = 'staff'] = process.argv.slice(2);
if (
  !email ||
  !name ||
  !['engineering', 'science', 'admin'].includes(department) ||
  !['staff', 'admin'].includes(role) ||
  !process.env.STAFF_PASSWORD ||
  process.env.STAFF_PASSWORD.length < 12
)
  throw new Error(
    'Usage: STAFF_PASSWORD=<12+ characters> npm run staff:sql -- email name engineering|science|admin staff|admin',
  );
const q = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const salt = randomBytes(16).toString('hex'),
  hash = `pbkdf2$100000$${salt}$${pbkdf2Sync(process.env.STAFF_PASSWORD, salt, 100000, 32, 'sha256').toString('hex')}`;
mkdirSync('work', { recursive: true });
writeFileSync(
  'work/new-staff.sql',
  `INSERT INTO users(id,name,email,password,department_id,role) VALUES(${[randomUUID(), name, email.trim().toLowerCase(), hash, department, role].map(q).join(',')});\n`,
);
console.log(
  'Created work/new-staff.sql. Apply with Wrangler to your chosen local or remote database, then delete the file. Account starts with zero coins; add an allowance in Manage canteen.',
);
