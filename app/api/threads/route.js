import fs from 'fs';
import path from 'path';
import { dbEnabled, select } from '../../../lib/db';
import { isAutoReplyMessage } from '../../../lib/scopeFilter';

export const dynamic = 'force-dynamic';

function getLocalThreads(contactId) {
  try {
    const seedPath = path.join(process.cwd(), 'data', 'seed.json');
    if (!fs.existsSync(seedPath)) return [];
    const raw = fs.readFileSync(seedPath, 'utf8');
    const data = JSON.parse(raw);

    // Filter out auto-replies while preserving human replies and outbound messages in the thread
    const msgs = (data.messages || []).filter(m => m.contact_id === contactId && !isAutoReplyMessage(m));
    if (!msgs.length) {
      const evs = (data.events || []).filter(e => e.contact_id === contactId && e.channel === 'email' && e.kind !== 'auto_reply');
      if (evs.length) {
        return [{
          thread_id: 'ev_' + contactId,
          account: 'default',
          subject: 'Email History',
          messages: evs.map((e, idx) => ({
            id: 'ev_msg_' + idx,
            thread_id: 'ev_' + contactId,
            direction: e.kind === 'sent' ? 'out' : 'in',
            from_name: e.kind === 'sent' ? 'You' : 'Contact',
            to_addrs: [],
            date: e.date,
            subject: e.summary,
            body: e.summary,
            body_raw: e.summary,
          })),
          last: evs[evs.length - 1].date,
          url: 'https://mail.google.com',
        }];
      }
      return [];
    }

    const by = new Map();
    for (const m of msgs) {
      const threadKey = m.thread_id || ('thread_' + contactId);
      if (!by.has(threadKey)) {
        by.set(threadKey, {
          thread_id: threadKey,
          account: m.account || 'personal',
          subject: m.subject || '(no subject)',
          messages: [],
        });
      }
      by.get(threadKey).messages.push({
        id: m.id,
        thread_id: threadKey,
        account: m.account,
        from_addr: m.from_addr || (m.direction === 'out' ? 'me@example.com' : undefined),
        from_name: m.from_name || (m.direction === 'out' ? 'You' : undefined),
        to_addrs: m.to_addrs || [],
        cc_addrs: m.cc_addrs || [],
        date: m.date,
        subject: m.subject,
        body: m.body || m.snippet,
        body_raw: m.body_raw || m.snippet,
        direction: m.direction || 'in',
      });
    }

    return [...by.values()].map(t => {
      t.messages.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const lastMsg = t.messages[t.messages.length - 1];
      return {
        ...t,
        last: lastMsg?.date || '',
        url: `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(t.account)}#all/${t.thread_id}`,
      };
    }).sort((a, b) => (b.last || '').localeCompare(a.last || ''));
  } catch (err) {
    console.error('Error reading local threads:', err);
    return [];
  }
}

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('contact') || '';
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(id)) {
    return Response.json({ error: 'bad contact id' }, { status: 400 });
  }

  if (dbEnabled()) {
    try {
      const rows = await select(
        'thread_messages',
        `select=id,thread_id,account,from_addr,from_name,to_addrs,cc_addrs,date,subject,body,body_raw,direction&contact_ids=cs.${encodeURIComponent('{' + id + '}')}&order=date.asc&limit=400`
      );
      if (rows && rows.length > 0) {
        const cleanRows = rows.filter(r => !isAutoReplyMessage(r));
        const by = new Map();
        for (const r of cleanRows) {
          const k = r.account + '|' + r.thread_id;
          if (!by.has(k)) by.set(k, { thread_id: r.thread_id, account: r.account, subject: r.subject, messages: [] });
          by.get(k).messages.push(r);
        }
        const threads = [...by.values()]
          .filter(t => t.messages.length > 0)
          .map(t => ({
            ...t,
            last: t.messages[t.messages.length - 1].date,
            url: `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(t.account)}#all/${t.thread_id}`,
          }))
          .sort((a, b) => (b.last || '').localeCompare(a.last || ''));
        return Response.json({ threads });
      }
    } catch (e) {
      console.warn('DB thread_messages query failed, falling back to local/messages', e.message);
    }
  }

  // Fallback to local thread resolution
  const threads = getLocalThreads(id);
  return Response.json({ threads });
}
