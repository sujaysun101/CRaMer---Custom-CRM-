// Server-only Supabase access via PostgREST using the service-role key.
// Never import this from a client component.
import 'server-only';
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const dbEnabled = () => Boolean(URL_ && KEY);
const h = (extra = {}) => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...extra });
export async function selectAll(table, select = '*', order = 'id', max = Infinity) {
  const out = []; const page = Math.min(1000, max);
  for (let from = 0; from < max; from += page) {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${select}&order=${order}`, { headers: h({ Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }), cache: 'no-store' });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    const rows = await r.json(); out.push(...rows);
    if (rows.length < page) return out;
  }
  return out;
}
export async function select(table, query) {
  const r = await fetch(`${URL_}/rest/v1/${table}?${query}`, { headers: h(), cache: 'no-store' });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  return r.json();
}
export async function patchWhere(table, filter, values) {
  const r = await fetch(`${URL_}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: h({ Prefer: 'return=minimal' }), body: JSON.stringify(values) });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
}
export async function patch(table, id, values) {
  const r = await fetch(`${URL_}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: h({ Prefer: 'return=representation' }), body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }) });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  return (await r.json())[0];
}
export async function insert(table, row) {
  const r = await fetch(`${URL_}/rest/v1/${table}`, { method: 'POST', headers: h({ Prefer: 'return=minimal' }), body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
}
