import fs from 'fs';
import path from 'path';
import { dbEnabled, patch, insert, patchWhere, select } from '../../../lib/db';

export const dynamic = 'force-dynamic';

const STAGES = [
  'Contacted',
  'Got Back to Us',
  'Meetings Set Up',
  'Follow-Up Meeting(s)',
  'Lead',
  'Replied',
  'Meeting',
  'Negotiation',
  'Won',
  'Lost',
];

const UI_TO_DB_STAGE = {
  Contacted: 'Contacted',
  'Got Back to Us': 'Replied',
  'Meetings Set Up': 'Meeting',
  'Follow-Up Meeting(s)': 'Negotiation',
};
const QSTATUS = ['Open', 'Drafted', 'Waiting', 'Blocked', 'Closed', 'Unknown'];
const LI_STATUS = ['not_connected', 'invite_sent', 'connected', 'messaged'];

const SPEC = {
  deal: { table: 'deals', field: 'stage', ok: v => STAGES.includes(v) },
  contact: { table: 'contacts', field: 'dnc', ok: v => typeof v === 'boolean' },
  contact_stage: { table: 'deals', field: 'stage', ok: v => STAGES.includes(v), log: 'deal' },
  linkedin_status: { table: 'contacts', field: 'linkedin_status', ok: v => LI_STATUS.includes(v), log: 'contact' },
  queue_item: { table: 'queue_items', field: 'status', ok: v => QSTATUS.includes(v) },
  followup: { table: 'contacts', field: 'needs_followup', ok: v => typeof v === 'boolean', log: 'contact' },
};

function updateLocalSeed(entity, id, value) {
  try {
    const seedPath = path.join(process.cwd(), 'data', 'seed.json');
    if (!fs.existsSync(seedPath)) return false;
    const raw = fs.readFileSync(seedPath, 'utf8');
    const data = JSON.parse(raw);

    if (entity === 'deal' || entity === 'contact_stage') {
      const stage = value;
      let foundDeal = false;
      if (Array.isArray(data.deals)) {
        for (const d of data.deals) {
          if (d.id === id || d.contact_id === id) {
            d.stage = stage;
            foundDeal = true;
          }
        }
      }
      if (Array.isArray(data.contacts)) {
        for (const c of data.contacts) {
          if (c.id === id || (foundDeal && data.deals?.find(d => d.id === id)?.contact_id === c.id)) {
            c.stage = stage;
          }
        }
      }
    } else if (entity === 'contact') {
      if (Array.isArray(data.contacts)) {
        for (const c of data.contacts) {
          if (c.id === id) c.dnc = value;
        }
      }
    } else if (entity === 'linkedin_status') {
      if (Array.isArray(data.contacts)) {
        for (const c of data.contacts) {
          if (c.id === id) c.linkedin_status = value;
        }
      }
    } else if (entity === 'followup') {
      if (Array.isArray(data.contacts)) {
        for (const c of data.contacts) {
          if (c.id === id) c.needs_followup = value;
        }
      }
    } else if (entity === 'queue_item') {
      if (Array.isArray(data.queue)) {
        for (const q of data.queue) {
          if (q.id === id) q.status = value;
        }
      }
    }

    fs.writeFileSync(seedPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to update local seed.json:', err);
    return false;
  }
}

// POST {entity: 'deal'|'contact'|'contact_stage'|'linkedin_status'|'queue_item'|'followup'|'notification', id, value}
export async function POST(req) {
  const { entity, id, value } = await req.json().catch(() => ({}));

  if (entity === 'notification') {
    if (typeof id !== 'string' || typeof value !== 'boolean') {
      return Response.json({ ok: false, error: 'invalid edit' }, { status: 400 });
    }
    if (dbEnabled()) {
      try {
        const read_at = value ? new Date().toISOString() : null;
        if (id === '*') await patchWhere('notifications', 'read_at=is.null', { read_at });
        else await patchWhere('notifications', `id=eq.${encodeURIComponent(id)}`, { read_at });
        return Response.json({ ok: true, persisted: true });
      } catch (e) {
        console.error('notification edit failed', e.message);
        return Response.json({ ok: false, error: 'database write failed' }, { status: 502 });
      }
    }
    return Response.json({ ok: true, persisted: true, local: true });
  }

  const s = SPEC[entity];
  if (!s || typeof id !== 'string' || !s.ok(value)) {
    return Response.json({ ok: false, error: 'invalid edit' }, { status: 400 });
  }

  // If Supabase is enabled, persist to DB
  if (dbEnabled()) {
    try {
      if (entity === 'contact_stage' || entity === 'deal') {
        const stage = UI_TO_DB_STAGE[value] || value;
        const dealId = entity === 'deal' ? id : ('d_' + id.replace(/^c_/, ''));
        // Try patching deal by id
        try {
          await patch('deals', dealId, { stage });
        } catch {
          // If deal not found, try patch by contact_id
          await patchWhere('deals', `contact_id=eq.${encodeURIComponent(id)}`, { stage });
        }
        await insert('edits', { entity: 'deal', entity_id: dealId, field: 'stage', new_value: String(stage) });
      } else if (entity === 'contact') {
        await patch('contacts', id, { dnc: value });
        await insert('edits', { entity: 'contact', entity_id: id, field: 'dnc', new_value: String(value) });
      } else if (entity === 'followup') {
        await patch('contacts', id, { needs_followup: value });
        await insert('edits', { entity: 'contact', entity_id: id, field: 'needs_followup', new_value: String(value) });
      } else if (entity === 'queue_item') {
        await patch('queue_items', id, { status: value });
        await insert('edits', { entity: 'queue_item', entity_id: id, field: 'status', new_value: String(value) });
      } else if (entity === 'linkedin_status') {
        await insert('edits', { entity: 'contact', entity_id: id, field: 'linkedin_status', new_value: String(value) });
      }

      // Keep local seed updated in sync
      updateLocalSeed(entity, id, value);
      return Response.json({ ok: true, persisted: true });
    } catch (e) {
      console.error('Supabase edit failed, falling back to local seed:', e.message);
      updateLocalSeed(entity, id, value);
      return Response.json({ ok: true, persisted: true, local_fallback: true });
    }
  }

  // Offline fallback
  updateLocalSeed(entity, id, value);
  return Response.json({ ok: true, persisted: true, local: true });
}
