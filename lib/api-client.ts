import type { MenuItem, User, Space, Order, LedgerEntry } from './catalog';
type ApiResults = {
  state: {
    menu: MenuItem[];
    spaces: Space[];
    user: User | null;
    orders: Order[];
    ledger: LedgerEntry[];
  };
  admin: { orders: Order[]; staff: User[] };
  orders: { orderId: string };
  login: { ok: boolean };
  logout: { ok: boolean };
  'order-status': { ok: boolean };
  credit: { ok: boolean };
  stock: { ok: boolean };
};
export async function api<K extends keyof ApiResults>(
  path: K,
  body?: unknown,
): Promise<ApiResults[K]> {
  const res = await fetch(`/api/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as ApiResults[K] & { error?: string };
  if (!res.ok)
    throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
