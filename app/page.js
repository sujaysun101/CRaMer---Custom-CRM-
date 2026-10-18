'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { STAGES, QS, build, ago, fDate, fTime, fFull, who, weekStart, ts } from './_crm/model';
import { I, Avatar, Stage, Sent, Channels, Empty, Chips, Lead } from './_crm/ui';

const NAV = [['today', 'Today', 'home'], ['followups', 'Follow-ups', 'bell'], ['leads', 'Leads', 'users'], ['pipeline', 'Pipeline', 'board'], ['meetings', 'Meetings', 'cal'], ['replies', 'Inbox', 'inbox'], ['loops', 'Open loops', 'loop']];

function useMore(n0 = 120) { // incremental rendering for long lists
  const [n, setN] = useState(n0); const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (!el) return; const o = new IntersectionObserver(e => e[0].isIntersecting && setN(x => x + n0), { rootMargin: '600px' }); o.observe(el); return () => o.disconnect(); });
  return [n, ref, () => setN(n0)];
}

export default function Home() {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  const [view, setView] = useState('today'); const [sel, setSel] = useState(null);
  const [q, setQ] = useState(''); const dq = useDeferredValue(q.trim().toLowerCase());
  const [ov, setOv] = useState({ stage: {}, dnc: {}, fu: {}, qs: {} }); const [toast, setToast] = useState('');
  const searchRef = useRef(null);
  const load = useCallback(() => fetch('/api/data').then(r => r.ok ? r.json() : Promise.reject(r.status)).then(x => { if (x.error) setErr(x.error); setD(x); }).catch(e => setErr('Could not load data (' + e + ')')), []);
  useEffect(() => { load(); const fromHash = () => { const h = location.hash.slice(1); if (NAV.some(n => n[0] === h)) setView(h); }; fromHash(); addEventListener('hashchange', fromHash); return () => removeEventListener('hashchange', fromHash); }, [load]);
  useEffect(() => { history.replaceState(null, '', '#' + view); }, [view]);
  useEffect(() => { const k = e => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus(); } if (e.key === 'Escape') setSel(null); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const M = useMemo(() => d && build(d, ov), [d, ov]);
  const edit = async (entity, id, value, key) => {
    setOv(o => ({ ...o, [key]: { ...o[key], [id]: value } }));
    const r = await fetch('/api/edit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entity, id, value }) }).catch(() => null);
    setToast(r?.ok ? 'Saved' : 'Save failed — change not persisted'); setTimeout(() => setToast(''), 2200);
  };
  const A = { M, q: dq, open: setSel, edit, go: setView };
  if (!M) return <div className="boot">{err ? <><b>CRaMer</b><p className="mute">{err}</p></> : <><div className="spin" /><span className="mute">Loading CRaMer…</span></>}</div>;
  const counts = { followups: M.awaiting.length + M.recap.length + M.autoB.length + M.nudge.length + M.loops.length, leads: M.list.filter(c => c.deal).length, meetings: M.meets.filter(m => m.t > Date.now()).length, replies: M.replies.filter(r => r.kind === 'reply').length, loops: M.queue.filter(x => !['Closed'].includes(x.status)).length };
  const last = (d.sync || []).map(s => ts(s.last_synced_at)).sort().pop();
  const title = NAV.find(n => n[0] === view)[1];
  return <div className="shell">
    <aside className="side">
      <div className="logo"><span className="mark">C</span>CRaMer</div>
      <nav>{NAV.map(([k, l, ic]) => <button key={k} className={'nav' + (view === k ? ' on' : '')} onClick={() => setView(k)}><I n={ic} /><span>{l}</span>{k === 'followups' ? <span className="n hot">{counts[k]}</span> : counts[k] != null && <span className="n">{counts[k]}</span>}</button>)}</nav>
      <div className="foot"><div><span className={'dot ' + (d.source === 'supabase' ? 'ok' : 'warn')} />{d.source === 'supabase' ? 'Live data' : 'Offline seed data'}</div><div className="mute">{last ? 'Synced ' + ago(last) : 'Not synced yet'}</div></div>
    </aside>
    <main className="main">
      <header className="top">
        <h1>{title}</h1>
        <div className="search"><I n="search" s={15} /><input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search leads, orgs, emails, meetings…" />{q ? <button className="x" onClick={() => setQ('')}><I n="x" s={14} /></button> : <kbd>/</kbd>}</div>
        <button className="btn ghost" onClick={load} title="Reload data"><I n="refresh" s={15} /></button>
      </header>
      <div className="content">
        {view === 'today' && <Today {...A} />}
        {view === 'followups' && <FollowUps {...A} />}
        {view === 'leads' && <Leads {...A} />}
        {view === 'pipeline' && <Pipeline {...A} />}
        {view === 'meetings' && <Meetings {...A} />}
        {view === 'replies' && <Inbox {...A} />}
        {view === 'loops' && <Loops {...A} />}
      </div>
    </main>
    {sel && M.C[sel] && <Drawer c={M.C[sel]} {...A} close={() => setSel(null)} />}
    {toast && <div className={'toast' + (toast.startsWith('Save failed') ? ' bad' : '')}>{toast}</div>}
  </div>;
}

const match = (c, q) => !q || c.q.includes(q);
function Kpi({ l, v, s, onClick, tone }) { return <button className={'kpi ' + (tone || '')} onClick={onClick}><span className="kpi-l">{l}</span><span className="kpi-v">{v}</span>{s && <span className="kpi-s">{s}</span>}</button>; }

function Today({ M, open, go }) {
  const now = Date.now(), wk = now + 7 * 864e5;
  const pipe = M.list.filter(c => c.deal && !c.dnc);
  const up = M.meets.filter(m => m.t > now && m.t < wk);
  const r7 = M.replies.filter(r => r.kind === 'reply' && now - r.t < 7 * 864e5);
  const contacted = pipe.filter(c => c.lastOut).length, replied = pipe.filter(c => c.lastHuman).length;
  const pastMeets = M.meets.filter(m => m.t <= now).length;
  const byStage = STAGES.map(s => [s, pipe.filter(c => c.stage === s).length]);
  const total = byStage.reduce((a, b) => a + b[1], 0) || 1;
  const hour = +new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
  return <div className="today">
    <div className="hello"><h2>Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, Sujay</h2><p className="mute">{M.awaiting.length} people are waiting on you · {up.length} meeting{up.length === 1 ? '' : 's'} in the next 7 days · {M.nudge.length} leads ready for a nudge</p></div>
    <div className="kpis">
      <Kpi l="Awaiting your reply" v={M.awaiting.length} s="oldest first" tone="hot" onClick={() => go('followups')} />
      <Kpi l="Recaps due" v={M.recap.length} s="meetings in last 30 days" tone="warn" onClick={() => go('followups')} />
      <Kpi l="Upcoming meetings" v={M.meets.length - pastMeets} s={`${pastMeets} held in 2026`} onClick={() => go('meetings')} />
      <Kpi l="Replies (7 days)" v={r7.length} s={`${M.replies.filter(r => r.kind === 'reply').length} human replies total`} onClick={() => go('replies')} />
      <Kpi l="Reply rate" v={contacted ? Math.round(100 * replied / contacted) + '%' : '—'} s={`${replied} of ${contacted} contacted`} onClick={() => go('leads')} />
      <Kpi l="Active pipeline" v={pipe.filter(c => !['Won', 'Lost'].includes(c.stage)).length} s={`${byStage[3][1]} at Meeting stage`} onClick={() => go('pipeline')} />
    </div>
    <div className="bar">{byStage.filter(x => x[1]).map(([s, n]) => <span key={s} className={'seg st-' + s.toLowerCase()} style={{ flexGrow: Math.max(n / total, .04) }} title={`${s}: ${n}`}><b>{n}</b> {s}</span>)}</div>
    <div className="grid2">
      <section className="card"><div className="card-h"><h3>Awaiting your reply</h3><button className="link" onClick={() => go('followups')}>View all</button></div>
        {M.awaiting.slice(0, 7).map(x => <Row key={x.c.id} x={x} open={open} />)}{!M.awaiting.length && <Empty t="Inbox zero" s="Nobody is waiting on you." />}</section>
      <section className="card"><div className="card-h"><h3>Next 7 days</h3><button className="link" onClick={() => go('meetings')}>Calendar</button></div>
        {up.map(m => <MeetRow key={m.id} m={m} open={open} compact />)}{!up.length && <Empty t="No meetings this week" />}</section>
      <section className="card"><div className="card-h"><h3>Latest replies</h3><button className="link" onClick={() => go('replies')}>Inbox</button></div>
        {M.replies.filter(r => r.kind === 'reply').slice(0, 6).map(r => <MsgRow key={r.id} r={r} open={open} />)}</section>
      <section className="card"><div className="card-h"><h3>Recaps due</h3><button className="link" onClick={() => go('followups')}>View all</button></div>
        {M.recap.slice(-6).reverse().map(x => <MeetRow key={x.m.id} m={x.m} open={open} compact />)}{!M.recap.length && <Empty t="All recaps sent" />}</section>
    </div>
  </div>;
}

function Row({ x, open, extra }) {
  const c = x.c, m = x.msg;
  return <div className="row" onClick={() => open(c.id)}>
    <Avatar c={c} s={32} />
    <div className="row-m"><div className="row-t"><b>{who(c)}</b>{c.org && <span className="mute">· {c.org}</span>}<Sent s={c.sentiment} /></div>
      <div className="row-s">{m?.snippet || c.reply_note || x.why}</div></div>
    <div className="row-r"><span className="why">{x.why}</span><span className="mute sm">{ago(x.t)}</span>
      {extra}{m?.url && <a className="btn sm" href={m.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}><I n="mail" s={13} />{m.url.includes('mail.google') ? 'Open in Gmail' : 'Open source'}</a>}</div>
  </div>;
}

function FollowUps({ M, open, q, edit }) {
  const [tab, setTab] = useState('awaiting');
  const f = xs => xs.filter(x => !q || (x.c && match(x.c, q)) || (x.m && x.m.title.toLowerCase().includes(q)));
  const B = { awaiting: f(M.awaiting), recap: f(M.recap), nudge: f(M.nudge), auto: f(M.autoB), loops: f(M.loops) };
  const [n, more, reset] = useMore(80); useEffect(reset, [tab, q]);
  const desc = { awaiting: 'Their message is the latest in the thread and it isn’t a “no”. Oldest first.', recap: 'Meetings that ended in the last 30 days with no email from you to the attendees since.', nudge: 'You reached out 5+ business days ago (email or LinkedIn), no reply, no meeting. Oldest first.', auto: 'Out-of-office or left-the-company auto-replies: retry, or reroute to the alternate they named.', loops: 'Asks, commitments and facts flagged by Solidifier (and earlier logs). Overdue first, then asks oldest first, then your commitments.' };
  return <div>
    <Chips v={tab} set={setTab} opts={[['awaiting', 'Awaiting your reply'], ['recap', 'Recap due'], ['nudge', 'Nudge due'], ['auto', 'Auto-replies'], ['loops', 'Flagged loops']]} counts={Object.fromEntries(Object.entries(B).map(([k, v]) => [k, v.length]))} />
    <p className="mute desc">{desc[tab]} Nothing is ever sent from CRaMer — links open the thread so you can act.</p>
    <div className="card list">
      {tab === 'recap' ? B.recap.slice(0, n).map(x => <MeetRow key={x.m.id} m={x.m} open={open} why={x.why} />)
        : tab === 'loops' ? B.loops.slice(0, n).map(x => <Row key={x.id} x={{ ...x, msg: { snippet: x.quote ? `“${x.quote}”` : x.summary, url: x.source_link } }} open={open} extra={<>
            {x.overdue && <span className="pill live">Overdue</span>}{x.due_date && <span className="mute sm">due {x.due_date}</span>}
            <select value={x.status} onClick={e => e.stopPropagation()} onChange={e => edit('queue_item', x.id, e.target.value, 'qs')}>{QS.map(s => <option key={s}>{s}</option>)}</select></>} />)
        : B[tab].slice(0, n).map(x => <Row key={x.c.id + tab} x={x} open={open} extra={tab === 'awaiting' && <button className="btn sm ghost" title="Mark handled" onClick={e => { e.stopPropagation(); edit('followup', x.c.id, false, 'fu'); }}><I n="check" s={13} />Done</button>} />)}
      {!B[tab].length && <Empty t="Nothing here" s="You’re caught up in this bucket." />}
      <div ref={more} />
    </div>
  </div>;
}

function Leads({ M, open, q }) {
  const [stage, setStage] = useState('all'); const [ch, setCh] = useState('all'); const [flt, setFlt] = useState('all');
  const [sort, setSort] = useState(['touch', -1]); const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    let r = M.list.filter(c => (all || c.deal) && match(c, q) && (stage === 'all' || c.stage === stage) && (ch === 'all' || c.ch.has(ch)));
    if (flt === 'action') r = r.filter(c => ['hot', 'warn', 'meet'].includes(c.next.k)); else if (flt === 'replied') r = r.filter(c => c.lastHuman); else if (flt === 'dnc') r = r.filter(c => c.dnc); else r = r.filter(c => !c.dnc);
    const [k, dir] = sort, si = s => STAGES.indexOf(s);
    const key = { touch: c => c.lastTouch, name: c => who(c).toLowerCase(), org: c => (c.org || '~').toLowerCase(), stage: c => si(c.stage), next: c => ({ hot: 0, meet: 1, warn: 2, mute: 3, dnc: 4 }[c.next.k]) }[k];
    return r.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  }, [M, q, stage, ch, flt, sort, all]);
  const [n, more, reset] = useMore(); useEffect(reset, [q, stage, ch, flt, sort, all]);
  const H = ({ k, l, w }) => <th style={{ width: w }} onClick={() => setSort(([a, b]) => [k, a === k ? -b : k === 'touch' ? -1 : 1])} className={sort[0] === k ? 'on' : ''}>{l}{sort[0] === k && (sort[1] > 0 ? ' ↑' : ' ↓')}</th>;
  const sc = Object.fromEntries(STAGES.map(s => [s, M.list.filter(c => c.deal && !c.dnc && c.stage === s).length]));
  return <div>
    <div className="toolbar">
      <Chips v={stage} set={setStage} opts={['all', ...STAGES].map(s => [s, s === 'all' ? 'All stages' : s])} counts={sc} />
    </div>
    <div className="toolbar">
      <select value={ch} onChange={e => setCh(e.target.value)}><option value="all">All channels</option><option value="email">Email</option><option value="linkedin">LinkedIn</option><option value="meeting">Meetings</option></select>
      <select value={flt} onChange={e => setFlt(e.target.value)}><option value="all">Active (hide do-not-contact)</option><option value="action">Needs action</option><option value="replied">Has replied</option><option value="dnc">Do-not-contact only</option></select>
      <label className="tog"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> Include people with no deal (team, large events)</label>
      <span className="mute sm grow-r">{rows.length.toLocaleString()} leads</span>
    </div>
    <div className="card tbl-wrap"><table className="tbl">
      <thead><tr><H k="name" l="Lead" w="26%" /><H k="org" l="Organization" w="20%" /><H k="stage" l="Stage" w="10%" /><H k="touch" l="Last touch" w="15%" /><th style={{ width: '8%' }}>Channels</th><H k="next" l="Next action" w="21%" /></tr></thead>
      <tbody>{rows.slice(0, n).map(c => <tr key={c.id} onClick={() => open(c.id)} className={c.dnc ? 'dim' : ''}>
        <td><div className="cell-lead"><Avatar c={c} /><div><b>{who(c)}</b><div className="mute sm trunc">{c.name ? (c.email || '') : c.linkedin ? 'LinkedIn' : ''}</div></div></div></td>
        <td className="trunc">{c.org || <span className="mute">—</span>}</td>
        <td><Stage s={c.stage} /></td>
        <td><div>{ago(c.lastTouch)}</div><div className="mute sm trunc">{c.lastTouchItem?.title}</div></td>
        <td><Channels c={c} /></td>
        <td><span className={'nx nx-' + c.next.k}>{c.next.s}</span></td>
      </tr>)}</tbody></table>
      {!rows.length && <Empty t="No leads match" s="Try clearing filters or search." />}
      <div ref={more} />
    </div>
  </div>;
}

function Pipeline({ M, open, q, edit }) {
  const [drag, setDrag] = useState(null); const [over, setOver] = useState(null); const [lim, setLim] = useState({});
  const cols = useMemo(() => Object.fromEntries(STAGES.map(s => [s, M.list.filter(c => c.deal && !c.dnc && c.stage === s && match(c, q)).sort((a, b) => b.lastTouch - a.lastTouch)])), [M, q]);
  return <div className="board">{STAGES.map(s => <div key={s} className={'col' + (over === s ? ' over' : '')} onDragOver={e => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)}
    onDrop={e => { e.preventDefault(); setOver(null); if (drag && drag.stage !== s) edit('deal', drag.deal.id, s, 'stage'); setDrag(null); }}>
    <div className="col-h"><span className={'dot st-' + s.toLowerCase()} />{s}<span className="cn">{cols[s].length}</span></div>
    <div className="col-b">{cols[s].slice(0, lim[s] || 40).map(c => <div key={c.id} className="kcard" draggable onDragStart={() => setDrag(c)} onClick={() => open(c.id)}>
      <div className="kc-t"><b className="trunc">{c.org || who(c)}</b><Channels c={c} /></div>
      <div className="mute sm trunc">{c.org ? who(c) : c.email}</div>
      <div className="kc-f"><span className={'nx nx-' + c.next.k}>{c.next.s}</span><span className="mute sm">{ago(c.lastTouch)}</span></div>
    </div>)}
      {cols[s].length > (lim[s] || 40) && <button className="btn ghost wide" onClick={() => setLim(l => ({ ...l, [s]: (l[s] || 40) + 80 }))}>Show more ({cols[s].length - (lim[s] || 40)})</button>}
    </div></div>)}</div>;
}

function MeetRow({ m, open, compact, why }) {
  const now = Date.now(), live = m.t <= now && m.te >= now;
  return <div className={'mrow' + (compact ? ' compact' : '')}>
    <div className="mdate"><span className="md-d">{fDate(m.t)}</span><span className="mute sm">{fTime(m.t)}</span></div>
    <div className="row-m"><div className="row-t"><b className="trunc">{m.title}</b>{live && <span className="pill live">Live</span>}{why && <span className="why">{why}</span>}</div>
      <div className="leads">{m.leads.slice(0, compact ? 3 : 6).map(c => <Lead key={c.id} c={c} open={open} sub={c.org || ''} />)}{m.leads.length > (compact ? 3 : 6) && <span className="mute sm">+{m.leads.length - (compact ? 3 : 6)} more</span>}{!m.leads.length && <span className="mute sm">No outside attendees linked</span>}</div></div>
    <div className="row-r">{m.meet_link && <a className="btn sm pri" href={m.meet_link} target="_blank" rel="noreferrer"><I n="video" s={13} />{m.t > now - 36e5 ? 'Join' : 'Meet link'}</a>}{m.url && <a className="btn sm ghost" href={m.url} target="_blank" rel="noreferrer" title="Open in Google Calendar"><I n="ext" s={13} /></a>}{!compact && <span className="tag">{m.calendar?.includes('nyu') ? 'NYU' : 'Personal'}</span>}</div>
  </div>;
}

function Meetings({ M, open, q }) {
  const [tab, setTab] = useState('upcoming'); const now = Date.now();
  const ms = M.meets.filter(m => (tab === 'upcoming' ? m.te >= now : m.te < now) && (!q || m.title.toLowerCase().includes(q) || m.leads.some(c => match(c, q))));
  if (tab === 'past') ms.reverse();
  const groups = []; for (const m of ms) { const w = weekStart(m.t); const g = groups[groups.length - 1]; if (g && g.w === w) g.ms.push(m); else groups.push({ w, ms: [m] }); }
  const up = M.meets.filter(m => m.te >= now).length;
  return <div>
    <Chips v={tab} set={setTab} opts={[['upcoming', 'Upcoming'], ['past', 'Past']]} counts={{ upcoming: up, past: M.meets.length - up }} />
    <p className="mute desc">All 2026 meetings with outside guests from both your calendars (personal and NYU), deduplicated. Times in ET.</p>
    {groups.map(g => <section key={g.w} className="week"><h4>Week of {fDate(g.w)} <span className="mute">· {g.ms.length} meeting{g.ms.length > 1 ? 's' : ''}</span></h4><div className="card list">{g.ms.map(m => <MeetRow key={m.id} m={m} open={open} />)}</div></section>)}
    {!ms.length && <Empty t="No meetings" />}
  </div>;
}

function MsgRow({ r, open }) {
  return <div className="row" onClick={() => open(r.c.id)}><Avatar c={r.c} s={32} />
    <div className="row-m"><div className="row-t"><b>{who(r.c)}</b>{r.c.org && <span className="mute">· {r.c.org}</span>}{r.kind === 'auto_reply' ? <span className="sent s-auto">{r.ooo_type || 'auto-reply'}</span> : <Sent s={r.sentiment} />}</div>
      <div className="row-s"><span className="subj">{r.subject}</span> — {r.snippet}</div></div>
    <div className="row-r"><span className="mute sm">{fDate(r.t)}</span>{r.url && <a className="btn sm ghost" href={r.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Open in Gmail"><I n="mail" s={13} /></a>}</div></div>;
}

function Inbox({ M, open, q }) {
  const [k, setK] = useState('reply'); const [s, setS] = useState('all');
  const rs = M.replies.filter(r => r.kind === k && (s === 'all' || r.sentiment === s) && match(r.c, q));
  const [n, more, reset] = useMore(); useEffect(reset, [k, s, q]);
  const sc = Object.fromEntries(['meeting-request', 'referral', 'positive', 'neutral', 'negative'].map(x => [x, M.replies.filter(r => r.sentiment === x).length]));
  return <div>
    <div className="toolbar"><Chips v={k} set={setK} opts={[['reply', 'Human replies'], ['auto_reply', 'Auto-replies']]} counts={{ reply: M.replies.filter(r => r.kind === 'reply').length, auto_reply: M.replies.filter(r => r.kind === 'auto_reply').length }} />
      {k === 'reply' && <select value={s} onChange={e => setS(e.target.value)}><option value="all">All sentiment</option>{Object.keys(sc).map(x => <option key={x} value={x}>{x} ({sc[x]})</option>)}</select>}
      <span className="mute sm grow-r">{new Set(rs.map(r => r.contact_id)).size} people · {rs.length} messages</span></div>
    <div className="card list">{rs.slice(0, n).map(r => <MsgRow key={r.id} r={r} open={open} />)}{!rs.length && <Empty t="No messages" />}<div ref={more} /></div>
  </div>;
}

function Loops({ M, open, q, edit }) {
  const [st, setSt] = useState('active');
  const xs = M.queue.filter(x => (st === 'all' || (st === 'active' ? x.status !== 'Closed' : x.status === st)) && match(x.c, q));
  return <div>
    <Chips v={st} set={setSt} opts={[['active', 'Active'], ...QS.map(s => [s, s]), ['all', 'All']]} />
    <div className="card list">{xs.map(x => <div className="row" key={x.id} onClick={() => open(x.c.id)}><Avatar c={x.c} s={32} />
      <div className="row-m"><div className="row-t"><b>{who(x.c)}</b><span className="mute">· {x.type.replace(/_/g, ' ')}</span></div><div className="row-s">{x.summary}{x.quote ? ` — “${x.quote}”` : ''}</div></div>
      <div className="row-r" onClick={e => e.stopPropagation()}><span className="mute sm">{x.source_timestamp}</span><select value={x.status} onChange={e => edit('queue_item', x.id, e.target.value, 'qs')}>{QS.map(s => <option key={s}>{s}</option>)}</select></div></div>)}
      {!xs.length && <Empty t="No open loops" />}</div>
  </div>;
}

function Drawer({ c, close, edit, open }) {
  const [f, setF] = useState('all');
  const tl = c.tl.filter(x => f === 'all' || x.ch === f);
  const groups = []; for (const x of tl) { const k = x.t ? new Date(x.t).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' }) : 'Undated'; const g = groups[groups.length - 1]; if (g && g.k === k) g.xs.push(x); else groups.push({ k, xs: [x] }); }
  const latest = c.tl.find(x => x.url && x.ch === 'email');
  const icon = x => x.ch === 'linkedin' ? <I n="li" s={14} /> : x.ch === 'meeting' ? <I n="cal" s={14} /> : x.dir === 'in' ? <I n="in" s={14} /> : <I n="out" s={14} />;
  return <><div className="scrim" onClick={close} />
    <aside className="drawer">
      <div className="dr-h">
        <Avatar c={c} s={48} />
        <div className="grow"><h2>{who(c)}</h2><div className="mute">{[c.org, c.email].filter(Boolean).join(' · ')}</div></div>
        <button className="btn ghost" onClick={close}><I n="x" /></button>
      </div>
      <div className="dr-act">
        {c.deal && <select value={c.stage} onChange={e => edit('deal', c.deal.id, e.target.value, 'stage')}>{STAGES.map(s => <option key={s}>{s}</option>)}</select>}
        <button className={'btn' + (c.dnc ? ' danger' : ' ghost')} onClick={() => edit('contact', c.id, !c.dnc, 'dnc')}><I n="ban" s={14} />{c.dnc ? 'Do not contact' : 'Mark do-not-contact'}</button>
        {latest && <a className="btn ghost" href={latest.url} target="_blank" rel="noreferrer"><I n="mail" s={14} />Latest thread</a>}
        {c.linkedin && <a className="btn ghost" href={(c.linkedin.startsWith('http') ? '' : 'https://') + c.linkedin} target="_blank" rel="noreferrer"><I n="li" s={14} />Profile</a>}
        {c.email && <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(c.email)}>Copy email</button>}
      </div>
      <div className="facts">
        <div><span>Next action</span><b className={'nx nx-' + c.next.k}>{c.next.s}</b></div>
        <div><span>Last touch</span><b>{c.lastTouch ? fDate(c.lastTouch) + ' · ' + ago(c.lastTouch) : '—'}</b></div>
        {c.sentiment && <div><span>Sentiment</span><Sent s={c.sentiment} /></div>}
        {c.nextMeet && <div><span>Next meeting</span><b>{fFull(c.nextMeet.t)}</b></div>}
        {c.alternate_contact && <div><span>Alternate contact</span><b>{c.alternate_contact.split(';').join(', ')}</b></div>}
        {c.reply_note && <div className="wide"><span>Note</span><b>{c.reply_note}</b></div>}
      </div>
      <div className="dr-tabs"><Chips v={f} set={setF} opts={[['all', 'All activity'], ['email', 'Email'], ['linkedin', 'LinkedIn'], ['meeting', 'Meetings']]} counts={{ all: c.tl.length, email: c.tl.filter(x => x.ch === 'email').length, linkedin: c.tl.filter(x => x.ch === 'linkedin').length, meeting: c.tl.filter(x => x.ch === 'meeting').length }} /></div>
      <div className="tl">{groups.map(g => <div key={g.k}><div className="tl-m">{g.k}</div>{g.xs.map((x, i) => <div key={i} className={'tl-i ch-' + x.ch + (x.dir === 'in' ? ' in' : '') + (x.type === 'draft' ? ' faint' : '')}>
        <span className="tl-ic">{icon(x)}</span>
        <div className="tl-b"><div className="tl-t"><b>{x.title}</b>{x.sentiment && <Sent s={x.sentiment} />}<span className="mute sm">{x.t ? (x.type === 'meeting' ? fFull(x.t) : fDate(x.t) + (x.url && x.ch === 'email' ? ' · ' + fTime(x.t) : '')) : ''}</span></div>
          {x.subject && <div className="subj">{x.subject}</div>}
          {x.body && <div className="tl-s">{x.body.length > 360 ? x.body.slice(0, 360) + '…' : x.body}</div>}
          {x.note && <div className="mute sm">{x.note}</div>}
          {x.alt && <div className="sm">Alternate contact: <b>{x.alt.split(';').join(', ')}</b></div>}
          {x.m && x.m.leads.length > 1 && <div className="leads">{x.m.leads.filter(l => l.id !== c.id).slice(0, 5).map(l => <Lead key={l.id} c={l} open={open} sub="" />)}</div>}
          <div className="tl-l">{x.url && x.ch === 'email' && <a href={x.url} target="_blank" rel="noreferrer"><I n="mail" s={12} /> Open in Gmail</a>}{x.meet && <a href={x.meet} target="_blank" rel="noreferrer"><I n="video" s={12} /> Meet link</a>}{x.url && x.ch === 'meeting' && <a href={x.url} target="_blank" rel="noreferrer"><I n="ext" s={12} /> Calendar event</a>}{x.src && <span className="mute sm">from {x.src}</span>}</div>
        </div></div>)}</div>)}
        {!tl.length && <Empty t="No activity yet" />}</div>
    </aside></>;
}
