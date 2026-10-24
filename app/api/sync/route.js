import fs from 'fs';
import path from 'path';
import { dbEnabled, selectAll, patchWhere, upsert } from '../../../lib/db';
import { isAutoReplyMessage, isInternalAccount } from '../../../lib/scopeFilter';

export const dynamic = 'force-dynamic';

const MSG_COLS = [
  'id', 'contact_id', 'direction', 'kind', 'date', 'subject', 'snippet',
  'url', 'thread_id', 'account', 'created_at', 'sentiment',
  'needs_followup', 'note', 'alternate_contact', 'ooo_type',
];

const parseTs = x => {
  if (!x) return 0;
  return new Date(x.length === 10 ? x + 'T12:00:00-04:00' : x).getTime() || 0;
};

async function runSync() {
  const now = new Date().toISOString();
  const seedPath = path.join(process.cwd(), 'data', 'seed.json');
  let seedData = null;
  try {
    if (fs.existsSync(seedPath)) {
      seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    }
  } catch {}

  let contacts = [];
  let messages = [];
  let threadMessages = [];
  let meetings = [];

  if (dbEnabled()) {
    try {
      [contacts, messages, threadMessages, meetings] = await Promise.all([
        selectAll('contacts'),
        selectAll('messages', '*', 'date.asc'),
        selectAll('thread_messages', '*', 'date.asc').catch(() => []),
        selectAll('meetings', '*', 'start_at.asc'),
      ]);
    } catch {
      if (seedData) {
        contacts = seedData.contacts || [];
        messages = seedData.messages || [];
        meetings = seedData.meetings || [];
      }
    }
  } else if (seedData) {
    contacts = seedData.contacts || [];
    messages = seedData.messages || [];
    meetings = seedData.meetings || [];
  }

  const validContactIds = new Set(contacts.map(c => c.id));
  const contactByEmail = new Map();
  for (const c of contacts) {
    if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), c.id);
  }

  // 1. Build thread_id -> Set<contact_id> across messages and thread_messages
  const threadContacts = new Map();
  for (const m of messages) {
    if (m.thread_id && m.contact_id && validContactIds.has(m.contact_id)) {
      if (!threadContacts.has(m.thread_id)) threadContacts.set(m.thread_id, new Set());
      threadContacts.get(m.thread_id).add(m.contact_id);
    }
  }
  for (const tm of threadMessages) {
    if (!tm.thread_id) continue;
    if (!threadContacts.has(tm.thread_id)) threadContacts.set(tm.thread_id, new Set());
    for (const cid of tm.contact_ids || []) {
      if (validContactIds.has(cid)) threadContacts.get(tm.thread_id).add(cid);
    }
    const addrs = [...(tm.to_addrs || []), ...(tm.cc_addrs || []), tm.from_addr || ''];
    for (const rawAddr of addrs) {
      const m = (rawAddr || '').toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
      if (m && !isInternalAccount(m[0]) && contactByEmail.has(m[0])) {
        threadContacts.get(tm.thread_id).add(contactByEmail.get(m[0]));
      }
    }
  }

  // 2. Sync any missing thread_messages into messages & upgrade 10-char dates to full ISO timestamps
  const msgById = new Map(messages.map(m => [m.id, m]));
  const messagesToUpsert = [];

  for (const tm of threadMessages) {
    const existing = msgById.get(tm.id);
    if (existing) {
      if (tm.date && existing.date && existing.date.length === 10 && tm.date.length > 10) {
        existing.date = tm.date;
        messagesToUpsert.push(existing);
      }
      continue;
    }
    const cids = [
      ...(tm.contact_ids || []).filter(id => validContactIds.has(id)),
      ...(threadContacts.get(tm.thread_id) || []),
    ];
    const primaryContactId = cids[0];
    if (!primaryContactId) continue;

    const newMsg = {
      id: tm.id,
      contact_id: primaryContactId,
      direction: tm.direction,
      kind: tm.direction === 'out' ? 'sent' : 'reply',
      date: tm.date,
      subject: tm.subject || '(no subject)',
      snippet: (tm.body || '').replace(/\s+/g, ' ').trim().slice(0, 240),
      url: tm.thread_id ? `https://mail.google.com/mail/u/0/#all/${tm.thread_id}` : null,
      thread_id: tm.thread_id || null,
      account: tm.account || null,
      created_at: tm.created_at || now,
      sentiment: null,
      needs_followup: false,
      note: null,
      alternate_contact: null,
      ooo_type: null,
    };
    messages.push(newMsg);
    msgById.set(newMsg.id, newMsg);
    messagesToUpsert.push(newMsg);
  }

  // 3. Compute latest outbound reply (lastOut), latest inbound human reply (lastIn), and latest meeting (lastMeet) per contact
  //    Crucially, if you replied on a thread (direction === 'out'), every contact participating in that thread_id is credited with lastOut!
  const lastOutByContact = new Map();
  const lastInByContact = new Map();
  const lastInMsgByContact = new Map();
  const lastMeetByContact = new Map();

  for (const m of messages) {
    if (isAutoReplyMessage(m)) continue;
    const t = parseTs(m.date);
    const affectedContacts = new Set([
      m.contact_id,
      ...(m.thread_id && threadContacts.has(m.thread_id) ? threadContacts.get(m.thread_id) : []),
    ]);

    if (m.direction === 'out') {
      for (const cid of affectedContacts) {
        if (t > (lastOutByContact.get(cid) || 0)) lastOutByContact.set(cid, t);
      }
    } else if (m.kind === 'reply') {
      if (t > (lastInByContact.get(m.contact_id) || 0)) {
        lastInByContact.set(m.contact_id, t);
        lastInMsgByContact.set(m.contact_id, m);
      }
    }
  }

  for (const tm of threadMessages) {
    const t = parseTs(tm.date);
    const affectedContacts = new Set([
      ...(tm.contact_ids || []),
      ...(tm.thread_id && threadContacts.has(tm.thread_id) ? threadContacts.get(tm.thread_id) : []),
    ]);
    if (tm.direction === 'out') {
      for (const cid of affectedContacts) {
        if (t > (lastOutByContact.get(cid) || 0)) lastOutByContact.set(cid, t);
      }
    }
  }

  const nowMs = Date.now();
  for (const mt of meetings) {
    const t = parseTs(mt.start_at);
    if (t > nowMs) continue; // Only completed/past meetings clear prior scheduling follow-ups
    for (const cid of mt.contact_ids || []) {
      if (t > (lastMeetByContact.get(cid) || 0)) lastMeetByContact.set(cid, t);
    }
  }

  // 4. Reconcile contacts' needs_followup status
  const reconciledContacts = [];
  for (const c of contacts) {
    if (!c.needs_followup) continue;
    const lo = lastOutByContact.get(c.id) || 0;
    const li = lastInByContact.get(c.id) || 0;
    const lm = lastMeetByContact.get(c.id) || 0;
    const lastMsg = lastInMsgByContact.get(c.id);
    const snippet = (lastMsg?.snippet || '').toLowerCase();

    // Case A: You already replied after their latest inbound message
    if (lo >= li && lo > 0) {
      c.needs_followup = false;
      c.next_action = 'Waiting on them';
      c.updated_at = now;
      reconciledContacts.push({ id: c.id, name: c.name || c.email, reason: 'outbound_reply_sent', next_action: c.next_action });
      continue;
    }

    // Case B: You held a meeting with them after their latest inbound email
    if (lm > li && li > 0) {
      c.needs_followup = false;
      c.next_action = 'Completed meeting';
      c.updated_at = now;
      reconciledContacts.push({ id: c.id, name: c.name || c.email, reason: 'meeting_completed_after_email', next_action: c.next_action });
      continue;
    }

    // Case C: Their last message is a closing "we will take a look and get back to you" after your outreach
    if (/we will take a look and get back to you|i'll get back to you|we'll get back to you/i.test(snippet)) {
      c.needs_followup = false;
      c.next_action = 'Waiting on them';
      c.updated_at = now;
      reconciledContacts.push({ id: c.id, name: c.name || c.email, reason: 'they_promised_to_follow_up', next_action: c.next_action });
    }
  }

  // 5. Persist updates to Supabase and local seed.json
  if (dbEnabled()) {
    try {
      if (messagesToUpsert.length > 0) {
        const normalizedMsgs = messagesToUpsert.map(m => {
          const o = {};
          for (const k of MSG_COLS) {
            if (k === 'created_at') o[k] = m[k] || now;
            else if (k === 'needs_followup') o[k] = Boolean(m[k]);
            else o[k] = m[k] !== undefined ? m[k] : null;
          }
          return o;
        });
        for (let i = 0; i < normalizedMsgs.length; i += 200) {
          await upsert('messages', normalizedMsgs.slice(i, i + 200));
        }
      }

      for (const rc of reconciledContacts) {
        await patchWhere('contacts', `id=eq.${encodeURIComponent(rc.id)}`, {
          needs_followup: false,
          next_action: rc.next_action,
          updated_at: now,
        });
      }

      await upsert('sync_state', [
        {
          key: 'last_run',
          last_synced_at: now,
          info: {
            mode: 'auto_sync',
            new_messages_linked: messagesToUpsert.length,
            contacts_reconciled: reconciledContacts.length,
            reconciled_list: reconciledContacts,
          },
        },
      ]);
    } catch {}
  }

  if (seedData) {
    try {
      seedData.contacts = contacts;
      seedData.messages = messages.map(m => {
        const o = {};
        for (const k of MSG_COLS) {
          if (k === 'created_at') o[k] = m[k] || now;
          else if (k === 'needs_followup') o[k] = Boolean(m[k]);
          else o[k] = m[k] !== undefined ? m[k] : null;
        }
        return o;
      });
      seedData.sync = (seedData.sync || []).map(s =>
        s.key === 'last_run'
          ? { ...s, last_synced_at: now, updated_at: now }
          : { ...s, last_synced_at: now }
      );
      fs.writeFileSync(seedPath, JSON.stringify(seedData, null, 2));
    } catch {}
  }

  return {
    ok: true,
    synced_at: now,
    new_messages_linked: messagesToUpsert.length,
    contacts_reconciled: reconciledContacts.length,
    reconciled: reconciledContacts,
  };
}

export async function GET() {
  const res = await runSync();
  return Response.json(res, { headers: { 'cache-control': 'no-store' } });
}

export async function POST() {
  const res = await runSync();
  return Response.json(res, { headers: { 'cache-control': 'no-store' } });
}
