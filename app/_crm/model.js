// Pure data model: indexes the /api/data payload and derives timelines, follow-ups and next actions.
export const STAGES = ['Lead', 'Contacted', 'Replied', 'Meeting', 'Negotiation', 'Won', 'Lost'];
export const QS = ['Open', 'Drafted', 'Waiting', 'Blocked', 'Closed', 'Unknown'];
export const TEAM = ['zergware.com', 'multidomainsys.com'];
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
export const who = c => c?.name || c?.email || c?.linkedin?.replace(/^.*linkedin\.com\/in\//, '') || c?.org || 'Unknown';
export const initials = s => (s || '?').replace(/@.*/, '').replace(/[^A-Za-z ._-]/g, '').split(/[ ._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
export function bizDays(from, to) { let n = 0; const d = new Date(from); d.setHours(12); const end = new Date(to); while (d < end) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (d <= end && w && w !== 6) n++; } return n; }
export function weekStart(t) { const d = new Date(new Date(t).toLocaleString('en-US', { timeZone: TZ })); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); d.setHours(0, 0, 0, 0); return d.getTime(); }
const isTeam = e => !!e && TEAM.some(d => e.endsWith('@' + d));

export function build(d, ov) {
  const now = Date.now();
  const C = {};
  for (const c of d.contacts) C[c.id] = {
    ...c, dnc: ov.dnc[c.id] ?? c.dnc, needs_followup: ov.fu[c.id] ?? c.needs_followup, team: isTeam(c.email),
    tl: [], meets: [], lastOut: 0, lastIn: 0, lastHuman: 0, lastAuto: null, lastHumanMsg: null, ch: new Set(), deal: null,
  };
  for (const x of d.deals) if (C[x.contact_id]) C[x.contact_id].deal = { ...x, stage: ov.stage[x.id] || x.stage };
  // Outreach log events (seed + LinkedIn files). Skip draft creation noise when a real send exists.
  for (const e of d.events) {
    const c = C[e.contact_id]; if (!c) continue; const t = ts(e.date);
    const ch = e.channel === 'linkedin' ? 'linkedin' : 'email';
    if (e.kind === 'draft_created') { c.tl.push({ t, ch, type: 'draft', title: 'Outreach drafted', body: e.summary, src: e.source_file }); continue; }
    c.tl.push({ t, ch, type: e.kind, title: e.kind === 'linkedin_invite' ? 'LinkedIn invite sent' : e.kind === 'linkedin_message' ? 'You messaged on LinkedIn' : e.kind === 'linkedin_message_in' ? `${who(c)} messaged on LinkedIn` : e.kind === 'linkedin_connected' ? 'Connected on LinkedIn' : e.kind === 'sent' ? 'Email sent' : e.kind === 'bounce' ? 'Delivery issue' : e.kind === 'auto_reply' ? 'Auto-reply' : e.kind, body: e.summary, src: e.source_file, dir: /reply|_in$/.test(e.kind) ? 'in' : 'out' });
    c.ch.add(ch);
    if (['sent', 'linkedin_invite', 'linkedin_message'].includes(e.kind)) c.lastOut = Math.max(c.lastOut, t);
    if (e.kind === 'linkedin_message_in') { c.lastIn = Math.max(c.lastIn, t); c.lastHuman = Math.max(c.lastHuman, t); }
  }
  for (const m of d.messages || []) {
    const c = C[m.contact_id]; if (!c) continue; const t = ts(m.date); c.ch.add('email');
    c.tl.push({ t, ch: 'email', type: m.kind, dir: m.direction, title: m.direction === 'out' ? 'You emailed' : m.kind === 'auto_reply' ? 'Auto-reply' + (m.ooo_type ? ` · ${m.ooo_type}` : '') : `${who(c)} replied`, subject: m.subject, body: m.snippet, url: m.url, sentiment: m.sentiment, note: m.note, alt: m.alternate_contact, account: m.account });
    if (m.direction === 'out') c.lastOut = Math.max(c.lastOut, t);
    else { c.lastIn = Math.max(c.lastIn, t); if (m.kind === 'reply') { if (t >= c.lastHuman) c.lastHumanMsg = m; c.lastHuman = Math.max(c.lastHuman, t); } else if (!c.lastAuto || t > ts(c.lastAuto.date)) c.lastAuto = m; }
  }
  const meets = (d.meetings || []).map(m => ({ ...m, t: ts(m.start_at), te: ts(m.end_at) })).sort((a, b) => a.t - b.t);
  for (const m of meets) {
    m.leads = (m.contact_ids || []).map(id => C[id]).filter(Boolean);
    for (const c of m.leads) { c.meets.push(m); c.ch.add('meeting'); c.tl.push({ t: m.t, ch: 'meeting', type: 'meeting', title: m.t > now ? 'Upcoming meeting' : 'Meeting', subject: m.title, body: m.description, url: m.url, meet: m.meet_link, m }); }
  }
  const list = Object.values(C);
  for (const c of list) {
    c.tl.sort((a, b) => b.t - a.t);
    // drafts are noise once something real happened on that day
    if (c.tl.some(x => x.type !== 'draft')) c.tl = c.tl.filter(x => x.type !== 'draft' || !c.tl.some(y => y.type === 'sent' && Math.abs(y.t - x.t) < 3 * DAY));
    const real = c.tl.filter(x => x.type !== 'draft' && x.t <= now);
    c.lastTouch = real.length ? real[0].t : 0; c.lastTouchItem = real[0];
    c.nextMeet = c.meets.find(m => m.t > now); c.lastMeet = [...c.meets].reverse().find(m => m.t <= now);
    c.stage = c.deal?.stage || null;
    c.q = [c.name, c.email, c.org, c.linkedin, c.reply_note].filter(Boolean).join(' ').toLowerCase();
  }
  // ---- Follow-ups (Solidifier rules: suppress DNC; bounced never exist; oldest asks first) ----
  const awaiting = list.filter(c => !c.dnc && !c.team && c.needs_followup).map(c => ({ c, t: c.lastHuman || c.lastIn, why: c.next_action || 'Reply', msg: c.lastHumanMsg })).sort((a, b) => a.t - b.t);
  const recap = meets.filter(m => m.te < now && now - m.te < 30 * DAY).map(m => {
    const leads = m.leads.filter(c => !c.dnc && !c.team); if (!leads.length) return null;
    if (leads.some(c => c.lastOut > m.te)) return null;
    return { m, leads, t: m.te, c: leads[0], why: 'Send recap and next steps' };
  }).filter(Boolean).sort((a, b) => a.t - b.t);
  const autoB = list.filter(c => !c.dnc && c.lastAuto && ts(c.lastAuto.date) > c.lastHuman && !(c.lastAuto.note || '').startsWith('rerouted')).map(c => {
    const a = c.lastAuto, at = ts(a.date);
    if (c.lastOut > at + DAY) return null; // already retried
    if (a.alternate_contact) { const alts = a.alternate_contact.split(';'); const known = alts.every(e => list.some(x => x.email === e && x.lastOut)); if (known) return null; return { c, t: at, why: `Reroute to ${alts.join(', ')}`, kind: 'reroute', msg: a }; }
    if (a.ooo_type === 'out-of-office' && now - at > 7 * DAY) return { c, t: at, why: 'Retry — should be back from OOO', kind: 'retry', msg: a };
    if (a.ooo_type === 'left/changed') return { c, t: at, why: 'Left the org — find a replacement contact', kind: 'replace', msg: a };
    return null;
  }).filter(Boolean).sort((a, b) => a.t - b.t);
  const inAuto = new Set(autoB.map(x => x.c.id));
  const nudge = list.filter(c => !c.dnc && !c.team && c.lastOut && !c.lastHuman && !(c.lastAuto && c.lastAuto.ooo_type !== 'auto-acknowledgement') && !c.meets.length && !inAuto.has(c.id) && ['Lead', 'Contacted'].includes(c.stage) && bizDays(c.lastOut, now) >= 5)
    .map(c => ({ c, t: c.lastOut, why: `Nudge — ${bizDays(c.lastOut, now)} business days, no reply`, ch: c.tl.find(x => x.t === c.lastOut)?.ch }))
    .sort((a, b) => a.t - b.t);
  const fuSet = { awaiting: new Set(awaiting.map(x => x.c.id)), recap: new Set(recap.flatMap(x => x.leads.map(c => c.id))), auto: inAuto, nudge: new Set(nudge.map(x => x.c.id)) };
  for (const c of list) {
    c.next = c.dnc ? { k: 'dnc', s: 'Do not contact' }
      : fuSet.awaiting.has(c.id) ? { k: 'hot', s: c.next_action || 'Reply' }
      : c.nextMeet ? { k: 'meet', s: `Prep: ${fDate(c.nextMeet.t)} meeting` }
      : fuSet.recap.has(c.id) ? { k: 'hot', s: 'Send meeting recap' }
      : fuSet.auto.has(c.id) ? { k: 'warn', s: autoB.find(x => x.c.id === c.id).why }
      : fuSet.nudge.has(c.id) ? { k: 'warn', s: 'Nudge (no reply)' }
      : c.lastHuman ? { k: 'mute', s: c.next_action || 'Waiting on them' }
      : c.stage === 'Lead' && !c.lastOut ? { k: 'mute', s: 'Send first outreach' }
      : c.lastOut || c.lastIn ? { k: 'mute', s: 'Waiting on them' } : { k: 'mute', s: '—' };
  }
  // Open loops flagged by Solidifier (queue_items), ordered per follow-up-rules.md
  const ORDER = { ask: 1, commitment_by_me: 2, commitment_by_them: 3, record_fact: 4 };
  const loops = (d.queue || []).map(q => ({ ...q, status: ov.qs[q.id] || q.status, c: C[q.contact_id] }))
    .filter(q => q.c && !q.c.dnc && ['Open', 'Blocked', 'Unknown', 'Drafted'].includes(q.status))
    .map(q => ({ ...q, t: ts(q.source_timestamp), overdue: q.due_date && ts(q.due_date) < now, why: q.summary }))
    .sort((a, b) => (b.overdue - a.overdue) || (ORDER[a.type] - ORDER[b.type]) || (a.t - b.t));
  const replies = (d.messages || []).filter(m => m.direction === 'in' && C[m.contact_id] && !C[m.contact_id].team).map(m => ({ ...m, t: ts(m.date), c: C[m.contact_id] })).sort((a, b) => b.t - a.t);
  return { C, list, meets, awaiting, recap, autoB, nudge, loops, replies, queue: (d.queue || []).filter(q => C[q.contact_id]).map(q => ({ ...q, status: ov.qs[q.id] || q.status, c: C[q.contact_id] })) };
}
