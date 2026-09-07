import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  index,
  check,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
export const departments = sqliteTable('departments', {
  id: text().primaryKey(),
  name: text().notNull(),
});
export const users = sqliteTable(
  'users',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    password: text().notNull(),
    departmentId: text('department_id')
      .notNull()
      .references(() => departments.id),
    role: text().notNull().default('staff'),
    balance: integer().notNull().default(0),
  },
  (t) => [
    check('balance_nonnegative', sql`${t.balance} >= 0`),
    check('role_valid', sql`${t.role} IN ('staff','admin')`),
  ],
);
export const sessions = sqliteTable(
  'sessions',
  {
    hash: text().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('idx_sessions_expiry').on(t.expiresAt)],
);
export const loginAttempts = sqliteTable('login_attempts', {
  key: text().primaryKey(),
  count: integer().notNull(),
  resetAt: integer('reset_at').notNull(),
});
export const spaces = sqliteTable(
  'spaces',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    location: text().notNull(),
    description: text().notNull(),
    departmentId: text('department_id').references(() => departments.id),
    capacity: integer().notNull(),
  },
  (t) => [check('capacity_positive', sql`${t.capacity}>0`)],
);
export const menu = sqliteTable(
  'menu',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    description: text().notNull(),
    category: text().notNull(),
    allergens: text().notNull(),
    price: integer().notNull(),
    stock: integer().notNull(),
  },
  (t) => [
    check('stock_nonnegative', sql`${t.stock}>=0`),
    check('price_positive', sql`${t.price}>0`),
  ],
);
export const orders = sqliteTable(
  'orders',
  {
    id: text().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    requestKey: text('request_key').notNull(),
    fingerprint: text().notNull(),
    spaceId: text('space_id').references(() => spaces.id),
    items: text().notNull(),
    total: integer().notNull(),
    status: text().notNull().default('placed'),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('idx_orders_idempotency').on(t.userId, t.requestKey),
    index('idx_orders_user_created').on(t.userId, t.createdAt),
    index('idx_orders_status_space').on(t.status, t.spaceId),
    check('order_total_positive', sql`${t.total}>0`),
    check(
      'order_status_valid',
      sql`${t.status} IN ('placed','preparing','ready','completed','cancelled')`,
    ),
  ],
);
export const ledger = sqliteTable(
  'ledger',
  {
    id: text().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    amount: integer().notNull(),
    description: text().notNull(),
    actorId: text('actor_id').references(() => users.id),
    createdAt: integer('created_at')
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index('idx_ledger_user_created').on(t.userId, t.createdAt)],
);
