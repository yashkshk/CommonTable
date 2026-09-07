import { env } from 'cloudflare:workers';
export function database(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error('Database binding missing');
  return db;
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assert(
  value: unknown,
  status: number,
  message: string,
): asserts value {
  if (!value) throw new AppError(status, message);
}
export const userSelect = `SELECT u.id,u.name,u.email,u.department_id AS departmentId,d.name AS departmentName,u.role,u.balance FROM users u JOIN departments d ON d.id=u.department_id`;
export const now = () => Math.floor(Date.now() / 1000);
export async function sha256(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (x) => x.toString(16).padStart(2, '0'),
  ).join('');
}
export async function hashPassword(password: string, salt?: string) {
  salt ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
    },
    key,
    256,
  );
  return `pbkdf2$100000$${salt}$${Array.from(new Uint8Array(bits), (x) => x.toString(16).padStart(2, '0')).join('')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const salt = stored.split('$')[2];
  const actual = await hashPassword(password, salt);
  let diff = actual.length ^ stored.length;
  for (let i = 0; i < actual.length; i++)
    diff |= actual.charCodeAt(i) ^ (stored.charCodeAt(i) || 0);
  return diff === 0;
}
export function sessionToken(request: Request) {
  return (
    request.headers
      .get('cookie')
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('canteen_session='))
      ?.slice(16) || ''
  );
}
export async function currentUser(request: Request, db: D1Database) {
  const token = sessionToken(request);
  if (!token) return null;
  return db
    .prepare(
      `${userSelect} JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires_at>?`,
    )
    .bind(await sha256(token), now())
    .first<import('./catalog').User>();
}
export async function listOrders(db: D1Database, userId?: string) {
  const result = await db
    .prepare(
      `SELECT o.id,o.status,o.total,o.created_at AS createdAt,o.items,s.name AS spaceName,u.name AS userName FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN spaces s ON s.id=o.space_id ${userId ? 'WHERE o.user_id=?' : "WHERE o.status IN ('placed','preparing','ready')"} ORDER BY o.created_at DESC LIMIT 100`,
    )
    .bind(...(userId ? [userId] : []))
    .all<{ items: string }>();
  return result.results.map((row) => ({
    ...row,
    items: JSON.parse(row.items),
  }));
}

// Limit streamed requests too; Content-Length can be absent or untrusted.
export async function boundedBody(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  assert(reader, 400, 'Request body required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new AppError(413, 'Request too large.');
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(buffer);
}
