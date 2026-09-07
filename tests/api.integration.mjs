import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.TEST_API_BASE,
  password = process.env.DEMO_PASSWORD;
if (
  !base ||
  !['localhost', '127.0.0.1'].includes(new URL(base).hostname) ||
  !password
)
  throw new Error(
    'Set TEST_API_BASE to your localhost URL and DEMO_PASSWORD. Run against a development database only.',
  );
async function request(action, body, cookie = '', origin = base) {
  const r = await fetch(`${base}/api/${action}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.text().then((text) => {
      try {
        return JSON.parse(text);
      } catch {
        return { error: text };
      }
    }),
    cookie: r.headers.get('set-cookie'),
  };
}
async function login(email) {
  const r = await request('login', { email, password });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(r.cookie, /HttpOnly/);
  assert.match(r.cookie, /SameSite=Lax/);
  return r.cookie.split(';')[0];
}
test('API authentication, authorization, concurrency, privacy and lifecycle', async (t) => {
  let engineering, science, admin, orderId;
  await t.test('public state contains no private data', async () => {
    const r = await request('state');
    assert.equal(r.status, 200);
    assert.equal(r.data.user, null);
    assert.deepEqual(r.data.orders, []);
    assert.deepEqual(r.data.ledger, []);
    assert.equal(r.data.menu.length, 8);
  });
  await t.test('anonymous writes rejected', async () => {
    assert.equal((await request('orders', {})).status, 401);
    assert.equal((await request('admin')).status, 401);
  });
  await t.test(
    'login binds correct department and hides password',
    async () => {
      engineering = await login('engineering@campus.test');
      science = await login('science@campus.test');
      admin = await login('admin@campus.test');
      const r = await request('state', null, engineering);
      assert.equal(r.data.user.departmentId, 'engineering');
      assert.equal(r.data.user.password, undefined);
    },
  );
  await t.test(
    'staff cannot access admin, credits or stock writes',
    async () => {
      assert.equal((await request('admin', null, engineering)).status, 403);
      assert.equal((await request('credit', {}, engineering)).status, 403);
      assert.equal(
        (await request('stock', { id: 'chai', stock: 100 }, engineering))
          .status,
        403,
      );
    },
  );
  await t.test('cross-origin write blocked', async () => {
    assert.equal(
      (await request('logout', {}, engineering, 'https://attacker.test'))
        .status,
      403,
    );
  });
  await t.test('invalid quantities rejected', async () => {
    for (const quantity of [0, -1, 1.5, 11])
      assert.equal(
        (
          await request(
            'orders',
            {
              items: [{ id: 'chai', quantity }],
              spaceId: null,
              key: randomUUID(),
            },
            engineering,
          )
        ).status,
        400,
      );
  });
  await t.test('wrong-department seat blocked', async () => {
    assert.equal(
      (
        await request(
          'orders',
          {
            items: [{ id: 'chai', quantity: 1 }],
            spaceId: 'science-nook',
            key: randomUUID(),
          },
          engineering,
        )
      ).status,
      409,
    );
  });
  await t.test('concurrent checkout retries charge exactly once', async () => {
    const before = (await request('state', null, engineering)).data;
    const body = {
      items: [{ id: 'chai', quantity: 1 }],
      spaceId: 'engineering-lounge',
      key: randomUUID(),
    };
    const results = await Promise.all([
      request('orders', body, engineering),
      request('orders', body, engineering),
    ]);
    for (const r of results)
      assert.ok([200, 201].includes(r.status), JSON.stringify(r));
    assert.equal(results[0].data.orderId, results[1].data.orderId);
    orderId = results[0].data.orderId;
    const after = (await request('state', null, engineering)).data;
    assert.equal(before.user.balance - after.user.balance, 15);
    assert.equal(
      before.menu.find((i) => i.id === 'chai').stock -
        after.menu.find((i) => i.id === 'chai').stock,
      1,
    );
    assert.equal(after.orders.find((o) => o.id === orderId).total, 15);
    assert.equal(
      (
        await request(
          'orders',
          { ...body, items: [{ id: 'chai', quantity: 2 }] },
          engineering,
        )
      ).status,
      409,
    );
  });
  await t.test('other staff cannot see or cancel private orders', async () => {
    assert.ok(
      !(await request('state', null, science)).data.orders.some(
        (o) => o.id === orderId,
      ),
    );
    assert.equal(
      (
        await request(
          'order-status',
          { id: orderId, status: 'cancelled' },
          science,
        )
      ).status,
      403,
    );
  });
  await t.test('concurrent cancellation refunds once', async () => {
    const before = (await request('state', null, engineering)).data.user
      .balance;
    const results = await Promise.all([
      request(
        'order-status',
        { id: orderId, status: 'cancelled' },
        engineering,
      ),
      request(
        'order-status',
        { id: orderId, status: 'cancelled' },
        engineering,
      ),
    ]);
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.equal(
      (await request('state', null, engineering)).data.user.balance,
      before + 15,
    );
  });
  await t.test('admin can progress queue; staff cannot progress', async () => {
    const r = await request(
      'orders',
      {
        items: [{ id: 'chai', quantity: 1 }],
        spaceId: null,
        key: randomUUID(),
      },
      engineering,
    );
    orderId = r.data.orderId;
    assert.equal(
      (
        await request(
          'order-status',
          { id: orderId, status: 'preparing' },
          engineering,
        )
      ).status,
      403,
    );
    for (const status of ['preparing', 'ready', 'completed'])
      assert.equal(
        (await request('order-status', { id: orderId, status }, admin)).status,
        200,
      );
  });
  await t.test('concurrent last-serving orders cannot oversell', async () => {
    await request('stock', { id: 'lime', stock: 1 }, admin);
    const payload = () => ({
      items: [{ id: 'lime', quantity: 1 }],
      spaceId: null,
      key: randomUUID(),
    });
    const r = await Promise.all([
      request('orders', payload(), engineering),
      request('orders', payload(), science),
    ]);
    assert.equal(r.filter((v) => v.status === 201).length, 1);
    assert.equal(r.filter((v) => v.status === 409).length, 1);
    const winner = r.find((v) => v.status === 201);
    await request(
      'order-status',
      { id: winner.data.orderId, status: 'cancelled' },
      admin,
    );
    await request('stock', { id: 'lime', stock: 0 }, admin);
  });
  await t.test('admin credit is idempotent and auditable', async () => {
    const before = (await request('state', null, engineering)).data.user
      .balance;
    const payload = {
      userId: 'staff-engineering',
      amount: 15,
      reason: 'Integration test meal reimbursement',
      key: randomUUID(),
    };
    assert.equal((await request('credit', payload, admin)).status, 200);
    assert.equal((await request('credit', payload, admin)).status, 200);
    assert.equal(
      (await request('state', null, engineering)).data.user.balance,
      before + 15,
    );
  });
  await t.test('logout revokes session', async () => {
    assert.equal((await request('logout', {}, engineering)).status, 200);
    assert.equal((await request('state', null, engineering)).data.user, null);
  });
});
