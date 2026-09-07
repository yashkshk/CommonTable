/* oxlint-disable nextjs/no-img-element -- The local hero is pre-encoded as WebP; no runtime image proxy is needed. */
'use client';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { registerTrayTool } from '@/lib/webmcp';
import { api } from '@/lib/api-client';
import { Admin } from '@/components/canteen-admin';
import {
  ArrowUpRight,
  ArrowRight,
  Utensils,
  Leaf,
  Coffee,
  Soup,
  Sandwich,
  Plus,
  Minus,
  Coins,
  ShoppingBag,
  MapPin,
  Check,
  LogOut,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  MENU,
  type MenuItem,
  type User,
  type Space,
  type Order,
  type LedgerEntry,
} from '@/lib/catalog';
const categories = ['All items', 'Meals', 'Quick bites', 'Beverages'];
const dateLabel = (value: number) =>
  new Date(value * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export default function Home() {
  const [tab, setTab] = useState('menu'),
    [menu, setMenu] = useState<MenuItem[]>(MENU),
    [spaces, setSpaces] = useState<Space[]>([]),
    [user, setUser] = useState<User | null>(null),
    [orders, setOrders] = useState<Order[]>([]),
    [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({}),
    [category, setCategory] = useState('All items'),
    [query, setQuery] = useState(''),
    [login, setLogin] = useState(false),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [spaceId, setSpaceId] = useState('takeaway'),
    [checkoutKey, setCheckoutKey] = useState('');
  async function refresh() {
    const d = await api('state');
    setMenu(d.menu);
    setSpaces(d.spaces);
    setUser(d.user);
    setOrders(d.orders);
    setLedger(d.ledger);
    setLoaded(true);
  }
  useEffect(() => {
    void Promise.resolve()
      .then(refresh)
      .catch((e) => setError(e.message));
    const t = setInterval(() => {
      refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(
    () =>
      registerTrayTool((items) => {
        for (const item of items) {
          const entry = menu.find((m) => m.id === item.id);
          if (!loaded || !entry || entry.stock < item.quantity)
            throw new Error('An item is unavailable.');
        }
        flushSync(() => {
          setCart(Object.fromEntries(items.map((i) => [i.id, i.quantity])));
          setCheckoutKey('');
          setTab('menu');
        });
      }),
    [menu, loaded],
  );
  const lines = menu.filter((i) => cart[i.id]),
    total = lines.reduce((s, i) => s + i.price * cart[i.id], 0),
    count = Object.values(cart).reduce((a, b) => a + b, 0);
  const visible = menu.filter(
    (i) =>
      (category === 'All items' || i.category === category) &&
      `${i.name} ${i.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  function adjust(id: string, delta: number) {
    setCheckoutKey('');
    setCart((p) => ({
      ...p,
      [id]: Math.max(0, Math.min(10, (p[id] || 0) + delta)),
    }));
  }
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    if (!user) {
      setLogin(true);
      return;
    }
    await act(async () => {
      const key = checkoutKey || crypto.randomUUID();
      setCheckoutKey(key);
      const d = await api('orders', {
        items: lines.map((i) => ({ id: i.id, quantity: cart[i.id] })),
        spaceId: spaceId === 'takeaway' ? null : spaceId,
        key,
      });
      setCart({});
      setCheckoutKey('');
      setTab('orders');
      setNotice(
        `Order ${d.orderId.slice(0, 8).toUpperCase()} confirmed. Your meal is on its way.`,
      );
      await refresh();
    });
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="campus-strip">
        <span>GOOD FOOD. BETTER COMPANY.</span>
        <span>
          Made for your campus <Leaf size={13} />
        </span>
      </div>
      <header className="header">
        <Link href="/" className="brand" aria-label="Common Table home">
          <span className="brand-mark">
            <Utensils size={22} />
          </span>
          <span>
            common<span className="brand-light">table</span>
            <small>THE CAMPUS CANTEEN</small>
          </span>
        </Link>
        <div className="header-right">
          <span className="location">
            <MapPin size={16} />
            Campus food court
          </span>
          {user ? (
            <>
              <span className="avatar">
                {user.name
                  .split(' ')
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <div className="identity">
                <strong>{user.name}</strong>
                <small>{user.departmentName}</small>
              </div>
              <button
                className="icon-button"
                aria-label="Sign out"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api('logout', {});
                    setCart({});
                    setSpaceId('takeaway');
                    setTab('menu');
                    await refresh();
                  })
                }
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button className="button dark" onClick={() => setLogin(true)}>
              Staff sign in
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      </header>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(String(v))}
        className="app-tabs"
      >
        <div className="nav-wrap">
          <TabsList className="main-nav" variant="line">
            <TabsTrigger value="menu">
              <Utensils />
              Today’s menu
            </TabsTrigger>
            <TabsTrigger value="spaces">
              <Users />
              Campus spaces
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingBag />
              My orders
            </TabsTrigger>
            <TabsTrigger value="wallet">
              <Coins />
              Coin wallet
            </TabsTrigger>
            {user?.role === 'admin' && (
              <TabsTrigger value="manage">
                <ShieldCheck />
                Manage canteen
              </TabsTrigger>
            )}
          </TabsList>
          <span className="nav-note">
            <span className="status-dot" />
            {loaded
              ? 'Availability updates every 30 sec'
              : 'Connecting to canteen…'}
          </span>
        </div>
        <main id="main">
          {error && (
            <div className="message error" role="alert">
              {error}
              <button
                onClick={() => {
                  setError('');
                  refresh().catch((e) => setError(e.message));
                }}
              >
                Retry
              </button>
            </div>
          )}
          {notice && (
            <output className="message success">
              <Check size={18} />
              {notice}
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice('')}
              >
                ×
              </button>
            </output>
          )}
          <TabsContent value="menu">
            <div className="page-heading">
              <div>
                <p className="eyebrow">YOUR DAILY PIT STOP</p>
                <h1>A little break. A lot to look forward to.</h1>
                <p>Fresh favourites, familiar faces. Pull up a chair.</p>
              </div>
              <span className="heading-stamp">
                <Utensils size={17} />
                Freshly prepared on campus
              </span>
            </div>
            <div className="menu-layout">
              <section>
                <div className="feature">
                  <div className="feature-copy">
                    <span className="feature-label">
                      <span />
                      THE LUNCH EDIT
                    </span>
                    <h2>
                      Big on flavour.
                      <br />
                      Easy on your day.
                    </h2>
                    <p>
                      A comforting vegetarian thali,
                      <br />
                      made for a proper lunch break.
                    </p>
                    <button
                      className="button cream"
                      onClick={() => {
                        setCategory('Meals');
                        document
                          .getElementById('menu-list')
                          ?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                      }}
                    >
                      Explore meals
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <img
                    className="feature-image"
                    src="/thali.webp"
                    width={1536}
                    height={1024}
                    fetchPriority="high"
                    alt="Fresh Indian vegetarian thali on a green table"
                  />
                  <span className="feature-tag">A seat for everyone.</span>
                </div>
                <div id="menu-list" className="menu-title">
                  <div>
                    <h2>What sounds good?</h2>
                    <p>
                      {menu.filter((i) => i.stock > 0).length} fresh picks
                      available today
                    </p>
                  </div>
                  <label className="search">
                    <Search size={17} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Find a favourite"
                      aria-label="Search menu"
                    />
                  </label>
                </div>
                <fieldset className="filter-row" aria-label="Menu category">
                  {categories.map((c) => (
                    <button
                      key={c}
                      aria-pressed={category === c}
                      className={category === c ? 'filter active' : 'filter'}
                      onClick={() => setCategory(c)}
                    >
                      {c === 'All items' ? (
                        <Utensils size={15} />
                      ) : c === 'Meals' ? (
                        <Soup size={16} />
                      ) : c === 'Quick bites' ? (
                        <Sandwich size={16} />
                      ) : (
                        <Coffee size={16} />
                      )}{' '}
                      {c}
                    </button>
                  ))}
                </fieldset>
                <div className="food-grid">
                  {visible.map((item) => {
                    const Icon =
                      item.category === 'Meals'
                        ? Soup
                        : item.category === 'Beverages'
                          ? Coffee
                          : Sandwich;
                    return (
                      <article
                        className={`food-card ${!item.stock ? 'sold-out' : ''}`}
                        key={item.id}
                      >
                        <div
                          className={`food-icon ${item.category === 'Beverages' ? 'coffee' : item.category === 'Meals' ? 'meal' : 'snack'}`}
                        >
                          <Icon size={28} strokeWidth={1.5} />
                        </div>
                        <div className="food-content">
                          <div className="food-meta">
                            <span className="veg-mark" aria-label="Vegetarian">
                              ●
                            </span>
                            <span>
                              {item.stock === 0
                                ? 'Sold out today'
                                : item.stock <= 5
                                  ? `Only ${item.stock} left`
                                  : item.category}
                            </span>
                          </div>
                          <h3>{item.name}</h3>
                          <p>{item.description}</p>
                          <small>Allergens: {item.allergens}</small>
                          <div className="food-bottom">
                            <strong>
                              <Coins size={16} />
                              {item.price}
                              <span>coins</span>
                            </strong>
                            {cart[item.id] ? (
                              <div className="stepper">
                                <button
                                  aria-label={`Remove one ${item.name}`}
                                  onClick={() => adjust(item.id, -1)}
                                >
                                  <Minus size={14} />
                                </button>
                                <span>{cart[item.id]}</span>
                                <button
                                  disabled={
                                    cart[item.id] >= Math.min(item.stock, 10)
                                  }
                                  aria-label={`Add one ${item.name}`}
                                  onClick={() => adjust(item.id, 1)}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className="add-button"
                                disabled={!item.stock || !loaded}
                                onClick={() => adjust(item.id, 1)}
                                aria-label={`Add ${item.name}`}
                              >
                                {item.stock ? (
                                  <>
                                    Add
                                    <Plus size={14} />
                                  </>
                                ) : (
                                  'Sold out'
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!visible.length && (
                  <div className="empty-state">
                    <Search />
                    <h3>No matching favourites</h3>
                    <p>Try a different search or category.</p>
                    <button
                      className="button outline"
                      onClick={() => {
                        setQuery('');
                        setCategory('All items');
                      }}
                    >
                      Show all items
                    </button>
                  </div>
                )}
                <p className="menu-footnote">
                  <Leaf size={15} />
                  Vegetarian kitchen · Prepared fresh daily · Please tell the
                  counter about any allergies
                </p>
              </section>
              <aside className="order-column">
                <div className="cart-panel">
                  <div className="cart-heading">
                    <h2>Your tray</h2>
                    <span>
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  {!count ? (
                    <div className="empty-tray">
                      <ShoppingBag size={36} strokeWidth={1.3} />
                      <h3>Good things start here</h3>
                      <p>
                        Add a little something
                        <br />
                        from today’s menu.
                      </p>
                    </div>
                  ) : (
                    <div className="cart-lines">
                      {lines.map((i) => (
                        <div className="cart-line" key={i.id}>
                          <div>
                            <strong>{i.name}</strong>
                            <div className="stepper">
                              <button
                                aria-label={`Remove ${i.name} from tray`}
                                onClick={() => adjust(i.id, -1)}
                              >
                                <Minus size={13} />
                              </button>
                              <span>{cart[i.id]}</span>
                              <button
                                disabled={cart[i.id] >= Math.min(i.stock, 10)}
                                aria-label={`Increase ${i.name} in tray`}
                                onClick={() => adjust(i.id, 1)}
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                          <span>{i.price * cart[i.id]} coins</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="field-label" id="dining-label">
                    Make yourself comfortable
                  </span>
                  <Select
                    value={spaceId}
                    onValueChange={(v) => {
                      setSpaceId(String(v));
                      setCheckoutKey('');
                    }}
                  >
                    <SelectTrigger
                      className="dining-select"
                      aria-labelledby="dining-label"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="takeaway">
                        Takeaway · collect at counter
                      </SelectItem>
                      {spaces
                        .filter(
                          (s) =>
                            !s.departmentId ||
                            s.departmentId === user?.departmentId,
                        )
                        .map((s) => (
                          <SelectItem
                            key={s.id}
                            value={s.id}
                            disabled={s.occupied >= s.capacity}
                          >
                            {s.name} · {s.capacity - s.occupied} seats free
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="small muted">
                    Dine-in orders reserve one seat until your visit is marked
                    complete.
                  </p>
                  <div className="cart-total">
                    <span>Total</span>
                    <strong>
                      <Coins size={18} />
                      {total}
                      <small>coins</small>
                    </strong>
                  </div>
                  <button
                    className="button checkout"
                    disabled={
                      !count ||
                      busy ||
                      !loaded ||
                      (!!user && total > user.balance)
                    }
                    onClick={checkout}
                  >
                    {busy
                      ? 'Please wait…'
                      : user
                        ? total > user.balance
                          ? 'Not enough coins'
                          : 'Place order'
                        : 'Sign in to order'}
                    <ArrowRight size={17} />
                  </button>
                  <div className="wallet-hint">
                    <ShieldCheck size={14} />
                    {user
                      ? `${user.balance} coins in your wallet`
                      : 'Your campus account. Your coin wallet.'}
                  </div>
                </div>
                <button
                  className="space-promo"
                  onClick={() => setTab('spaces')}
                >
                  <div className="space-promo-icon">
                    <Users size={24} />
                  </div>
                  <h3>Your people. Your place.</h3>
                  <p>
                    Find a quiet department corner
                    <br />
                    or meet at the common table.
                  </p>
                  <span>
                    Explore campus spaces
                    <ArrowUpRight size={17} />
                  </span>
                </button>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="spaces">
            <div className="page-heading">
              <div>
                <p className="eyebrow">ROOM FOR A GOOD BREAK</p>
                <h1>Find your corner.</h1>
                <p>
                  Department spaces for your team. Common spaces for everyone.
                </p>
              </div>
            </div>
            <div className="space-grid">
              {spaces.map((s) => {
                const allowed =
                  !s.departmentId || s.departmentId === user?.departmentId;
                return (
                  <article className="space-card" key={s.id}>
                    <div className="space-card-top">
                      <Users size={32} strokeWidth={1.3} />
                      <span className="pill">
                        {s.departmentId
                          ? 'Department space'
                          : 'Open to all staff'}
                      </span>
                    </div>
                    <h2>{s.name}</h2>
                    <p>
                      <MapPin size={16} />
                      {s.location}
                    </p>
                    <p>{s.description}</p>
                    <div className="seat-bar">
                      <span
                        style={{
                          width: `${Math.min(100, (s.occupied / s.capacity) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="space-count">
                      <strong>
                        {s.capacity - s.occupied} <span>seats free</span>
                      </strong>
                      <span>of {s.capacity}</span>
                    </div>
                    <button
                      className="button outline"
                      disabled={!allowed || s.occupied >= s.capacity}
                      onClick={() => {
                        setSpaceId(s.id);
                        setTab('menu');
                      }}
                    >
                      {!allowed
                        ? 'For department members'
                        : s.occupied >= s.capacity
                          ? 'Currently full'
                          : 'Order for this space'}
                      <ArrowRight size={16} />
                    </button>
                  </article>
                );
              })}
            </div>
            <p className="menu-footnote">
              One seat per dine-in order. Availability refreshes every 30
              seconds and is rechecked at checkout.
            </p>
          </TabsContent>
          <TabsContent value="orders">
            <div className="page-heading">
              <div>
                <p className="eyebrow">FROM OUR KITCHEN TO YOU</p>
                <h1>Your orders.</h1>
                <p>
                  Keep an eye on your next bite, or revisit an old favourite.
                </p>
              </div>
            </div>
            {!user ? (
              <SignInPrompt onClick={() => setLogin(true)} />
            ) : !orders.length ? (
              <div className="empty-state">
                <ShoppingBag size={38} />
                <h2>Your first favourite is waiting</h2>
                <p>Orders will appear here after checkout.</p>
                <button className="button dark" onClick={() => setTab('menu')}>
                  Explore the menu
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <div className="orders-list">
                {orders.map((o) => (
                  <article className="order-card" key={o.id}>
                    <div className="order-top">
                      <div>
                        <span className="eyebrow">
                          ORDER {o.id.slice(0, 8).toUpperCase()}
                        </span>
                        <p>{dateLabel(o.createdAt)}</p>
                      </div>
                      <span className={`pill ${o.status}`}>{o.status}</span>
                    </div>
                    <h3>
                      {o.items
                        .map((i) => `${i.quantity} × ${i.name}`)
                        .join(' · ')}
                    </h3>
                    <div className="order-bottom">
                      <span>
                        <MapPin size={16} />
                        {o.spaceName || 'Takeaway · counter collection'}
                      </span>
                      <strong>{o.total} coins</strong>
                      {o.status === 'placed' && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() =>
                            act(async () => {
                              await api('order-status', {
                                id: o.id,
                                status: 'cancelled',
                              });
                              setNotice(
                                'Order cancelled. Your coins have been refunded.',
                              );
                              await refresh();
                            })
                          }
                        >
                          Cancel & refund
                        </button>
                      )}
                    </div>
                    {o.status === 'ready' && (
                      <p className="ready-message">
                        <Check size={16} />
                        Your order is ready. Show this order number at the
                        counter.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="wallet">
            <div className="page-heading">
              <div>
                <p className="eyebrow">A LITTLE LUNCH MONEY</p>
                <h1>Your coin wallet.</h1>
                <p>Every meal and every coin, accounted for.</p>
              </div>
            </div>
            {!user ? (
              <SignInPrompt onClick={() => setLogin(true)} />
            ) : (
              <div className="wallet-layout">
                <div className="wallet-card">
                  <Coins size={32} strokeWidth={1.4} />
                  <p>Available balance</p>
                  <h2>
                    {user.balance}
                    <span>coins</span>
                  </h2>
                  <div>
                    {user.name}
                    <small>{user.departmentName}</small>
                  </div>
                  <p className="small">
                    Need more coins? Contact the canteen administrator.
                  </p>
                </div>
                <section className="ledger">
                  <h2>Wallet activity</h2>
                  {ledger.length ? (
                    ledger.map((e) => (
                      <div className="ledger-row" key={e.id}>
                        <span className="ledger-icon">
                          <Coins size={20} />
                        </span>
                        <div>
                          <strong>{e.description}</strong>
                          <p>{dateLabel(e.createdAt)}</p>
                        </div>
                        <strong className={e.amount > 0 ? 'credit' : ''}>
                          {e.amount > 0 ? '+' : ''}
                          {e.amount}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <p>No transactions yet.</p>
                  )}
                </section>
              </div>
            )}
          </TabsContent>
          {user?.role === 'admin' && (
            <TabsContent value="manage">
              <Admin menu={menu} act={act} refresh={refresh} busy={busy} />
            </TabsContent>
          )}
        </main>
      </Tabs>
      <footer>
        <span className="footer-brand">
          common table<span> · A better campus break.</span>
        </span>
        <span>Menu, spaces & a little time together.</span>
      </footer>
      <Dialog open={login} onOpenChange={setLogin}>
        <DialogContent className="login-dialog">
          <span className="brand-mark">
            <Utensils size={24} />
          </span>
          <DialogTitle className="login-title">
            Welcome to your table.
          </DialogTitle>
          <DialogDescription>
            Sign in with your individual staff account. Your department and
            wallet are linked automatically.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act(async () => {
                await api('login', {
                  email: f.get('email'),
                  password: f.get('password'),
                });
                await refresh();
                setSpaceId('takeaway');
                setLogin(false);
                setNotice('You’re signed in. Make yourself at home.');
              });
            }}
          >
            <label className="field-label" htmlFor="email">
              Staff email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="you@campus.edu"
            />
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button checkout" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={16} />
            </button>
            <p className="small muted">
              Ask your canteen administrator for account access.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function SignInPrompt({ onClick }: { onClick: () => void }) {
  return (
    <div className="empty-state">
      <ShieldCheck size={38} />
      <h2>A space that’s yours</h2>
      <p>Sign in to see your personal campus account.</p>
      <button className="button dark" onClick={onClick}>
        Staff sign in
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
