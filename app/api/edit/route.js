import { dbEnabled, patch, insert, patchWhere } from '../../../lib/db';
export const dynamic = 'force-dynamic';
const STAGES = ['Lead','Contacted','Replied','Meeting','Negotiation','Won','Lost'];
const QSTATUS = ['Open','Drafted','Waiting','Blocked','Closed','Unknown'];
const SPEC = {
  deal:       { table: 'deals',       field: 'stage',  ok: v => STAGES.includes(v) },
  contact:    { table: 'contacts',    field: 'dnc',    ok: v => typeof v === 'boolean' },
  queue_item: { table: 'queue_items', field: 'status', ok: v => QSTATUS.includes(v) },
  followup:   { table: 'contacts',    field: 'needs_followup', ok: v => typeof v === 'boolean', log: 'contact' },
};
// POST {entity: 'deal'|'contact'|'queue_item'|'followup'|'notification', id, value}
// notification: id = notification id or '*' (mark all), value = true (read) | false (unread)
export async function POST(req) {
  const { entity, id, value } = await req.json().catch(() => ({}));
  if (!dbEnabled()) return Response.json({ ok: false, persisted: false, error: 'database not configured' }, { status: 503 });
  if (entity === 'notification') {
    if (typeof id !== 'string' || typeof value !== 'boolean') return Response.json({ ok: false, error: 'invalid edit' }, { status: 400 });
    try {
      const read_at = value ? new Date().toISOString() : null;
      if (id === '*') await patchWhere('notifications', 'read_at=is.null', { read_at });
      else await patchWhere('notifications', `id=eq.${encodeURIComponent(id)}`, { read_at });
      return Response.json({ ok: true, persisted: true });
    } catch (e) { console.error('notification edit failed', e.message); return Response.json({ ok: false, error: 'database write failed' }, { status: 502 }); }
  }
  const s = SPEC[entity];
  if (!s || typeof id !== 'string' || !s.ok(value)) return Response.json({ ok: false, error: 'invalid edit' }, { status: 400 });
  try {
    const row = await patch(s.table, id, { [s.field]: value });
    if (!row) return Response.json({ ok: false, error: 'not found' }, { status: 404 });
    await insert('edits', { entity: s.log || entity, entity_id: id, field: s.field, new_value: String(value) });
    return Response.json({ ok: true, persisted: true });
  } catch (e) { console.error('edit failed', e.message); return Response.json({ ok: false, error: 'database write failed' }, { status: 502 }); }
}
