'use client';
import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { api } from '@/lib/api-client';
import type { MenuItem, User, Order } from '@/lib/catalog';
export function Admin({
  menu,
  act,
  refresh,
  busy,
}: {
  menu: MenuItem[];
  act: (action: () => Promise<void>) => Promise<void>;
  refresh: () => Promise<void>;
  busy: boolean;
}) {
  const creditRequest = useRef<{ payload: string; key: string } | null>(null);
  const [queue, setQueue] = useState<Order[]>([]),
    [staff, setStaff] = useState<User[]>([]),
    [staffId, setStaffId] = useState(''),
    [managementError, setManagementError] = useState('');
  const load = async () => {
    const d = await api('admin');
    setQueue(d.orders);
    setStaff(d.staff);
  };
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch((e) => setManagementError(e.message));
    const t = setInterval(() => {
      load().catch((e) => setManagementError(e.message));
    }, 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">BEHIND THE COUNTER</p>
          <h1>Keep the good food flowing.</h1>
          <p>Manage the order queue, daily stock, and staff coins.</p>
        </div>
      </div>
      {managementError && (
        <p role="alert" className="message error">
          {managementError}
        </p>
      )}
      <div className="admin-grid">
        <section className="admin-panel">
          <h2>Kitchen queue</h2>
          {!queue.length && (
            <p className="muted">
              All caught up. New orders appear here automatically.
            </p>
          )}
          {queue.map((o) => (
            <div className="queue-item" key={o.id}>
              <div>
                <strong>
                  #{o.id.slice(0, 8).toUpperCase()} · {o.userName}
                </strong>
                <p>
                  {o.items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}
                </p>
                <small>
                  {o.spaceName || 'Takeaway'} · {o.status}
                </small>
              </div>
              <button
                className="button outline"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api('order-status', {
                      id: o.id,
                      status:
                        o.status === 'placed'
                          ? 'preparing'
                          : o.status === 'preparing'
                            ? 'ready'
                            : 'completed',
                    });
                    await load();
                    await refresh();
                  })
                }
              >
                {o.status === 'placed'
                  ? 'Start preparing'
                  : o.status === 'preparing'
                    ? 'Mark ready'
                    : 'Complete'}
                <ChevronRight size={15} />
              </button>
            </div>
          ))}
        </section>
        <section className="admin-panel">
          <h2>Add staff coins</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act(async () => {
                const values = {
                  userId: staffId,
                  amount: Number(f.get('amount')),
                  reason: f.get('reason'),
                };
                const payload = JSON.stringify(values);
                if (creditRequest.current?.payload !== payload) {
                  creditRequest.current = { payload, key: crypto.randomUUID() };
                }
                await api('credit', {
                  ...values,
                  key: creditRequest.current.key,
                });
                creditRequest.current = null;
                await refresh();
                await load();
              });
            }}
          >
            <span className="field-label" id="staff-label">
              Staff member
            </span>
            <Select
              value={staffId}
              onValueChange={(v) => setStaffId(String(v))}
            >
              <SelectTrigger
                className="dining-select"
                aria-labelledby="staff-label"
              >
                <SelectValue placeholder="Choose staff member" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.balance} coins
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="field-label" htmlFor="amount">
              Coins to add
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="1"
              max="10000"
              step="1"
              required
            />
            <label className="field-label" htmlFor="reason">
              Reason
            </label>
            <input
              id="reason"
              name="reason"
              required
              maxLength={120}
              placeholder="Monthly meal allowance"
            />
            <button className="button dark" disabled={busy || !staffId}>
              Add coins
              <Plus size={16} />
            </button>
          </form>
        </section>
        <section className="admin-panel stock-panel">
          <h2>Menu availability</h2>
          <p className="muted">
            Set the number of servings available. Zero marks an item sold out.
          </p>
          {menu.map((i) => (
            <form
              className="stock-row"
              key={i.id}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act(async () => {
                  await api('stock', {
                    id: i.id,
                    stock: Number(f.get('stock')),
                  });
                  await refresh();
                });
              }}
            >
              <label htmlFor={`stock-${i.id}`}>
                <strong>{i.name}</strong>
                <small>{i.stock} servings available</small>
              </label>
              <input
                id={`stock-${i.id}`}
                key={i.stock}
                name="stock"
                type="number"
                min="0"
                max="10000"
                step="1"
                defaultValue={i.stock}
                required
              />
              <button className="button outline" disabled={busy}>
                Update
              </button>
            </form>
          ))}
        </section>
      </div>
    </>
  );
}
