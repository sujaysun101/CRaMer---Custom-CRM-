// Pure data model: indexes the /api/data payload and derives timelines, follow-ups, pipeline stages and next actions.
// Strictly scopes data to Zergware and MultiDomain Systems software pipeline.
import {
  isExcludedContact,
  isExcludedMessage,
  isExcludedMeeting,
  isAutoReplyMessage,
  COMPANY_DOMAINS,
  CONTACT_NAME_ENRICHMENTS,
  CONTACT_ORG_ENRICHMENTS,
} from '../../lib/scopeFilter.js';

export const STAGES = [
  'Contacted',
  'Got Back to Us',
  'Meetings Set Up',
  'Follow-Up Meeting(s)',
];

export const stageSlug = s =>
  (s || 'contacted')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const QS = ['Open', 'Drafted', 'Waiting', 'Blocked', 'Closed', 'Unknown'];
export const LI_STATUSES = [
  ['not_connected', 'Not Connected'],
  ['invite_sent', 'Invite Sent'],
  ['connected', 'Connected'],
  ['messaged', 'Messaged'],
];
export const TEAM = COMPANY_DOMAINS;
const DAY = 864e5, TZ = 'America/New_York';
export const ts = x => (x ? new Date(x.length === 10 ? x + 'T12:00:00-04:00' : x).getTime() : 0);
export const ago = t => {
  if (!t) return '—'; const d = (Date.now() - t) / DAY;
  if (d < 0) { const f = -d; return f < 1 ? 'today' : f < 2 ? 'tomorrow' : `in ${Math.round(f)}d`; }
  if (d < 1 / 24) return 'just now'; if (d < 1) return `${Math.round(d * 24)}h ago`;
  if (d < 30) return `${Math.round(d)}d ago`; if (d < 365) return `${Math.round(d / 30)}mo ago`; return `${Math.round(d / 365)}y ago`;
};
export const fmt = (t, o = {}) => (t ? new Date(t).toLocaleString('en-US', { timeZone: TZ, ...o }) : '');
export const fDate = t => fmt(t, { month: 'short', day: 'numeric', year: new Date(t).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
export const fTime = t => fmt(t, { hour: 'numeric', minute: '2-digit' });
export const fFull = t => fmt(t, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
export const fCurrency = val => (val != null ? '$' + Number(val).toLocaleString() : '$0');
export const who = c => c?.name || CONTACT_NAME_ENRICHMENTS[c?.id] || c?.email || c?.linkedin?.replace(/^.*linkedin\.com\/in\//, '') || c?.org || 'Unknown';
export const initials = s => (s || '?').replace(/@.*/, '').replace(/[^A-Za-z ._-]/g, '').split(/[ ._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
export function bizDays(from, to) { let n = 0; const d = new Date(from); d.setHours(12); const end = new Date(to); while (d < end) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (d <= end && w && w !== 6) n++; } return n; }
export function weekStart(t) { const d = new Date(new Date(t).toLocaleString('en-US', { timeZone: TZ })); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); d.setHours(0, 0, 0, 0); return d.getTime(); }
const isTeam = e => !!e && TEAM.some(domain => e.endsWith('@' + domain));

const FOLLOW_UP_MEET_RX = /follow-?up|next steps|demo|advisory|in-person|second|weekly multidomain/i;

export function isFollowUpMeetingContact(meets = []) {
  if (!meets || meets.length === 0) return false;
  if (meets.length >= 2) return true;
  return meets.some(m => FOLLOW_UP_MEET_RX.test(m.title || ''));
}

export function mapDbStageToUiStage(dbStage, c) {
  if (STAGES.includes(dbStage)) return dbStage;
  if (c?.meets?.length > 0) {
    return isFollowUpMeetingContact(c.meets) ? 'Follow-Up Meeting(s)' : 'Meetings Set Up';
  }
  if (dbStage === 'Negotiation') return 'Follow-Up Meeting(s)';
  if (dbStage === 'Meeting') return 'Meetings Set Up';
  if ((c?.lastHuman > 0 && c?.sentiment !== 'negative') || dbStage === 'Replied') {
    if (c?.sentiment === 'negative') return 'Contacted';
    return 'Got Back to Us';
  }
  return 'Contacted';
}

export function build(d, ov = { stage: {}, dnc: {}, fu: {}, qs: {}, nr: {}, li: {} }) {
  const now = Date.now();
  const C = {};

  const dealByContact = new Map((d.deals || []).map(x => [x.contact_id, x]));
  const humanReplyIds = new Set(
    (d.messages || [])
      .filter(m => m.direction === 'in' && m.kind === 'reply' && !isAutoReplyMessage(m))
      .map(m => m.contact_id)
  );
  const meetContactIds = new Set((d.meetings || []).flatMap(m => m.contact_ids || []));
  const autoReplyIds = new Set([
    ...(d.autoReplies || []).map(m => m.contact_id),
    ...(d.messages || []).filter(m => isAutoReplyMessage(m)).map(m => m.contact_id),
  ]);

  // Strictly filter out non-company, personal, academic/NYU classes, mentor contacts, and auto-reply-only contacts
  const validContacts = (d.contacts || []).filter(c => {
    const hasHuman = humanReplyIds.has(c.id) || meetContactIds.has(c.id) || Boolean(c.hasHumanReply);
    if ((autoReplyIds.has(c.id) || c.source === 'auto_reply' || c.sentiment === 'ooo') && !hasHuman) {
      return false;
    }
    return !isExcludedContact(c, {
      hasDeal: dealByContact.has(c.id),
      hasHumanReply: hasHuman,
    });
  });

  for (const c of validContacts) {
    C[c.id] = {
      ...c,
      name: c.name || CONTACT_NAME_ENRICHMENTS[c.id] || null,
      org: c.org || CONTACT_ORG_ENRICHMENTS[c.id] || null,
      dnc: c.never_contact || (ov.dnc?.[c.id] ?? c.dnc),
      needs_followup: !c.never_contact && (ov.fu?.[c.id] ?? c.needs_followup),
      linkedin_status: ov.li?.[c.id] ?? (c.linkedin_status || (c.linkedin ? 'not_connected' : 'not_connected')),
      team: isTeam(c.email),
      tl: [],
      meets: [],
      emails: [],
      lastOut: 0,
      lastIn: 0,
      lastHuman: 0,
      lastAuto: null,
      lastHumanMsg: null,
      ch: new Set(),
      deal: null,
    };
    if (c.email) C[c.id].ch.add('email');
    if (c.linkedin) C[c.id].ch.add('linkedin');
  }

  // Bind deals / opportunities
  for (const x of d.deals || []) {
    if (C[x.contact_id]) {
      C[x.contact_id].deal = { ...x };
    }
  }

  // Outreach log events (excluding auto_reply noise)
  for (const e of d.events || []) {
    const c = C[e.contact_id];
    if (!c) continue;
    if (e.kind === 'auto_reply') continue;
    const t = ts(e.date);
    const ch = e.channel === 'linkedin' ? 'linkedin' : (e.channel === 'meeting' ? 'meeting' : 'email');
    c.ch.add(ch);

    if (e.kind === 'draft_created') {
      c.tl.push({ t, ch, type: 'draft', title: 'Outreach drafted', body: e.summary, src: e.source_file });
      continue;
    }

    const title = e.kind === 'linkedin_invite' ? 'LinkedIn invite sent'
      : e.kind === 'linkedin_message' ? 'You messaged on LinkedIn'
      : e.kind === 'linkedin_message_in' ? `${who(c)} messaged on LinkedIn`
      : e.kind === 'linkedin_connected' ? 'Connected on LinkedIn'
      : e.kind === 'sent' ? 'Email sent'
      : e.kind === 'bounce' ? 'Delivery issue'
      : e.kind;

    c.tl.push({
      t, ch, type: e.kind, title, body: e.summary, src: e.source_file,
      dir: /reply|_in$/.test(e.kind) ? 'in' : 'out',
    });

    if (['sent', 'linkedin_invite', 'linkedin_message'].includes(e.kind)) c.lastOut = Math.max(c.lastOut, t);
    if (e.kind === 'linkedin_message_in') {
      c.lastIn = Math.max(c.lastIn, t);
      c.lastHuman = Math.max(c.lastHuman, t);
    }
    if (e.kind === 'linkedin_connected' && !ov.li?.[c.id]) {
      c.linkedin_status = 'connected';
    }
  }

  // Filter and associate email messages (excluding auto-replies while keeping human replies in those threads)
  const validMessages = (d.messages || []).filter(m => {
    const c = C[m.contact_id];
    return c && !isExcludedMessage(m, c);
  });

  for (const m of validMessages) {
    const c = C[m.contact_id];
    if (!c) continue;
    const t = ts(m.date);
    c.ch.add('email');

    const title = m.direction === 'out'
      ? 'You emailed'
      : `${who(c)} replied`;

    const emailObj = {
      ...m,
      t, ch: 'email', type: m.kind, dir: m.direction, title,
      subject: m.subject || '(no subject)', body: m.body || m.snippet, snippet: m.snippet,
      url: m.url, sentiment: m.sentiment, note: m.note, alt: m.alternate_contact, account: m.account,
    };

    c.tl.push(emailObj);
    c.emails.push(emailObj);

    if (m.direction === 'out') {
      c.lastOut = Math.max(c.lastOut, t);
    } else {
      c.lastIn = Math.max(c.lastIn, t);
      if (m.kind === 'reply') {
        if (t >= c.lastHuman) c.lastHumanMsg = m;
        c.lastHuman = Math.max(c.lastHuman, t);
      }
    }
  }

  // Filter and associate calendar meetings (strictly Zergware & MultiDomain Systems)
  const validMeets = (d.meetings || []).filter(meet => !isExcludedMeeting(meet, C));
  const meets = validMeets.map(m => {
    const t = ts(m.start_at);
    const te = ts(m.end_at);
    const isLive = t <= now && te >= now;
    const isToday = new Date(t).toDateString() === new Date(now).toDateString();
    const isUpcoming = t > now;
    const isPast = te < now;
    const leads = (m.contact_ids || []).map(id => C[id]).filter(Boolean);
    const needsRecap = isPast && leads.length > 0 && !leads.some(l => l.lastOut > te);
    const status = isLive ? 'live' : needsRecap ? 'recap_due' : isUpcoming ? 'upcoming' : 'completed';

    return {
      ...m,
      t, te, isLive, isToday, isUpcoming, isPast, needsRecap, status, leads,
      company: leads.find(l => l.org)?.org || '',
    };
  }).sort((a, b) => a.t - b.t);

  for (const m of meets) {
    for (const c of m.leads) {
      c.meets.push(m);
      c.ch.add('meeting');
      c.tl.push({
        t: m.t, ch: 'meeting', type: 'meeting',
        title: m.t > now ? 'Upcoming meeting' : 'Meeting',
        subject: m.title, body: m.description, url: m.url, meet: m.meet_link, m,
      });
    }
  }

  const list = Object.values(C);

  // Normalize stages into the 4 clean buckets:
  // 1. Contacted
  // 2. Got Back to Us
  // 3. Meetings Set Up
  // 4. Follow-Up Meeting(s)
  for (const c of list) {
    c.tl.sort((a, b) => b.t - a.t);
    c.emails.sort((a, b) => b.t - a.t);
    c.meets.sort((a, b) => a.t - b.t);

    if (c.tl.some(x => x.type !== 'draft')) {
      c.tl = c.tl.filter(x => x.type !== 'draft' || !c.tl.some(y => y.type === 'sent' && Math.abs(y.t - x.t) < 3 * DAY));
    }
    const real = c.tl.filter(x => x.type !== 'draft' && x.t <= now);
    c.lastTouch = real.length ? real[0].t : 0;
    c.lastTouchItem = real[0];
    c.nextMeet = c.meets.find(m => m.t > now);
    c.lastMeet = [...c.meets].reverse().find(m => m.t <= now);

    c.lastEmail = c.emails[0] || null;
    c.lastInboundEmail = c.emails.find(m => m.dir === 'in') || null;
    c.lastOutboundEmail = c.emails.find(m => m.dir === 'out') || null;

    c.isFollowUpMeet = isFollowUpMeetingContact(c.meets);
    c.hasAnyMeet = c.meets.length > 0;
    c.gotBack = (c.lastHuman > 0 && c.sentiment !== 'negative') || c.hasAnyMeet;
    c.wasContacted = c.status === 'sent' || c.status === 'rerouted' || c.source === 'linkedin' || c.source === 'reply' || c.lastOut > 0 || c.gotBack;

    let computedStage = 'Contacted';
    if (c.isFollowUpMeet) {
      computedStage = 'Follow-Up Meeting(s)';
    } else if (c.hasAnyMeet) {
      computedStage = 'Meetings Set Up';
    } else if (c.gotBack) {
      computedStage = 'Got Back to Us';
    } else {
      computedStage = 'Contacted';
    }

    const stageOverride = ov.stage?.[c.id] || (c.deal && ov.stage?.[c.deal.id]);
    c.stage = stageOverride && STAGES.includes(stageOverride) ? stageOverride : computedStage;
    if (!c.deal) {
      c.deal = { id: 'd_' + c.id, contact_id: c.id, title: c.org || who(c), stage: c.stage, value: 0 };
    } else {
      c.deal.stage = c.stage;
    }

    c.dealValue = c.deal?.value || 0;
    c.dealValueFormatted = fCurrency(c.dealValue);

    c.q = [who(c), c.name, c.email, c.org, c.linkedin, c.reply_note, c.title, c.stage, c.linkedin_status]
      .filter(Boolean).join(' ').toLowerCase();
  }

  // Follow-ups & Signals:
  // A lead is awaiting your reply ONLY if they sent a human reply, you haven't replied since (lastOut <= lastHuman), and they didn't decline.
  const awaiting = list
    .filter(c => !c.dnc && !c.team && c.needs_followup && c.lastHuman > 0 && c.lastOut <= c.lastHuman && c.sentiment !== 'negative')
    .map(c => ({
      c,
      t: c.lastHuman || c.lastIn,
      why: c.next_action || 'Reply needed',
      msg: c.lastHumanMsg,
    }));

  const recap = meets.filter(m => m.needsRecap && now - m.te < 30 * DAY).map(m => {
    const leads = m.leads.filter(c => !c.dnc && !c.team);
    if (!leads.length) return null;
    return { m, leads, t: m.te, c: leads[0], why: 'Send recap and next steps' };
  }).filter(Boolean).sort((a, b) => b.t - a.t);

  const autoB = [];
  const inAuto = new Set();

  const nudge = list
    .filter(c => !c.dnc && !c.team && c.lastOut && !c.lastHuman && !c.meets.length && c.stage === 'Contacted' && bizDays(c.lastOut, now) >= 5)
    .map(c => ({ c, t: c.lastOut, why: `Nudge — ${bizDays(c.lastOut, now)} business days, no reply`, ch: c.tl.find(x => x.t === c.lastOut)?.ch }))
    .sort((a, b) => b.t - a.t);

  const fuSet = {
    awaiting: new Set(awaiting.map(x => x.c.id)),
    recap: new Set(recap.flatMap(x => x.leads.map(c => c.id))),
    auto: inAuto,
    nudge: new Set(nudge.map(x => x.c.id)),
  };

  for (const c of list) {
    c.next = c.dnc ? { k: 'dnc', s: 'Do not contact' }
      : fuSet.awaiting.has(c.id) ? { k: 'hot', s: c.next_action || 'Reply needed' }
      : c.nextMeet ? { k: 'meet', s: `Prep: ${fDate(c.nextMeet.t)} meeting` }
      : fuSet.recap.has(c.id) ? { k: 'hot', s: 'Send meeting recap' }
      : fuSet.nudge.has(c.id) ? { k: 'warn', s: 'Nudge (no reply)' }
      : c.lastHuman ? { k: 'mute', s: c.next_action || 'Got back to us' }
      : !c.lastOut ? { k: 'mute', s: 'Send first outreach' }
      : c.lastOut || c.lastIn ? { k: 'mute', s: 'Waiting on them' } : { k: 'mute', s: '—' };
  }

  // Priority Scoring:
  // Unresponded human replies (ASK) are Tier #1 (9500) and ranked by actionability and recency
  // so Patty, Jon, Nathan Beebe, Michael Kerr, Spatial Wings, Justice Castillo, Matthew Kemelek, etc. appear right at the top.
  const T = {
    ASK: [9500, 'Reply due'],
    DUE: [9000, 'Due'],
    MEET: [8200, 'Meeting'],
    OWE: [7500, 'You owe'],
    WARM: [6000, 'Warm'],
    THEM: [5200, 'Waiting'],
    NUDGE: [5000, 'Nudge'],
    FACT: [3000, 'Record'],
    NONE: [0, ''],
  };
  const days = t => (t ? Math.max(0, (now - t) / DAY) : 0);
  const W = t => Math.min(days(t), 400);
  const IMP = {
    'Follow-Up Meeting(s)': 3.5,
    'Meetings Set Up': 2.5,
    'Got Back to Us': 2.0,
    Contacted: 0.5,
  };
  const SENT_BOOST = {
    'meeting-request': 430,
    positive: 425,
    referral: 420,
    neutral: 50,
  };
  const imp = c => Math.min(3.5, (IMP[c.stage] || 0)) / 4;
  const mk = (tier, c, sub, why) => ({ score: Math.round((T[tier][0] + sub + (c ? imp(c) : 0)) * 10) / 10, tier, label: T[tier][1], why });
  const stageWhy = c => (c.stage === 'Meetings Set Up' || c.stage === 'Follow-Up Meeting(s)') ? ` · ${c.stage}` : '';

  const loopPri = q => {
    const w = days(q.t), due = q.due_date ? ts(q.due_date) : 0;
    if (due) return mk('DUE', q.c, (due < now ? 300 + Math.min(days(due), 200) : Math.max(0, 200 - (due - now) / DAY)), due < now ? `Overdue since ${q.due_date}` : `Due ${q.due_date}`);
    const tier = { ask: 'OWE', commitment_by_me: 'OWE', commitment_by_them: 'THEM', record_fact: 'FACT' }[q.type] || 'FACT';
    return mk(tier, q.c, Math.max(0, 300 - w * 3), `${{ ask: 'Asked you', commitment_by_me: 'You committed', commitment_by_them: 'They committed', record_fact: 'Record' }[q.type] || 'Flagged'} ${ago(q.t)}`);
  };

  const ORDER = { ask: 1, commitment_by_me: 2, commitment_by_them: 3, record_fact: 4 };
  const loops = (d.queue || []).map(q => ({ ...q, status: ov.qs?.[q.id] || q.status, c: C[q.contact_id] }))
    .filter(q => q.c && !q.c.dnc && ['Open', 'Blocked', 'Unknown', 'Drafted'].includes(q.status))
    .map(q => ({ ...q, t: ts(q.source_timestamp), overdue: q.due_date && ts(q.due_date) < now, why: q.summary }))
    .map(q => ({ ...q, pri: loopPri(q) }))
    .sort((a, b) => (b.pri.score - a.pri.score) || (ORDER[a.type] - ORDER[b.type]) || (b.t - a.t));

  const loopBy = {};
  for (const q of loops) if (!loopBy[q.contact_id] || q.pri.score > loopBy[q.contact_id].pri.score) loopBy[q.contact_id] = q;

  for (const c of list) {
    const cands = [];
    if (c.dnc) { c.pri = mk('NONE', null, -100, 'Do not contact'); continue; }

    if (fuSet.awaiting.has(c.id)) {
      const t = c.lastHuman || c.lastIn;
      const sentBoost = SENT_BOOST[c.sentiment] ?? 200;
      const recencyBoost = Math.max(0, 400 - days(t) * 6);
      const actionLabel = c.sentiment === 'meeting-request' ? 'Requested a meeting'
        : c.sentiment === 'referral' ? 'Sent a referral'
        : c.sentiment === 'positive' ? 'Positive reply'
        : 'Replied';
      cands.push(mk('ASK', c, sentBoost + recencyBoost, `${actionLabel} ${ago(t)} — awaiting your reply${c.reply_note ? ` · ${c.reply_note}` : stageWhy(c)}`));
    }

    if (c.nextMeet && c.nextMeet.t - now < 7 * DAY) {
      const dd = (c.nextMeet.t - now) / DAY;
      cands.push(mk('MEET', c, (7 - dd) * 50, `Meeting ${dd < 1 ? 'within 24h' : fDate(c.nextMeet.t)} — prep`));
    }
    if (fuSet.recap.has(c.id)) {
      const r = recap.find(x => x.leads.includes(c));
      cands.push(mk('OWE', c, Math.max(0, 300 - days(r.t) * 5), `Recap due — met ${ago(r.t)}`));
    }
    if (loopBy[c.id]) cands.push(loopBy[c.id].pri);

    const warmT = Math.max(c.lastHuman, c.lastMeet?.te || 0);
    if (warmT && !fuSet.awaiting.has(c.id) && !c.nextMeet && c.lastTouch && bizDays(c.lastTouch, now) > 5) {
      cands.push(mk('WARM', c, Math.max(0, 300 - days(c.lastTouch) * 2), `${c.lastMeet && c.lastMeet.te >= c.lastHuman ? 'Met' : 'Got back'} before, quiet ${bizDays(c.lastTouch, now)} business days${stageWhy(c)}`));
    }
    if (fuSet.nudge.has(c.id)) cands.push(mk('NUDGE', c, W(c.lastOut), `No reply ${bizDays(c.lastOut, now)} business days after your outreach`));

    c.pri = cands.sort((a, b) => b.score - a.score)[0] || mk('NONE', c, Math.max(0, 400 - days(c.lastTouch)), c.lastTouch ? `Last touch ${ago(c.lastTouch)}` : 'No activity yet');
  }

  const byPri = (a, b) => (b.pri.score - a.pri.score) || (b.t - a.t);
  for (const x of awaiting) x.pri = x.c.pri; awaiting.sort(byPri);
  for (const x of recap) x.pri = x.leads.map(c => c.pri).sort((a, b) => b.score - a.score)[0]; recap.sort(byPri);
  for (const x of nudge) x.pri = x.c.pri; nudge.sort(byPri);

  const ws = weekStart(now), lws = ws - 7 * DAY;
  const human = validMessages.filter(m => m.direction === 'in' && m.kind === 'reply' && C[m.contact_id] && !C[m.contact_id].team);
  const inWeek = (t, a) => t >= a && t < a + 7 * DAY;
  const outBy = {};
  for (const m of validMessages) if (m.direction === 'out') (outBy[m.contact_id] ||= []).push(ts(m.date));
  for (const k in outBy) outBy[k].sort((a, b) => a - b);
  const resp = [];
  let unanswered = 0;
  for (const m of human) {
    const t = ts(m.date);
    if (now - t > 90 * DAY) continue;
    const o = (outBy[m.contact_id] || []).find(x => x > t);
    if (o) resp.push((o - t) / 36e5); else unanswered++;
  }
  resp.sort((a, b) => a - b);

  // Clean 4-metric Leaderboard:
  // 1. Who was contacted
  // 2. Who got back to us
  // 3. The meetings set up
  // 4. Whom we set up a follow-up meeting(s) with
  const funnel = {
    contacted: list.filter(c => c.wasContacted).length,
    gotBack: list.filter(c => c.gotBack).length,
    meetingsSetUp: list.filter(c => c.hasAnyMeet).length,
    meetingsEventsCount: meets.length,
    followUpMeetings: list.filter(c => c.isFollowUpMeet).length,
  };

  const stats = {
    repliesWk: human.filter(m => inWeek(ts(m.date), ws)).length,
    repliesLwk: human.filter(m => inWeek(ts(m.date), lws)).length,
    meetsWk: meets.filter(m => m.leads.length && inWeek(m.t, ws)).length,
    meetsLwk: meets.filter(m => m.leads.length && inWeek(m.t, lws)).length,
    medianRespH: resp.length ? (resp.length % 2 ? resp[(resp.length - 1) / 2] : (resp[resp.length / 2 - 1] + resp[resp.length / 2]) / 2) : null,
    respN: resp.length,
    unanswered,
    weekMeets: meets.filter(m => m.leads.length && inWeek(m.t, ws)),
    ws,
  };

  const top = list.filter(c => !c.dnc && !c.team && c.pri.score >= 3000).sort((a, b) => b.pri.score - a.pri.score);
  const activity = list
    .filter(c => !c.team && !c.never_contact)
    .flatMap(c => c.tl.filter(x => x.type !== 'draft' && x.type !== 'auto_reply' && x.t && x.t <= now).slice(0, 6).map(x => ({ ...x, c })))
    .sort((a, b) => b.t - a.t)
    .slice(0, 40);

  const allEmails = validMessages.map(m => ({
    ...m,
    t: ts(m.date),
    c: C[m.contact_id],
  })).filter(m => m.c && !isAutoReplyMessage(m)).sort((a, b) => b.t - a.t);

  const replies = allEmails.filter(m => m.direction === 'in');
  const sentEmails = allEmails.filter(m => m.direction === 'out');

  // Dedicated Automatic Reply collection (kept strictly separate from main CRM tabs)
  const rawAutoList = [
    ...(d.autoReplies || []),
    ...(d.messages || []).filter(m => isAutoReplyMessage(m)),
  ];
  const seenAutoIds = new Set();
  const autoReplies = [];
  for (const m of rawAutoList) {
    if (!m || seenAutoIds.has(m.id)) continue;
    seenAutoIds.add(m.id);
    const linkedContact = C[m.contact_id] || {
      id: m.contact_id,
      name: m.contact_name || CONTACT_NAME_ENRICHMENTS[m.contact_id] || null,
      email: m.contact_email || null,
      org: m.contact_org || CONTACT_ORG_ENRICHMENTS[m.contact_id] || null,
      stage: 'Automatic Reply',
      isPureAutoReply: true,
    };
    autoReplies.push({
      ...m,
      t: ts(m.date),
      subject: m.subject || 'Automatic reply',
      body: m.body || m.snippet || '',
      snippet: m.snippet || '',
      alt: m.contact_alternate || m.alternate_contact || linkedContact.alternate_contact || null,
      hasHumanFollowup: Boolean(m.has_human_followup || (C[m.contact_id] && C[m.contact_id].lastHuman > 0)),
      c: linkedContact,
    });
  }
  autoReplies.sort((a, b) => b.t - a.t);

  return {
    C,
    list,
    meets,
    awaiting,
    recap,
    autoB,
    nudge,
    loops,
    allEmails,
    replies,
    sentEmails,
    autoReplies,
    stats,
    funnel,
    top,
    activity,
    accounts: d.accounts || [],
    queue: (d.queue || []).filter(q => C[q.contact_id]).map(q => ({ ...q, status: ov.qs?.[q.id] || q.status, c: C[q.contact_id] })),
  };
}
