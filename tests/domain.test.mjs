import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { seedSql } from '../scripts/setup.mjs';
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const f of readdirSync('drizzle')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    db.exec(readFileSync(`drizzle/${f}`, 'utf8'));
  db.exec(seedSql('test-only-password'));
  return db;
}
function buy(
  db,
  {
    id = randomUUID(),
    user = 'staff-engineering',
    space = null,
    quantity = 1,
    item = 'thali',
    price = 85,
    key = randomUUID(),
    total = quantity * price,
  } = {},
) {
  db.prepare(
    'INSERT INTO orders(id,user_id,request_key,fingerprint,space_id,items,total) VALUES(?,?,?,?,?,?,?)',
  ).run(
    id,
    user,
    key,
    'test',
    space,
    JSON.stringify([{ id: item, name: 'Meal snapshot', price, quantity }]),
    total,
  );
  return id;
}
const balance = (db) =>
  db.prepare("SELECT balance FROM users WHERE id='staff-engineering'").get()
    .balance;
const stock = (db) =>
  db.prepare("SELECT stock FROM menu WHERE id='thali'").get().stock;
test('checkout atomically debits wallet, deducts stock and records order/ledger', () => {
  const db = setup();
  const id = buy(db, { quantity: 2 });
  assert.equal(balance(db), 330);
  assert.equal(stock(db), 28);
  assert.equal(
    db.prepare('SELECT amount FROM ledger WHERE id=?').get('order:' + id)
      .amount,
    -170,
  );
  db.close();
});
test('insufficient coins rolls back stock, order and ledger', () => {
  const db = setup();
  assert.throws(() => buy(db, { quantity: 6 }), /INSUFFICIENT_COINS/);
  assert.equal(balance(db), 500);
  assert.equal(stock(db), 30);
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n, 0);
  db.close();
});
test('stock cannot oversell and failed order does not charge', () => {
  const db = setup();
  db.exec("UPDATE menu SET stock=1 WHERE id='thali'");
  buy(db);
  assert.throws(() => buy(db), /OUT_OF_STOCK/);
  assert.equal(balance(db), 415);
  assert.equal(stock(db), 0);
  db.close();
});
test('department restriction is enforced in database', () => {
  const db = setup();
  assert.throws(
    () => buy(db, { space: 'science-nook' }),
    /DEPARTMENT_RESTRICTED/,
  );
  assert.equal(balance(db), 500);
  buy(db, { space: 'engineering-lounge' });
  db.close();
});
test('common space accepts staff from every department', () => {
  const db = setup();
  for (const user of ['staff-engineering', 'staff-science', 'staff-admin'])
    buy(db, { user, space: 'common' });
  assert.equal(
    db.prepare("SELECT count(*) AS n FROM orders WHERE space_id='common'").get()
      .n,
    3,
  );
  db.close();
});
test('last seat cannot be overbooked', () => {
  const db = setup();
  db.exec("UPDATE spaces SET capacity=1 WHERE id='common'");
  buy(db, { space: 'common' });
  assert.throws(
    () => buy(db, { space: 'common', user: 'staff-science' }),
    /SPACE_FULL/,
  );
  assert.equal(
    db.prepare("SELECT balance FROM users WHERE id='staff-science'").get()
      .balance,
    500,
  );
  db.close();
});
test('cancellation refunds and restores stock exactly once', () => {
  const db = setup();
  const id = buy(db);
  db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(id);
  assert.equal(balance(db), 500);
  assert.equal(stock(db), 30);
  assert.throws(
    () => db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(id),
    /INVALID_TRANSITION/,
  );
  assert.equal(balance(db), 500);
  db.close();
});
test('only valid kitchen transitions succeed; prepared orders cannot cancel', () => {
  const db = setup();
  const id = buy(db);
  assert.throws(
    () => db.prepare("UPDATE orders SET status='ready' WHERE id=?").run(id),
    /INVALID_TRANSITION/,
  );
  db.prepare("UPDATE orders SET status='preparing' WHERE id=?").run(id);
  assert.throws(
    () => db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(id),
    /INVALID_TRANSITION/,
  );
  db.prepare("UPDATE orders SET status='ready' WHERE id=?").run(id);
  db.prepare("UPDATE orders SET status='completed' WHERE id=?").run(id);
  assert.equal(balance(db), 415);
  db.close();
});
test('completed order releases seat', () => {
  const db = setup();
  db.exec("UPDATE spaces SET capacity=1 WHERE id='common'");
  const id = buy(db, { space: 'common' });
  for (const status of ['preparing', 'ready', 'completed'])
    db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, id);
  buy(db, { space: 'common' });
  db.close();
});
test('cancelled order releases seat', () => {
  const db = setup();
  db.exec("UPDATE spaces SET capacity=1 WHERE id='common'");
  const id = buy(db, { space: 'common' });
  db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(id);
  buy(db, { space: 'common' });
  db.close();
});
test('unique checkout key prevents duplicate charges', () => {
  const db = setup();
  const key = randomUUID();
  buy(db, { key });
  assert.throws(() => buy(db, { key }), /UNIQUE/);
  assert.equal(balance(db), 415);
  assert.equal(stock(db), 29);
  db.close();
});
test('tampered price and total rejected before charge', () => {
  const db = setup();
  assert.throws(() => buy(db, { price: 1 }), /PRICE_CHANGED/);
  assert.throws(() => buy(db, { total: 1 }), /PRICE_CHANGED/);
  assert.equal(balance(db), 500);
  db.close();
});
test('zero, fractional, negative and excessive quantities are rejected', () => {
  const db = setup();
  for (const quantity of [0, 0.5, -1, 11])
    assert.throws(() => buy(db, { quantity }), /OUT_OF_STOCK/);
  assert.equal(balance(db), 500);
  db.close();
});
test('unknown menu item and unknown seating rejected', () => {
  const db = setup();
  assert.throws(() => buy(db, { item: 'missing' }), /OUT_OF_STOCK/);
  assert.throws(() => buy(db, { space: 'missing' }), /DEPARTMENT_RESTRICTED/);
  db.close();
});
test('ledger changes balance once and is immutable', () => {
  const db = setup();
  db.exec(
    "INSERT INTO ledger(id,user_id,amount,description,actor_id) VALUES('topup','staff-engineering',100,'Allowance','staff-admin')",
  );
  assert.equal(balance(db), 600);
  assert.throws(
    () => db.exec("UPDATE ledger SET amount=999 WHERE id='topup'"),
    /LEDGER_IMMUTABLE/,
  );
  assert.throws(
    () => db.exec("DELETE FROM ledger WHERE id='topup'"),
    /LEDGER_IMMUTABLE/,
  );
  db.close();
});
test('balance always equals sum of ledger entries through meal lifecycle', () => {
  const db = setup();
  const first = buy(db);
  buy(db);
  db.prepare("UPDATE orders SET status='cancelled' WHERE id=?").run(first);
  const sum = db
    .prepare(
      "SELECT sum(amount) AS total FROM ledger WHERE user_id='staff-engineering'",
    )
    .get().total;
  assert.equal(balance(db), sum);
  db.close();
});
test('seed rerun preserves orders, balances and stock', () => {
  const db = setup();
  buy(db);
  db.exec(seedSql('another-test-password'));
  assert.equal(balance(db), 415);
  assert.equal(stock(db), 29);
  db.close();
});
test('order history preserves purchased item snapshot after menu edit', () => {
  const db = setup();
  const id = buy(db);
  db.exec("UPDATE menu SET name='New name',price=99 WHERE id='thali'");
  const row = db.prepare('SELECT items,total FROM orders WHERE id=?').get(id);
  assert.equal(JSON.parse(row.items)[0].name, 'Meal snapshot');
  assert.equal(row.total, 85);
  db.close();
});
test('duplicate lines rejected without stock loss', () => {
  const db = setup();
  const item = { id: 'thali', price: 85, quantity: 1 };
  assert.throws(
    () =>
      db
        .prepare(
          'INSERT INTO orders(id,user_id,request_key,fingerprint,items,total) VALUES(?,?,?,?,?,?)',
        )
        .run(
          randomUUID(),
          'staff-engineering',
          randomUUID(),
          'test',
          JSON.stringify([item, item]),
          170,
        ),
    /OUT_OF_STOCK/,
  );
  assert.equal(stock(db), 30);
  db.close();
});
