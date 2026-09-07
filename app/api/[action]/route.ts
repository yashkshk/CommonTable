import {
  AppError,
  assert,
  boundedBody,
  currentUser,
  database,
  hashPassword,
  listOrders,
  now,
  sessionToken,
  sha256,
  userSelect,
  verifyPassword,
} from '@/lib/server';
import type { MenuItem } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
const json = (
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
async function handle(request: Request) {
  try {
    const db = database(),
      action = new URL(request.url).pathname.split('/').pop();
    if (request.method === 'GET') {
      const user = await currentUser(request, db);
      if (action === 'state') {
        const [menu, spaces, orders, ledger] = await Promise.all([
          db.prepare('SELECT * FROM menu ORDER BY rowid').all(),
          db
            .prepare(
              `SELECT s.id,s.name,s.location,s.description,s.department_id AS departmentId,s.capacity,(SELECT count(*) FROM orders o WHERE o.space_id=s.id AND o.status IN ('placed','preparing','ready')) AS occupied FROM spaces s ORDER BY s.department_id IS NOT NULL,s.name`,
            )
            .all(),
          user ? listOrders(db, user.id) : [],
          user
            ? db
                .prepare(
                  'SELECT id,amount,description,created_at AS createdAt FROM ledger WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100',
                )
                .bind(user.id)
                .all()
            : { results: [] },
        ]);
        return json({
          user,
          menu: menu.results,
          spaces: spaces.results,
          orders,
          ledger: ledger.results,
        });
      }
      if (action === 'admin') {
        assert(user, 401, 'Please sign in.');
        assert(user.role === 'admin', 403, 'Administrator access required.');
        return json({
          orders: await listOrders(db),
          staff: (await db.prepare(`${userSelect} ORDER BY u.name`).all())
            .results,
        });
      }
      throw new AppError(404, 'Not found.');
    }
    assert(request.method === 'POST', 405, 'Method not allowed.');
    // Read a bounded body before early rejection so local Worker keep-alive connections remain reusable.
    const raw = await boundedBody(request);
    // Same-origin JSON-only writes prevent cross-site form and credentialed fetch attacks.
    const origin = request.headers.get('origin');
    assert(
      !origin || origin === new URL(request.url).origin,
      403,
      'Cross-site request rejected.',
    );
    assert(
      request.headers.get('sec-fetch-site') !== 'cross-site',
      403,
      'Cross-site request rejected.',
    );
    assert(
      request.headers.get('content-type')?.startsWith('application/json'),
      415,
      'JSON required.',
    );
    assert(
      Number(request.headers.get('content-length') || 0) <= 16384,
      413,
      'Request too large.',
    );
    assert(raw.length <= 16384, 413, 'Request too large.');
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AppError(400, 'Invalid JSON.');
    }
    assert(
      body && typeof body === 'object' && !Array.isArray(body),
      400,
      'Invalid request.',
    );
    if (action === 'login') {
      assert(
        typeof body.email === 'string' &&
          body.email.length <= 254 &&
          typeof body.password === 'string' &&
          body.password.length >= 8 &&
          body.password.length <= 200,
        400,
        'Enter a valid staff email and password.',
      );
      const email = body.email.trim().toLowerCase();
      const keys = [
        `email:${await sha256(email)}`,
        `ip:${await sha256(request.headers.get('cf-connecting-ip') || 'local')}`,
      ];
      // Increment before password verification so concurrent attempts count against the same limit.
      for (const key of keys) {
        const attempt = await db
          .prepare(
            `INSERT INTO login_attempts(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count`,
          )
          .bind(key, now() + 900, now(), now())
          .first<{ count: number }>();
        assert(
          attempt && attempt.count <= (key.startsWith('ip:') ? 100 : 10),
          429,
          'Too many sign-in attempts. Try again in 15 minutes.',
        );
      }
      const account = await db
        .prepare('SELECT id,password FROM users WHERE email=?')
        .bind(email)
        .first<{ id: string; password: string }>();
      const valid = await verifyPassword(
        body.password,
        account?.password ||
          (await hashPassword(
            'dummy-password',
            '00000000000000000000000000000000',
          )),
      );
      assert(account && valid, 401, 'Email or password is incorrect.');
      const token = Array.from(
        crypto.getRandomValues(new Uint8Array(32)),
        (x) => x.toString(16).padStart(2, '0'),
      ).join('');
      await db.batch([
        db.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(now()),
        db
          .prepare('DELETE FROM login_attempts WHERE reset_at<=? OR key=?')
          .bind(now(), keys[0]),
        db
          .prepare(
            'INSERT INTO sessions(hash,user_id,expires_at) VALUES(?,?,?)',
          )
          .bind(await sha256(token), account.id, now() + 28800),
      ]);
      return json({ ok: true }, 200, {
        'Set-Cookie': `canteen_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
      });
    }
    if (action === 'logout') {
      await db
        .prepare('DELETE FROM sessions WHERE hash=?')
        .bind(await sha256(sessionToken(request)))
        .run();
      return json({ ok: true }, 200, {
        'Set-Cookie':
          'canteen_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
      });
    }
    const user = await currentUser(request, db);
    assert(user, 401, 'Please sign in to continue.');
    if (action === 'orders') {
      assert(
        typeof body.key === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(body.key),
        400,
        'Invalid checkout key.',
      );
      assert(
        Array.isArray(body.items) &&
          body.items.length > 0 &&
          body.items.length <= 20,
        400,
        'Choose between 1 and 20 menu items.',
      );
      assert(
        body.spaceId === null ||
          (typeof body.spaceId === 'string' && body.spaceId.length <= 80),
        400,
        'Invalid dining space.',
      );
      const ids = new Set<string>();
      for (const item of body.items) {
        assert(
          item &&
            typeof item.id === 'string' &&
            item.id.length <= 80 &&
            Number.isInteger(item.quantity) &&
            item.quantity >= 1 &&
            item.quantity <= 10 &&
            !ids.has(item.id),
          400,
          'Each menu item needs a quantity from 1 to 10, without duplicates.',
        );
        ids.add(item.id);
      }
      const fingerprint = await sha256(
        JSON.stringify({
          items: [...body.items]
            .map((i: { id: string; quantity: number }) => ({
              id: i.id,
              quantity: i.quantity,
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
          spaceId: body.spaceId,
        }),
      );
      const existing = await db
        .prepare(
          'SELECT id,fingerprint FROM orders WHERE user_id=? AND request_key=?',
        )
        .bind(user.id, body.key)
        .first<{ id: string; fingerprint: string }>();
      if (existing) {
        assert(
          existing.fingerprint === fingerprint,
          409,
          'This checkout key belongs to a different order.',
        );
        return json({ orderId: existing.id });
      }
      const rows = (
        await db
          .prepare(
            `SELECT * FROM menu WHERE id IN (${[...ids].map(() => '?').join(',')})`,
          )
          .bind(...ids)
          .all<MenuItem>()
      ).results;
      assert(rows.length === ids.size, 400, 'A menu item was not found.');
      const items = body.items.map((i: { id: string; quantity: number }) => {
        const m = rows.find((r) => r.id === i.id)!;
        return { id: m.id, name: m.name, price: m.price, quantity: i.quantity };
      });
      const total = items.reduce(
        (sum: number, i: { price: number; quantity: number }) =>
          sum + i.price * i.quantity,
        0,
      );
      const id = crypto.randomUUID();
      try {
        await db
          .prepare(
            'INSERT INTO orders(id,user_id,request_key,fingerprint,space_id,items,total) VALUES(?,?,?,?,?,?,?)',
          )
          .bind(
            id,
            user.id,
            body.key,
            fingerprint,
            body.spaceId,
            JSON.stringify(items),
            total,
          )
          .run();
      } catch (e) {
        const repeat = await db
          .prepare(
            'SELECT id,fingerprint FROM orders WHERE user_id=? AND request_key=?',
          )
          .bind(user.id, body.key)
          .first<{ id: string; fingerprint: string }>();
        if (repeat && repeat.fingerprint === fingerprint)
          return json({ orderId: repeat.id });
        throw e;
      }
      return json({ orderId: id }, 201);
    }
    if (action === 'order-status') {
      assert(
        typeof body.id === 'string' && typeof body.status === 'string',
        400,
        'Invalid order update.',
      );
      const order = await db
        .prepare('SELECT user_id,status FROM orders WHERE id=?')
        .bind(body.id)
        .first<{ user_id: string; status: string }>();
      assert(order, 404, 'Order not found.');
      assert(
        user.role === 'admin' || order.user_id === user.id,
        403,
        'This order belongs to another staff member.',
      );
      if (body.status === 'cancelled')
        assert(
          order.status === 'placed',
          409,
          'Only an order that has not entered preparation can be cancelled.',
        );
      else {
        assert(user.role === 'admin', 403, 'Administrator access required.');
        assert(
          (
            {
              placed: 'preparing',
              preparing: 'ready',
              ready: 'completed',
            } as Record<string, string>
          )[order.status] === body.status,
          409,
          'Invalid order status change.',
        );
      }
      const result = await db
        .prepare('UPDATE orders SET status=? WHERE id=? AND status=?')
        .bind(body.status, body.id, order.status)
        .run();
      assert(
        result.meta.changes > 0,
        409,
        'Order changed. Refresh and try again.',
      );
      return json({ ok: true });
    }
    assert(user.role === 'admin', 403, 'Administrator access required.');
    if (action === 'stock') {
      assert(
        typeof body.id === 'string' &&
          Number.isInteger(body.stock) &&
          body.stock >= 0 &&
          body.stock <= 10000,
        400,
        'Stock must be a whole number from 0 to 10,000.',
      );
      const r = await db
        .prepare('UPDATE menu SET stock=? WHERE id=?')
        .bind(body.stock, body.id)
        .run();
      assert(r.meta.changes === 1, 404, 'Menu item not found.');
      return json({ ok: true });
    }
    if (action === 'credit') {
      assert(
        typeof body.userId === 'string' &&
          Number.isInteger(body.amount) &&
          body.amount >= 1 &&
          body.amount <= 10000 &&
          typeof body.reason === 'string' &&
          body.reason.trim().length > 0 &&
          body.reason.length <= 120 &&
          typeof body.key === 'string' &&
          /^[a-zA-Z0-9-]{16,80}$/.test(body.key),
        400,
        'Select a staff member, 1–10,000 coins, and a reason.',
      );
      assert(
        await db
          .prepare('SELECT id FROM users WHERE id=?')
          .bind(body.userId)
          .first(),
        404,
        'Staff member not found.',
      );
      const creditId = `credit:${user.id}:${body.key}`;
      const old = await db
        .prepare('SELECT user_id,amount,description FROM ledger WHERE id=?')
        .bind(creditId)
        .first<{ user_id: string; amount: number; description: string }>();
      if (old) {
        assert(
          old.user_id === body.userId &&
            old.amount === body.amount &&
            old.description === body.reason.trim(),
          409,
          'This credit key was already used.',
        );
        return json({ ok: true });
      }
      await db
        .prepare(
          'INSERT INTO ledger(id,user_id,amount,description,actor_id) VALUES(?,?,?,?,?)',
        )
        .bind(creditId, body.userId, body.amount, body.reason.trim(), user.id)
        .run();
      return json({ ok: true });
    }
    throw new AppError(404, 'Not found.');
  } catch (error) {
    if (error instanceof AppError)
      return json({ error: error.message }, error.status);
    const message = error instanceof Error ? error.message : '';
    for (const [match, friendly] of [
      ['INSUFFICIENT_COINS', 'Not enough coins in your wallet.'],
      [
        'OUT_OF_STOCK',
        'An item has sold out. Refresh the menu and adjust your tray.',
      ],
      [
        'SPACE_FULL',
        'That space just filled up. Choose another space or takeaway.',
      ],
      [
        'DEPARTMENT_RESTRICTED',
        'This space is reserved for another department.',
      ],
      ['PRICE_CHANGED', 'Menu prices changed. Refresh and try again.'],
      ['INVALID_TRANSITION', 'This order has changed. Refresh and try again.'],
    ])
      if (message.includes(match)) return json({ error: friendly }, 409);
    console.error('Canteen API failure', message);
    return json(
      {
        error: 'The canteen could not complete your request. Please try again.',
      },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
