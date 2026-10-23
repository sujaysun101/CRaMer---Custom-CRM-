import fs from 'fs';
import path from 'path';
import { dbEnabled, selectAll } from '../../../lib/db';
import {
  isExcludedContact,
  isExcludedMessage,
  isExcludedMeeting,
  isExcludedNotification,
  isAutoReplyMessage,
  CONTACT_NAME_ENRICHMENTS,
  CONTACT_ORG_ENRICHMENTS,
} from '../../../lib/scopeFilter';

export const dynamic = 'force-dynamic';

const FOLLOW_UP_MEET_RX = /follow-?up|next steps|demo|advisory|in-person|second|weekly multidomain/i;

function normalizeData(raw) {
  const rawContacts = Array.isArray(raw.contacts) ? raw.contacts : [];
  const rawDeals = Array.isArray(raw.deals) ? raw.deals : [];
  const rawEvents = Array.isArray(raw.events) ? raw.events : [];
  const rawQueue = Array.isArray(raw.queue) ? raw.queue : (Array.isArray(raw.queue_items) ? raw.queue_items : []);
  const rawMessages = Array.isArray(raw.messages) ? raw.messages : [];
  const rawMeetings = Array.isArray(raw.meetings) ? raw.meetings : [];
  const rawNotifications = Array.isArray(raw.notifications) ? raw.notifications : [];
  const sync = Array.isArray(raw.sync) ? raw.sync : (Array.isArray(raw.sync_state) ? raw.sync_state : []);

  const rawDealByContact = new Map();
  for (const d of rawDeals) {
    if (d.contact_id && !rawDealByContact.has(d.contact_id)) {
      rawDealByContact.set(d.contact_id, d);
    }
  }

  // Track which contacts have at least one actual human reply (even if the thread also had an auto-reply earlier)
  const humanReplyContactIds = new Set();
  for (const m of rawMessages) {
    if (m.direction === 'in' && m.kind === 'reply' && !isAutoReplyMessage(m)) {
      humanReplyContactIds.add(m.contact_id);
    }
  }
  for (const e of rawEvents) {
    if (e.kind === 'linkedin_message_in' || e.kind === 'reply') {
      humanReplyContactIds.add(e.contact_id);
    }
  }

  // 1. Filter out personal, academic/class, mentor, club, and pure auto-reply contacts
  const contacts = rawContacts
    .filter(c => {
      const hasDeal = rawDealByContact.has(c.id);
      const hasHumanReply = humanReplyContactIds.has(c.id);
      return !isExcludedContact(c, { hasDeal, hasHumanReply });
    })
    .map(c => ({
      ...c,
      name: c.name || CONTACT_NAME_ENRICHMENTS[c.id] || null,
      org: c.org || CONTACT_ORG_ENRICHMENTS[c.id] || null,
    }));

  const validContactIds = new Set(contacts.map(c => c.id));
  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));

  // Map including pure auto-reply contacts solely for the isolated "Automatic Reply" tab
  const autoReplyContacts = rawContacts
    .filter(c => {
      const hasDeal = rawDealByContact.has(c.id);
      const hasHumanReply = humanReplyContactIds.has(c.id);
      return !isExcludedContact(c, { hasDeal, hasHumanReply, allowAutoReply: true });
    })
    .map(c => ({
      ...c,
      name: c.name || CONTACT_NAME_ENRICHMENTS[c.id] || null,
      org: c.org || CONTACT_ORG_ENRICHMENTS[c.id] || null,
    }));
  const autoReplyContactMap = Object.fromEntries(autoReplyContacts.map(c => [c.id, c]));

  // 2a. Main CRM messages: must belong to a valid software contact AND NOT be an automatic reply
  const messages = rawMessages.filter(m => {
    if (!validContactIds.has(m.contact_id)) return false;
    const c = contactMap[m.contact_id];
    return !isExcludedMessage(m, c);
  });

  // 2b. Dedicated "Automatic Reply" tab messages: strictly isolated from main CRM
  const autoReplies = rawMessages
    .filter(m => {
      const c = autoReplyContactMap[m.contact_id];
      if (!c) return false;
      return isAutoReplyMessage(m);
    })
    .map(m => {
      const c = autoReplyContactMap[m.contact_id];
      return {
        ...m,
        contact_name: c?.name || null,
        contact_email: c?.email || null,
        contact_org: c?.org || null,
        contact_alternate: m.alternate_contact || c?.alternate_contact || null,
        has_human_followup: humanReplyContactIds.has(m.contact_id),
      };
    });

  // 3. Filter meetings: exclude mentor conversations, NYU classes, L'SPACE, Clio, Tartinery, and personal events
  const meetings = rawMeetings
    .filter(meet => !isExcludedMeeting(meet, contactMap))
    .map(meet => ({
      ...meet,
      contact_ids: (meet.contact_ids || []).filter(id => validContactIds.has(id)),
    }));

  const meetsByContact = new Map();
  for (const m of meetings) {
    for (const cid of m.contact_ids || []) {
      if (!meetsByContact.has(cid)) meetsByContact.set(cid, []);
      meetsByContact.get(cid).push(m);
    }
  }

  // 4. Filter events (exclude auto_reply events), queue items, and notifications
  const events = rawEvents.filter(e => validContactIds.has(e.contact_id) && e.kind !== 'auto_reply');
  const queue = rawQueue.filter(q => validContactIds.has(q.contact_id) && q.status !== 'Waiting');
  const notifications = rawNotifications.filter(n => !isExcludedNotification(n, validContactIds));

  // 5. Compute the 4 clean stages for each contact:
  //    - Contacted
  //    - Got Back to Us
  //    - Meetings Set Up
  //    - Follow-Up Meeting(s)
  const dealMap = new Map();
  for (const d of rawDeals) {
    if (d.contact_id && validContactIds.has(d.contact_id) && !dealMap.has(d.contact_id)) {
      dealMap.set(d.contact_id, d);
    }
  }

  const normalizedContacts = contacts.map(c => {
    const cMeets = meetsByContact.get(c.id) || [];
    const hasAnyMeet = cMeets.length > 0;
    const isFollowUpMeet = cMeets.length >= 2 || cMeets.some(m => FOLLOW_UP_MEET_RX.test(m.title || ''));
    const hasHumanReply = humanReplyContactIds.has(c.id);
    const gotBack = (hasHumanReply && c.sentiment !== 'negative') || hasAnyMeet;

    let stage = 'Contacted';
    if (isFollowUpMeet) {
      stage = 'Follow-Up Meeting(s)';
    } else if (hasAnyMeet) {
      stage = 'Meetings Set Up';
    } else if (gotBack) {
      stage = 'Got Back to Us';
    } else {
      stage = 'Contacted';
    }

    let linkedinStatus = c.linkedin_status || 'not_connected';
    if (!c.linkedin_status) {
      const hasLiConnected = events.some(e => e.contact_id === c.id && (e.kind === 'linkedin_connected' || e.kind === 'linkedin_message_in'));
      const hasLiInvite = events.some(e => e.contact_id === c.id && e.kind === 'linkedin_invite');
      if (hasLiConnected) linkedinStatus = 'connected';
      else if (hasLiInvite) linkedinStatus = 'invite_sent';
      else if (c.linkedin) linkedinStatus = 'not_connected';
    }

    return {
      ...c,
      stage,
      hasHumanReply,
      hasMeeting: hasAnyMeet,
      isFollowUpMeet,
      linkedin_status: linkedinStatus,
      dnc: Boolean(c.dnc || c.never_contact),
    };
  });

  const normalizedDeals = [];
  for (const c of normalizedContacts) {
    const existing = dealMap.get(c.id);
    if (existing) {
      normalizedDeals.push({ ...existing, stage: c.stage });
    } else {
      const newDeal = {
        id: 'd_' + c.id.replace(/^c_/, ''),
        contact_id: c.id,
        title: c.org || c.name || c.email || 'Software Opportunity',
        stage: c.stage,
        value: 0,
      };
      normalizedDeals.push(newDeal);
      dealMap.set(c.id, newDeal);
    }
  }

  // Derive Salesforce Accounts
  const accountsMap = new Map();
  for (const c of normalizedContacts) {
    if (c.org) {
      const accId = 'acc_' + c.org.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (!accountsMap.has(accId)) {
        accountsMap.set(accId, {
          id: accId,
          name: c.org,
          contactsCount: 0,
        });
      }
      accountsMap.get(accId).contactsCount++;
    }
  }

  return {
    contacts: normalizedContacts,
    deals: normalizedDeals,
    accounts: [...accountsMap.values()],
    events,
    queue,
    messages,
    autoReplies,
    meetings,
    sync,
    notifications,
  };
}

export async function GET() {
  if (dbEnabled()) {
    try {
      const [contacts, deals, events, queue, messages, meetings, sync, notifications] = await Promise.all([
        selectAll('contacts', 'id,email,name,org,linkedin,status,dnc,source,sentiment,needs_followup,reply_note,next_action,alternate_contact,never_contact'),
        selectAll('deals', 'id,contact_id,title,stage,value'),
        selectAll('events', 'contact_id,channel,kind,date,summary,source_file'),
        selectAll('queue_items'),
        selectAll('messages', 'id,contact_id,direction,kind,date,subject,snippet,url,thread_id,account,sentiment,needs_followup,note,alternate_contact,ooo_type'),
        selectAll('meetings', 'id,title,start_at,end_at,external_attendees,contact_ids,url,meet_link,calendar,description'),
        selectAll('sync_state', 'key,last_synced_at,info', 'key'),
        selectAll('notifications', 'id,kind,title,body,contact_id,ref,created_at,read_at', 'created_at.desc', 200),
      ]);
      const normalized = normalizeData({ contacts, deals, events, queue, messages, meetings, sync, notifications });
      return Response.json({ source: 'supabase', ...normalized });
    } catch (e) {
      console.error('Supabase read failed:', e.message);
      return Response.json({ error: 'database read failed: ' + e.message }, { status: 502 });
    }
  }

  // Offline / seed fallback
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'seed.json'), 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizeData(parsed);
    return Response.json({ source: 'seed', ...normalized });
  } catch (err) {
    return Response.json({
      source: 'none',
      contacts: [],
      deals: [],
      accounts: [],
      events: [],
      queue: [],
      messages: [],
      meetings: [],
      notifications: [],
      error: 'no database and seed.json missing',
    });
  }
}
