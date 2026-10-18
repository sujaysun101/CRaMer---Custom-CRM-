import { dbEnabled, select } from '../../../lib/db';
export const dynamic = 'force-dynamic';
// GET /api/threads?contact=<contact id> -> full Gmail threads for one lead (from the private thread_messages table).
// Bodies are fetched on demand when a lead is opened; they are never part of /api/data or the repo.
export async function GET(req) {
  const id = new URL(req.url).searchParams.get('contact') || '';
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(id)) return Response.json({ error: 'bad contact id' }, { status: 400 });
  if (!dbEnabled()) return Response.json({ threads: [] });
  try {
    const rows = await select('thread_messages', `select=id,thread_id,account,from_addr,from_name,to_addrs,cc_addrs,date,subject,body,body_raw,direction&contact_ids=cs.${encodeURIComponent('{' + id + '}')}&order=date.asc&limit=400`);
    const by = new Map();
    for (const r of rows) { const k = r.account + '|' + r.thread_id; if (!by.has(k)) by.set(k, { thread_id: r.thread_id, account: r.account, subject: r.subject, messages: [] }); by.get(k).messages.push(r); }
    const threads = [...by.values()].map(t => ({ ...t, last: t.messages[t.messages.length - 1].date, url: `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(t.account)}#all/${t.thread_id}` }))
      .sort((a, b) => (b.last || '').localeCompare(a.last || ''));
    return Response.json({ threads });
  } catch (e) { console.error('threads read failed', e.message); return Response.json({ error: 'database read failed' }, { status: 502 }); }
}
