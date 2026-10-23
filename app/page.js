'use client';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { STAGES, QS, LI_STATUSES, build, ago, fDate, fTime, fFull, fCurrency, who, weekStart, ts, stageSlug } from './_crm/model';
import { I, Avatar, Stage, Sent, Channels, Empty, Chips, Lead, Pri, LinkedInBadge } from './_crm/ui';

const NAV = [
  ['today', 'Today', 'home'],
  ['leads', 'Leads', 'users'],
  ['pipeline', 'Pipeline', 'board'],
  ['emails', 'Emails', 'mail'],
  ['autoreplies', 'Automatic Reply', 'bot'],
  ['meetings', 'Meetings', 'cal'],
  ['followups', 'Follow-ups', 'bell'],
  ['loops', 'Open loops', 'loop'],
];

function useMore(n0 = 120) {
  const [n, setN] = useState(n0);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new IntersectionObserver(e => e[0].isIntersecting && setN(x => x + n0), { rootMargin: '600px' });
    o.observe(el);
    return () => o.disconnect();
  });
  return [n, ref, () => setN(n0)];
}

const match = (c, q) => !q || (c?.q ? c.q.includes(q) : [who(c), c?.name, c?.email, c?.org].filter(Boolean).join(' ').toLowerCase().includes(q));

export default function Home() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState('today');
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q.trim().toLowerCase());
  const [ov, setOv] = useState({ stage: {}, dnc: {}, fu: {}, qs: {}, nr: {}, li: {} });
  const [toast, setToast] = useState('');
  const [bell, setBell] = useState(false);
  const [theme, setTheme] = useState('dark');
  const searchRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('crm_theme') || 'dark';
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } catch {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('crm_theme', next);
      } catch {}
      document.documentElement.setAttribute('data-theme', next);
      return next;
    });
  }, []);

  const load = useCallback(() => {
    fetch('/api/data')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(x => {
        if (x.error && x.source === 'none') setErr(x.error);
        setD(x);
      })
      .catch(e => setErr('Could not load data (' + e + ')'));
  }, []);

  useEffect(() => {
    load();
    const fromHash = () => {
      const h = location.hash.slice(1);
      if (NAV.some(n => n[0] === h)) setView(h);
    };
    fromHash();
    addEventListener('hashchange', fromHash);
    return () => removeEventListener('hashchange', fromHash);
  }, [load]);

  useEffect(() => {
    history.replaceState(null, '', '#' + view);
  }, [view]);

  useEffect(() => {
    const k = e => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') setSel(null);
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  const M = useMemo(() => d && build(d, ov), [d, ov]);

  const edit = async (entity, id, value, key) => {
    setOv(o => ({ ...o, [key]: { ...(o[key] || {}), [id]: value } }));
    const r = await fetch('/api/edit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity, id, value }),
    }).catch(() => null);

    if (key === 'nr' && r?.ok) return;

    let msg = 'Saved';
    if (!r?.ok) {
      const j = await r?.json().catch(() => ({}));
      msg = 'Save failed — ' + (j?.error || 'change not persisted');
      setOv(o => {
        const n = { ...(o[key] || {}) };
        delete n[id];
        return { ...o, [key]: n };
      });
    }
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const openLeadOrAuto = useCallback(id => {
    if (M?.C?.[id]) setSel(id);
  }, [M]);

  const A = { M, q: dq, open: openLeadOrAuto, edit, go: setView };

  if (!M) {
    return (
      <div className="boot">
        {err ? (
          <>
            <b>CRaMer</b>
            <p className="mute">{err}</p>
          </>
        ) : (
          <>
            <div className="spin" />
            <span className="mute">Loading CRaMer…</span>
          </>
        )}
      </div>
    );
  }

  const counts = {
    leads: M.list.length,
    pipeline: M.list.length,
    emails: M.allEmails.length,
    autoreplies: M.autoReplies.length,
    meetings: M.meets.filter(m => m.t > Date.now()).length,
    followups: M.awaiting.length,
    loops: M.queue.filter(x => !['Closed'].includes(x.status)).length,
  };

  const last = (d.sync || []).map(s => ts(s.last_synced_at)).sort().pop();
  const currentNav = NAV.find(n => n[0] === view);
  const title = currentNav ? currentNav[1] : 'Today';

  return (
    <div className="shell">
      <aside className="side">
        <div className="logo">
          <span className="mark">C</span>
          <div>
            <div>CRaMer</div>
            <span className="logo-sub">Zergware & MultiDomain</span>
          </div>
        </div>
        <nav>
          {NAV.map(([k, l, ic]) => (
            <button key={k} className={'nav' + (view === k ? ' on' : '')} onClick={() => setView(k)}>
              <I n={ic} />
              <span>{l}</span>
              {k === 'followups' ? (
                <span className="n hot">{counts[k]}</span>
              ) : k === 'autoreplies' ? (
                <span className="n auto-cnt">{counts[k]}</span>
              ) : counts[k] != null ? (
                <span className="n">{counts[k]}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="foot">
          <div><span className={'dot ' + (d.source === 'supabase' ? 'ok' : 'warn')} />{d.source === 'supabase' ? 'Live Supabase' : 'Local Seed Data'}</div>
          <div className="mute" style={{ fontSize: '11px', marginTop: '2px' }}>Scope: Zergware & MultiDomain Systems</div>
          <div className="mute">{last ? 'Synced ' + ago(last) : 'Ready'}</div>
        </div>
      </aside>

      <main className="main">
        <header className="top">
          <h1>{title}</h1>
          <div className="search">
            <I n="search" s={15} />
            <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search leads, accounts, emails, LinkedIn..." />
            {q ? <button className="x" onClick={() => setQ('')}><I n="x" s={14} /></button> : <kbd>/</kbd>}
          </div>
          <button
            className="theme-tog"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Dark or Light Mode"
          >
            <I n={theme === 'dark' ? 'sun' : 'moon'} s={14} />
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <Bell d={d} ov={ov} open={bell} setOpen={setBell} edit={edit} openLead={openLeadOrAuto} />
          <button className="btn ghost" onClick={load} title="Reload data"><I n="refresh" s={15} /></button>
        </header>

        <div className="content">
          {view === 'today' && <Today {...A} />}
          {view === 'leads' && <Leads {...A} />}
          {view === 'pipeline' && <Pipeline {...A} />}
          {view === 'emails' && <EmailHub {...A} />}
          {view === 'autoreplies' && <AutoReplyList M={M} q={dq} open={openLeadOrAuto} />}
          {view === 'meetings' && <Meetings {...A} />}
          {view === 'followups' && <FollowUps {...A} />}
          {view === 'loops' && <Loops {...A} />}
        </div>
      </main>

      {sel && M.C[sel] && <Drawer c={M.C[sel]} {...A} close={() => setSel(null)} />}
      {toast && <div className={'toast' + (toast.startsWith('Save failed') ? ' bad' : '')}>{toast}</div>}
    </div>
  );
}

function Kpi({ l, v, s, onClick, tone }) {
  return (
    <button className={'kpi ' + (tone || '')} onClick={onClick}>
      <span className="kpi-l">{l}</span>
      <span className="kpi-v">{v}</span>
      {s && <span className="kpi-s">{s}</span>}
    </button>
  );
}

const NK = { reply: ['reply', 'New reply'], meeting: ['cal', 'Meeting'], bounce: ['ban', 'Bounce removed'], overdue: ['bolt', 'Overdue'], sync_failure: ['x', 'Sync failure'] };
function Bell({ d, ov, open, setOpen, edit, openLead }) {
  const ref = useRef(null);
  const [tab, setTab] = useState('unread');

  useEffect(() => {
    if (!open) return;
    const f = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    addEventListener('mousedown', f);
    return () => removeEventListener('mousedown', f);
  }, [open, setOpen]);

  const ns = (d.notifications || []).map(n => ({
    ...n,
    read: ov.nr?.['*'] && !(n.id in (ov.nr || {})) ? true : (ov.nr?.[n.id] ?? !!n.read_at),
  }));
  const unread = ns.filter(n => !n.read).length;
  const shown = ns.filter(n => tab === 'all' || !n.read);

  const click = n => {
    if (!n.read) edit('notification', n.id, true, 'nr');
    if (n.contact_id) {
      openLead(n.contact_id);
      setOpen(false);
    }
  };

  return (
    <div className="bellw" ref={ref}>
      <button className={'btn ghost bellb' + (open ? ' on' : '')} onClick={() => setOpen(!open)} title="Notifications" aria-label={`Notifications, ${unread} unread`}>
        <I n="bell" s={16} />
        {unread > 0 && <span className="bdg">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="npanel">
          <div className="np-h">
            <b>Notifications</b>
            <Chips v={tab} set={setTab} opts={[['unread', 'Unread'], ['all', 'All']]} counts={{ unread, all: ns.length }} />
            {unread > 0 && <button className="link" onClick={() => edit('notification', '*', true, 'nr')}>Mark all read</button>}
          </div>
          <div className="np-b">
            {shown.map(n => (
              <div key={n.id} className={'nitem k-' + n.kind + (n.read ? ' read' : '')} onClick={() => click(n)}>
                <span className="ni-ic"><I n={(NK[n.kind] || ['bell'])[0]} s={14} /></span>
                <div className="row-m">
                  <div className="ni-t">{n.title}</div>
                  {n.body && <div className="mute sm ni-b">{n.body}</div>}
                  <div className="mute sm">{(NK[n.kind] || [, n.kind])[1]} · {ago(ts(n.created_at))}</div>
                </div>
                <div className="ni-r">
                  {n.ref && (
                    <a className="btn sm ghost" href={n.ref} target="_blank" rel="noreferrer" onClick={e => { e.stopPropagation(); if (!n.read) edit('notification', n.id, true, 'nr'); }} title="Open source">
                      <I n="ext" s={13} />
                    </a>
                  )}
                  <button className="btn sm ghost" title={n.read ? 'Mark unread' : 'Mark read'} onClick={e => { e.stopPropagation(); edit('notification', n.id, !n.read, 'nr'); }}>
                    {n.read ? <span className="udot o" /> : <span className="udot" />}
                  </button>
                </div>
              </div>
            ))}
            {!shown.length && <Empty t={tab === 'unread' ? 'All caught up' : 'No notifications yet'} s="New replies, meetings, and updates show up here." />}
          </div>
        </div>
      )}
    </div>
  );
}

function Today({ M, open, go }) {
  const now = Date.now(), S = M.stats, F = M.funnel;
  const up = M.meets.filter(m => m.t > now && m.t < now + 7 * 864e5);
  const leaderboardRows = [
    ['Contacted', 'Contacted', F.contacted, 'Who was contacted'],
    ['Got Back to Us', 'Got Back to Us', F.gotBack, 'Who got back to us'],
    ['Meetings Set Up', 'Meetings Set Up', F.meetingsSetUp, `${F.meetingsEventsCount} total meetings set up`],
    ['Follow-Up Meeting(s)', 'Follow-Up Meeting(s)', F.followUpMeetings, 'Whom we set up follow-up meeting(s) with'],
  ];
  const max = Math.max(1, ...leaderboardRows.map(x => x[2]));
  const hour = +new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });

  return (
    <div className="today">
      <div className="hello">
        <h2>Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, Sujay</h2>
        <p className="mute">Zergware & MultiDomain Systems · {F.contacted.toLocaleString()} contacted · {F.gotBack} got back to us · {F.meetingsSetUp} w/ meetings ({F.meetingsEventsCount} total) · {F.followUpMeetings} w/ follow-up meetings</p>
      </div>
      <div className="kpis">
        <Kpi l="Awaiting your reply" v={M.awaiting.length} s="unresponded emails" tone="hot" onClick={() => go('followups')} />
        <Kpi l="Contacted" v={F.contacted.toLocaleString()} s="who was contacted" onClick={() => go('leads')} />
        <Kpi l="Got back to us" v={F.gotBack} s="who got back to us" onClick={() => go('leads')} />
        <Kpi l="Meetings set up" v={F.meetingsSetUp} s={`${F.meetingsEventsCount} total meetings (${up.length} next 7d)`} onClick={() => go('meetings')} />
        <Kpi l="Follow-up meeting(s)" v={F.followUpMeetings} s="2+ or demo/next-steps meetings" onClick={() => go('pipeline')} />
        <Kpi l="Automatic replies" v={M.autoReplies.length} s="filtered into separate tab" onClick={() => go('autoreplies')} />
      </div>
      <div className="grid2">
        <section className="card">
          <div className="card-h"><h3>Top priority</h3><button className="link" onClick={() => go('followups')}>All follow-ups ({M.awaiting.length})</button></div>
          {M.top.slice(0, 10).map(c => (
            <div key={c.id} className="row" onClick={() => open(c.id)}>
              <Avatar c={c} s={32} />
              <div className="row-m">
                <div className="row-t"><b>{who(c)}</b>{c.org && <span className="mute">· {c.org}</span>}<Sent s={c.sentiment} /></div>
                <div className="row-s">{c.pri.why}</div>
              </div>
              <div className="row-r"><Pri p={c.pri} /></div>
            </div>
          ))}
          {!M.top.length && <Empty t="Nothing urgent" />}
        </section>

        <section className="card">
          <div className="card-h"><h3>Outreach & meetings leaderboard</h3><button className="link" onClick={() => go('pipeline')}>Board</button></div>
          <div className="stagebars">
            {leaderboardRows.map(([s, label, n, sub]) => (
              <button key={s} className="sb" onClick={() => go('pipeline')} title={sub}>
                <span className="sb-l"><span className={'dot st-' + stageSlug(s)} />{label}</span>
                <span className="sb-t"><span className={'sb-f st-' + stageSlug(s)} style={{ width: (n ? Math.max(4, 100 * n / max) : 0) + '%' }} /></span>
                <b className="sb-n">{n.toLocaleString()}</b>
              </button>
            ))}
          </div>
          <div className="mute sm" style={{ marginTop: '6px', padding: '0 18px 12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span>Contacted: <b>{F.contacted.toLocaleString()}</b></span>
            <span>Got back to us: <b>{F.gotBack}</b></span>
            <span>Meetings set up: <b>{F.meetingsSetUp}</b> ({F.meetingsEventsCount} mtgs)</span>
            <span>Follow-up meeting(s): <b>{F.followUpMeetings}</b></span>
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h3>Awaiting your reply</h3><button className="link" onClick={() => go('followups')}>View all ({M.awaiting.length})</button></div>
          {M.awaiting.slice(0, 8).map(x => <Row key={x.c.id} x={x} open={open} />)}
          {!M.awaiting.length && <Empty t="Inbox zero" s="Nobody is waiting on you." />}
        </section>

        <section className="card">
          <div className="card-h"><h3>Scheduled client meetings</h3><button className="link" onClick={() => go('meetings')}>Calendar</button></div>
          {S.weekMeets.map(m => <MeetCard key={m.id} m={m} open={open} />)}
          {!S.weekMeets.length && <Empty t="No meetings scheduled this week" />}
        </section>

        <section className="card">
          <div className="card-h"><h3>Recent communications</h3><button className="link" onClick={() => go('emails')}>Email Hub</button></div>
          <div className="feed">
            {M.activity.slice(0, 10).map((x, i) => (
              <div key={i} className="fd" onClick={() => open(x.c.id)}>
                <span className={'fd-ic ch-' + x.ch + (x.dir === 'in' ? ' in' : '')}>
                  <I n={x.ch === 'linkedin' ? 'li' : x.ch === 'meeting' ? 'cal' : x.dir === 'in' ? 'in' : 'out'} s={13} />
                </span>
                <div className="row-m">
                  <div className="row-t"><b>{who(x.c)}</b><span className="mute">· {x.title}</span></div>
                  {(x.subject || x.body) && <div className="row-s">{x.subject || x.body}</div>}
                </div>
                <span className="mute sm">{ago(x.t)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-h"><h3>Recaps due</h3><button className="link" onClick={() => go('followups')}>View all</button></div>
          {M.recap.slice(0, 6).map(x => <MeetCard key={x.m.id} m={x.m} open={open} />)}
          {!M.recap.length && <Empty t="All recaps sent" />}
        </section>
      </div>
    </div>
  );
}

function Row({ x, open, extra }) {
  const c = x.c, m = x.msg;
  return (
    <div className="row" onClick={() => open(c.id)}>
      <Avatar c={c} s={32} />
      <div className="row-m">
        <div className="row-t">
          <b>{who(c)}</b>
          {c.org && <span className="mute">· {c.org}</span>}
          <Sent s={c.sentiment} />
        </div>
        <div className="row-s">{m?.snippet || c.reply_note || x.why}</div>
      </div>
      <div className="row-r">
        {x.pri ? <><Pri p={x.pri} /><span className="why">{x.pri.why}</span></> : <span className="why">{x.why}</span>}
        <span className="mute sm">{ago(x.t)}</span>
        {extra}
        {m?.url && (
          <a className="btn sm" href={m.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
            <I n="mail" s={13} />{m.url.includes('mail.google') ? 'Open in Gmail' : 'Open source'}
          </a>
        )}
      </div>
    </div>
  );
}

function Leads({ M, open, q, edit }) {
  const [stage, setStage] = useState('all');
  const [ch, setCh] = useState('all');
  const [flt, setFlt] = useState('all');
  const [sort, setSort] = useState(['pri', -1]);

  const rows = useMemo(() => {
    let r = M.list.filter(c => match(c, q));

    if (stage === 'Contacted') {
      r = r.filter(c => c.wasContacted);
    } else if (stage === 'Got Back to Us') {
      r = r.filter(c => c.gotBack);
    } else if (stage === 'Meetings Set Up') {
      r = r.filter(c => c.hasAnyMeet);
    } else if (stage === 'Follow-Up Meeting(s)') {
      r = r.filter(c => c.isFollowUpMeet);
    } else if (stage !== 'all') {
      r = r.filter(c => c.stage === stage);
    }

    if (ch === 'email') {
      r = r.filter(c => c.ch.has('email') || Boolean(c.email));
    } else if (ch === 'linkedin') {
      r = r.filter(c => c.ch.has('linkedin') || Boolean(c.linkedin));
    } else if (ch === 'meeting') {
      r = r.filter(c => c.ch.has('meeting') || (c.meets && c.meets.length > 0));
    }

    if (flt === 'action') r = r.filter(c => ['hot', 'warn', 'meet'].includes(c.next.k));
    else if (flt === 'replied') r = r.filter(c => c.gotBack);
    else if (flt === 'connected') r = r.filter(c => c.linkedin_status === 'connected');
    else if (flt === 'dnc') r = r.filter(c => c.dnc);
    else if (flt === 'active') r = r.filter(c => !c.dnc);

    const [k, dir] = sort;
    const si = s => STAGES.indexOf(s);
    const key = {
      pri: c => c.pri.score,
      touch: c => c.lastTouch,
      name: c => who(c).toLowerCase(),
      org: c => (c.org || '~').toLowerCase(),
      stage: c => si(c.stage),
      next: c => ({ hot: 0, meet: 1, warn: 2, mute: 3, dnc: 4 }[c.next.k]),
    }[k];

    return r.sort((a, b) => {
      const x = key(a), y = key(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [M, q, stage, ch, flt, sort]);

  const [n, more, reset] = useMore();
  useEffect(reset, [q, stage, ch, flt, sort]);

  const H = ({ k, l, w }) => (
    <th
      style={{ width: w }}
      onClick={() => setSort(([a, b]) => [k, a === k ? -b : (k === 'touch' || k === 'pri') ? -1 : 1])}
      className={sort[0] === k ? 'on' : ''}
      title={k === 'pri' ? 'Deadlines, then waiting time, then importance' : undefined}
    >
      {l}{sort[0] === k && (sort[1] > 0 ? ' ↑' : ' ↓')}
    </th>
  );

  const sc = useMemo(() => {
    const base = M.list.filter(c => flt === 'dnc' ? c.dnc : flt === 'active' ? !c.dnc : true);
    return {
      all: base.length,
      Contacted: base.filter(c => c.wasContacted).length,
      'Got Back to Us': base.filter(c => c.gotBack).length,
      'Meetings Set Up': base.filter(c => c.hasAnyMeet).length,
      'Follow-Up Meeting(s)': base.filter(c => c.isFollowUpMeet).length,
    };
  }, [M.list, flt]);

  return (
    <div>
      <div className="toolbar">
        <Chips
          v={stage}
          set={setStage}
          opts={[['all', 'All Leads'], ...STAGES.map(s => [s, s])]}
          counts={sc}
        />
      </div>

      <div className="toolbar">
        <select value={ch} onChange={e => setCh(e.target.value)}>
          <option value="all">All channels</option>
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
          <option value="meeting">Meetings</option>
        </select>

        <select value={flt} onChange={e => setFlt(e.target.value)}>
          <option value="all">All leads ({M.list.length.toLocaleString()})</option>
          <option value="active">Active (hide do-not-contact)</option>
          <option value="action">Needs action</option>
          <option value="replied">Got back to us ({M.funnel.gotBack})</option>
          <option value="connected">LinkedIn Connected</option>
          <option value="dnc">Do-not-contact only</option>
        </select>

        <span className="mute sm grow-r">{rows.length.toLocaleString()} software leads match</span>
      </div>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <H k="pri" l="Priority" w="8%" />
              <H k="name" l="Lead / Contact" w="20%" />
              <H k="org" l="Account / Company" w="15%" />
              <H k="stage" l="Stage" w="11%" />
              <th style={{ width: '9%' }}>Deal Value</th>
              <th style={{ width: '13%' }}>Recent Email</th>
              <th style={{ width: '11%' }}>LinkedIn</th>
              <H k="next" l="Next action" w="13%" />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, n).map(c => {
              const liUrl = c.linkedin ? (c.linkedin.startsWith('http') ? c.linkedin : 'https://' + c.linkedin) : null;
              return (
                <tr key={c.id} onClick={() => open(c.id)} className={c.dnc ? 'dim' : ''}>
                  <td>{c.pri.label ? <Pri p={c.pri} /> : <span className="mute">—</span>}</td>
                  <td>
                    <div className="cell-lead">
                      <Avatar c={c} />
                      <div>
                        <b>{who(c)}</b>
                        <div className="mute sm trunc">{c.title || c.email || 'Lead'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="trunc">{c.org || <span className="mute">—</span>}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <select
                      value={c.stage}
                      onChange={e => edit('contact_stage', c.id, e.target.value, 'stage')}
                      style={{ fontSize: '11.5px', padding: '3px 6px' }}
                    >
                      {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className="kc-val">{c.dealValueFormatted}</span>
                  </td>
                  <td>
                    {c.lastEmail ? (
                      <div className="trunc" title={c.lastEmail.subject}>
                        <span className={'em-dir ' + (c.lastEmail.dir === 'out' ? 'out' : 'in')} style={{ marginRight: '5px' }}>
                          {c.lastEmail.dir === 'out' ? 'Sent' : 'In'}
                        </span>
                        <span className="sm">{c.lastEmail.subject}</span>
                      </div>
                    ) : (
                      <span className="mute sm">No email sent</span>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {liUrl ? (
                      <div className="li-act">
                        <LinkedInBadge status={c.linkedin_status} />
                        <a className="btn sm ghost" href={liUrl} target="_blank" rel="noreferrer" title="Open LinkedIn Profile">
                          <I n="ext" s={11} />
                        </a>
                      </div>
                    ) : (
                      <span className="mute sm">No profile</span>
                    )}
                  </td>
                  <td>
                    <span className={'nx nx-' + c.next.k}>{c.next.s}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <Empty t="No software leads match" s="Try clearing search or filters." />}
        <div ref={more} />
      </div>
    </div>
  );
}

function Pipeline({ M, open, q, edit }) {
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [lim, setLim] = useState({});

  const cols = useMemo(() => {
    return Object.fromEntries(
      STAGES.map(s => [
        s,
        M.list
          .filter(c => c.stage === s && match(c, q))
          .sort((a, b) => b.lastTouch - a.lastTouch),
      ])
    );
  }, [M, q]);

  return (
    <div className="board">
      {STAGES.map(s => (
        <div
          key={s}
          className={'col' + (over === s ? ' over' : '')}
          onDragOver={e => { e.preventDefault(); setOver(s); }}
          onDragLeave={() => setOver(null)}
          onDrop={e => {
            e.preventDefault();
            setOver(null);
            if (drag && drag.stage !== s) {
              edit('contact_stage', drag.id, s, 'stage');
            }
            setDrag(null);
          }}
        >
          <div className="col-h">
            <span className={'dot st-' + stageSlug(s)} />
            {s}
            <span className="cn">{cols[s].length}</span>
          </div>
          <div className="col-b">
            {cols[s].slice(0, lim[s] || 40).map(c => (
              <div
                key={c.id}
                className="kcard"
                draggable
                onDragStart={() => setDrag(c)}
                onClick={() => open(c.id)}
              >
                <div className="kc-t">
                  <b className="trunc">{c.org || who(c)}</b>
                  <span className="kc-val">{c.dealValueFormatted}</span>
                </div>

                <div className="mute sm trunc" style={{ marginTop: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{who(c)}{c.title ? ` · ${c.title}` : ''}</span>
                  <Channels c={c} />
                </div>

                {c.lastEmail ? (
                  <div className={'kc-email ' + (c.lastEmail.dir === 'in' ? 'in' : '')} title={c.lastEmail.subject}>
                    <span className={'em-dir ' + (c.lastEmail.dir === 'out' ? 'out' : 'in')}>
                      {c.lastEmail.dir === 'out' ? 'Sent' : 'Reply'}
                    </span>
                    <span className="trunc">{c.lastEmail.subject}</span>
                  </div>
                ) : (
                  <div className="kc-email" style={{ opacity: 0.6 }}>
                    <span className="mute sm">No email activity yet</span>
                  </div>
                )}

                {c.nextMeet && (
                  <div className="kc-meet">
                    <I n="cal" s={12} />
                    <span>Meeting: {fDate(c.nextMeet.t)} ({fTime(c.nextMeet.t)})</span>
                  </div>
                )}

                <div className="kc-f">
                  <span className={'nx nx-' + c.next.k}>{c.next.s}</span>
                  <span className="mute sm">{ago(c.lastTouch)}</span>
                </div>
              </div>
            ))}
            {cols[s].length > (lim[s] || 40) && (
              <button className="btn ghost wide" onClick={() => setLim(l => ({ ...l, [s]: (l[s] || 40) + 80 }))}>
                Show more ({cols[s].length - (lim[s] || 40)})
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Dedicated Automatic Reply List Component
function AutoReplyList({ M, q, open, embedded = false }) {
  const [expanded, setExpanded] = useState(null);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'pure' | 'human_after'

  const filtered = useMemo(() => {
    let list = M.autoReplies || [];
    if (filterMode === 'human_after') list = list.filter(m => m.hasHumanFollowup);
    else if (filterMode === 'pure') list = list.filter(m => !m.hasHumanFollowup);

    if (q) {
      list = list.filter(m =>
        match(m.c, q) ||
        (m.subject && m.subject.toLowerCase().includes(q)) ||
        (m.snippet && m.snippet.toLowerCase().includes(q)) ||
        (m.alt && m.alt.toLowerCase().includes(q))
      );
    }
    return list;
  }, [M.autoReplies, filterMode, q]);

  const [n, more, reset] = useMore(100);
  useEffect(reset, [filterMode, q]);

  const modeCounts = {
    all: (M.autoReplies || []).length,
    pure: (M.autoReplies || []).filter(m => !m.hasHumanFollowup).length,
    human_after: (M.autoReplies || []).filter(m => m.hasHumanFollowup).length,
  };

  return (
    <div>
      {!embedded && (
        <div className="toolbar">
          <Chips
            v={filterMode}
            set={setFilterMode}
            opts={[
              ['all', 'All Automatic Replies'],
              ['pure', 'Auto-Reply Only (No Human Follow-up)'],
              ['human_after', 'Human Responded in Thread'],
            ]}
            counts={modeCounts}
          />
          <span className="mute sm grow-r">{filtered.length} automatic replies isolated</span>
        </div>
      )}
      <p className="mute desc">
        Automatic replies and out-of-office responses are strictly isolated here and excluded from your main inbox, priority list, and outreach numbers. If a real person also replied in the thread, their human reply remains in your active pipeline.
      </p>

      <div className="card list">
        {filtered.slice(0, n).map(m => {
          const canOpenLead = Boolean(M.C?.[m.c?.id]);
          const isExp = expanded === m.id;
          return (
            <div
              key={m.id}
              className="row"
              style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}
              onClick={() => {
                if (canOpenLead) open(m.c.id);
                else setExpanded(isExp ? null : m.id);
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                <Avatar c={m.c} s={32} />
                <div className="row-m">
                  <div className="row-t">
                    <span className="em-dir auto">Auto-Reply</span>
                    <b>{who(m.c)}</b>
                    {m.c?.org && <span className="mute">· {m.c.org}</span>}
                    {m.c?.email && <span className="mute sm">({m.c.email})</span>}
                    {m.hasHumanFollowup && (
                      <span className="auto-human" title="An actual person responded in this thread, so the contact is also in Got Back to Us">
                        Human replied in thread
                      </span>
                    )}
                    {m.alt && (
                      <span className="auto-alt" title="Alternate contact extracted from OOO reply">
                        Alt: {m.alt}
                      </span>
                    )}
                  </div>
                  <div className="row-s">
                    <span className="subj">{m.subject || 'Automatic reply'}</span>
                    {m.snippet && <span> — {m.snippet}</span>}
                  </div>
                </div>
                <div className="row-r">
                  <span className="mute sm">{fDate(m.t)}</span>
                  {m.url && (
                    <a
                      className="btn sm ghost"
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      title="Open in Gmail"
                    >
                      <I n="mail" s={13} />Open in Gmail
                    </a>
                  )}
                </div>
              </div>
              {isExp && m.snippet && (
                <div className="tl-s" style={{ marginLeft: '44px' }}>
                  {m.snippet}
                </div>
              )}
            </div>
          );
        })}
        {!filtered.length && <Empty t="No automatic replies match" s="All automatic replies are kept isolated in this tab." />}
        <div ref={more} />
      </div>
    </div>
  );
}

function EmailHub({ M, open, q }) {
  const [tab, setTab] = useState('all');
  const [sentFilter, setSentFilter] = useState('all');

  const emails = useMemo(() => {
    if (tab === 'autoreply') return [];
    let list = M.allEmails;
    if (tab === 'in') list = list.filter(m => m.direction === 'in');
    else if (tab === 'out') list = list.filter(m => m.direction === 'out');
    else if (tab === 'followup') list = list.filter(m => m.needs_followup || m.c?.needs_followup);

    if (sentFilter !== 'all') {
      list = list.filter(m => m.sentiment === sentFilter);
    }

    if (q) {
      list = list.filter(m =>
        match(m.c, q) ||
        (m.subject && m.subject.toLowerCase().includes(q)) ||
        (m.snippet && m.snippet.toLowerCase().includes(q))
      );
    }
    return list;
  }, [M.allEmails, tab, sentFilter, q]);

  const [n, more, reset] = useMore();
  useEffect(reset, [tab, sentFilter, q]);

  const counts = {
    all: M.allEmails.length,
    in: M.allEmails.filter(m => m.direction === 'in').length,
    out: M.allEmails.filter(m => m.direction === 'out').length,
    followup: M.allEmails.filter(m => m.needs_followup || m.c?.needs_followup).length,
    autoreply: (M.autoReplies || []).length,
  };

  return (
    <div>
      <div className="toolbar">
        <Chips
          v={tab}
          set={setTab}
          opts={[
            ['all', 'All Software Emails'],
            ['in', 'Inbound / Received'],
            ['out', 'Outbound / Sent'],
            ['followup', 'Awaiting Follow-up'],
            ['autoreply', 'Automatic Reply'],
          ]}
          counts={counts}
        />
        {tab !== 'autoreply' && (
          <>
            <select value={sentFilter} onChange={e => setSentFilter(e.target.value)}>
              <option value="all">All Sentiment</option>
              <option value="positive">Positive</option>
              <option value="meeting-request">Meeting Request</option>
              <option value="referral">Referral</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
            <span className="mute sm grow-r">{emails.length} software emails (auto-replies excluded)</span>
          </>
        )}
      </div>

      {tab === 'autoreply' ? (
        <AutoReplyList M={M} q={q} open={open} embedded />
      ) : (
        <div className="card list">
          {emails.slice(0, n).map(m => (
            <div key={m.id} className="row" onClick={() => open(m.c.id)}>
              <Avatar c={m.c} s={32} />
              <div className="row-m">
                <div className="row-t">
                  <span className={'em-dir ' + (m.direction === 'out' ? 'out' : 'in')}>
                    {m.direction === 'out' ? 'Sent' : 'Inbound'}
                  </span>
                  <b>{who(m.c)}</b>
                  {m.c.org && <span className="mute">· {m.c.org}</span>}
                  <Stage s={m.c.stage} />
                  <Sent s={m.sentiment} />
                </div>
                <div className="row-s">
                  <span className="subj">{m.subject || '(no subject)'}</span>
                  {m.snippet && <span> — {m.snippet}</span>}
                </div>
              </div>
              <div className="row-r">
                <span className="mute sm">{fDate(m.t)}</span>
                {m.url && (
                  <a
                    className="btn sm ghost"
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    title="Open thread"
                  >
                    <I n="mail" s={13} />
                  </a>
                )}
              </div>
            </div>
          ))}
          {!emails.length && <Empty t="No emails found" s="Only Zergware and MultiDomain Systems human communications are shown." />}
          <div ref={more} />
        </div>
      )}
    </div>
  );
}

function MeetCard({ m, open }) {
  return (
    <div className="mrow">
      <div className="mdate">
        <span className="md-d">{fDate(m.t)}</span>
        <span className="mute sm">{fTime(m.t)}</span>
      </div>
      <div className="row-m">
        <div className="row-t">
          <b>{m.title}</b>
          <span className={'meet-stat ' + m.status}>{m.status.replace('_', ' ')}</span>
          {m.company && <span className="mute">· {m.company}</span>}
        </div>
        <div className="leads">
          {m.leads.map(c => (
            <Lead key={c.id} c={c} open={open} sub={c.org || ''} />
          ))}
          {!m.leads.length && <span className="mute sm">No outside attendees linked</span>}
        </div>
      </div>
      <div className="row-r">
        {m.meet_link && (
          <a className="btn sm pri" href={m.meet_link} target="_blank" rel="noreferrer">
            <I n="video" s={13} />{m.isLive ? 'Join Now' : 'Meet Link'}
          </a>
        )}
        {m.url && (
          <a className="btn sm ghost" href={m.url} target="_blank" rel="noreferrer" title="Open Calendar Event">
            <I n="ext" s={13} />
          </a>
        )}
      </div>
    </div>
  );
}

function Meetings({ M, open, q }) {
  const [tab, setTab] = useState('upcoming');
  const now = Date.now();

  const ms = useMemo(() => {
    let list = M.meets;
    if (tab === 'upcoming') list = list.filter(m => m.te >= now);
    else if (tab === 'recap') list = list.filter(m => m.needsRecap);
    else if (tab === 'past') list = list.filter(m => m.te < now);

    if (q) {
      list = list.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.company.toLowerCase().includes(q) ||
        m.leads.some(c => match(c, q))
      );
    }
    return list;
  }, [M.meets, tab, q, now]);

  const groups = [];
  for (const m of ms) {
    const w = weekStart(m.t);
    const g = groups[groups.length - 1];
    if (g && g.w === w) g.ms.push(m);
    else groups.push({ w, ms: [m] });
  }

  const counts = {
    all: M.meets.length,
    upcoming: M.meets.filter(m => m.te >= now).length,
    recap: M.meets.filter(m => m.needsRecap).length,
    past: M.meets.filter(m => m.te < now).length,
  };

  return (
    <div>
      <div className="toolbar">
        <Chips
          v={tab}
          set={setTab}
          opts={[
            ['upcoming', 'Upcoming Meetings'],
            ['recap', 'Recaps Due'],
            ['past', 'Past Meetings'],
            ['all', 'All Meetings'],
          ]}
          counts={counts}
        />
      </div>
      <p className="mute desc">Client & partner meetings for Zergware and MultiDomain Systems software. (Academic, mentor, and personal events excluded).</p>

      {groups.map(g => (
        <section key={g.w} className="week">
          <h4>Week of {fDate(g.w)} <span className="mute">· {g.ms.length} meeting{g.ms.length > 1 ? 's' : ''}</span></h4>
          <div className="card list">
            {g.ms.map(m => <MeetCard key={m.id} m={m} open={open} />)}
          </div>
        </section>
      ))}
      {!ms.length && <Empty t="No meetings found" s="Try clearing search or changing your tab filter." />}
    </div>
  );
}

function FollowUps({ M, open, q, edit }) {
  const [tab, setTab] = useState('awaiting');
  const [showNudge, setShowNudge] = useState(false);
  const f = xs => xs.filter(x => !q || (x.c && match(x.c, q)) || (x.m && x.m.title.toLowerCase().includes(q)));
  const B = { awaiting: f(M.awaiting), recap: f(M.recap), nudge: f(M.nudge), loops: f(M.loops) };
  const [n, more, reset] = useMore(80);
  useEffect(reset, [tab, q]);
  const [nn, moreN, resetN] = useMore(80);
  useEffect(resetN, [showNudge, q]);

  const desc = {
    awaiting: 'Prospects and clients who replied and are waiting on your response.',
    recap: 'Client meetings held in the last 30 days with no follow-up recap email sent.',
  };

  const loopRow = x => (
    <Row
      key={x.id}
      x={{ ...x, msg: { snippet: x.quote ? `“${x.quote}”` : x.summary, url: x.source_link } }}
      open={open}
      extra={
        <>
          {x.overdue && <span className="pill live">Overdue</span>}
          {x.due_date && <span className="mute sm">due {x.due_date}</span>}
          <select value={x.status} onClick={e => e.stopPropagation()} onChange={e => edit('queue_item', x.id, e.target.value, 'qs')}>
            {QS.map(s => <option key={s}>{s}</option>)}
          </select>
        </>
      }
    />
  );

  const personRow = (x, k) => (
    <Row
      key={x.c.id + k}
      x={x}
      open={open}
      extra={
        k === 'awaiting' && (
          <button className="btn sm ghost" title="Mark handled" onClick={e => { e.stopPropagation(); edit('followup', x.c.id, false, 'fu'); }}>
            <I n="check" s={13} />Done
          </button>
        )
      }
    />
  );

  return (
    <div>
      <Chips
        v={tab}
        set={setTab}
        opts={[
          ['awaiting', 'Awaiting your reply'],
          ['recap', 'Recap due'],
          ['autoreply', 'Automatic Reply'],
        ]}
        counts={{
          awaiting: B.awaiting.length,
          recap: B.recap.length,
          autoreply: (M.autoReplies || []).length,
        }}
      />
      {tab === 'autoreply' ? (
        <AutoReplyList M={M} q={q} open={open} embedded />
      ) : (
        <>
          <p className="mute desc">{desc[tab]}</p>
          {tab === 'awaiting' && B.loops.length > 0 && (
            <section className="fu-sec">
              <h4>Flagged loops <span className="mute">· {B.loops.length} commitments</span></h4>
              <div className="card list">{B.loops.map(loopRow)}</div>
            </section>
          )}
          <section className="fu-sec">
            {tab === 'awaiting' && B.loops.length > 0 && <h4>Awaiting your reply <span className="mute">· {B.awaiting.length}</span></h4>}
            <div className="card list">
              {tab === 'recap' ? B.recap.slice(0, n).map(x => <MeetCard key={x.m.id} m={x.m} open={open} />) : B[tab].slice(0, n).map(x => personRow(x, tab))}
              {!B[tab].length && <Empty t="Nothing here" s="You’re caught up in this bucket." />}
              <div ref={more} />
            </div>
          </section>
          <section className="fu-sec nudge">
            <button className="disclose" onClick={() => setShowNudge(v => !v)} aria-expanded={showNudge}>
              <span className={'chev' + (showNudge ? ' open' : '')}><I n="chev" s={14} /></span>
              <b>Nudge due</b><span className="cn">{B.nudge.length.toLocaleString()}</span>
              <span className="mute sm">You reached out 5+ business days ago, no reply yet. {showNudge ? 'Click to collapse.' : 'Click to expand.'}</span>
            </button>
            {showNudge && (
              <div className="card list">
                {B.nudge.slice(0, nn).map(x => personRow(x, 'nudge'))}
                {!B.nudge.length && <Empty t="No nudges due" />}
                <div ref={moreN} />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Loops({ M, open, q, edit }) {
  const [st, setSt] = useState('active');
  const xs = M.queue.filter(x => (st === 'all' || (st === 'active' ? x.status !== 'Closed' : x.status === st)) && match(x.c, q));

  return (
    <div>
      <Chips v={st} set={setSt} opts={[['active', 'Active'], ...QS.map(s => [s, s]), ['all', 'All']]} />
      <div className="card list" style={{ marginTop: '14px' }}>
        {xs.map(x => (
          <div className="row" key={x.id} onClick={() => open(x.c.id)}>
            <Avatar c={x.c} s={32} />
            <div className="row-m">
              <div className="row-t">
                <b>{who(x.c)}</b>
                <span className="mute">· {x.type.replace(/_/g, ' ')}</span>
              </div>
              <div className="row-s">{x.summary}{x.quote ? ` — “${x.quote}”` : ''}</div>
            </div>
            <div className="row-r" onClick={e => e.stopPropagation()}>
              <span className="mute sm">{x.source_timestamp}</span>
              <select value={x.status} onChange={e => edit('queue_item', x.id, e.target.value, 'qs')}>
                {QS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
        {!xs.length && <Empty t="No open loops" />}
      </div>
    </div>
  );
}

function useThreads(id) {
  const [st, setSt] = useState({ id: null, threads: null, err: '' });
  useEffect(() => {
    let live = true;
    setSt({ id, threads: null, err: '' });
    fetch('/api/threads?contact=' + encodeURIComponent(id))
      .then(r => r.json())
      .then(j => live && setSt({ id, threads: j.threads || [], err: j.error || '' }))
      .catch(() => live && setSt({ id, threads: [], err: 'Could not load threads' }));
    return () => { live = false; };
  }, [id]);
  return st.id === id ? st : { threads: null, err: '' };
}

const nameOf = (m, c) => (m.direction === 'out' ? 'You' : (m.from_name || m.from_addr || who(c)));
function Msg({ m, c, last }) {
  const [open, setOpen] = useState(last);
  const [full, setFull] = useState(false);
  const hasMore = m.body_raw && m.body_raw.trim().length > (m.body || '').trim().length + 40;

  return (
    <div className={'em' + (open ? ' open' : '') + (m.direction === 'out' ? ' out' : '')}>
      <div className="em-h" onClick={() => setOpen(!open)}>
        <Avatar c={m.direction === 'out' ? { name: 'You' } : { name: m.from_name, email: m.from_addr }} s={26} />
        <div className="row-m">
          <div className="row-t">
            <b>{nameOf(m, c)}</b>
            {!open && <span className="mute trunc">{(m.body || '').replace(/\s+/g, ' ').slice(0, 140)}</span>}
          </div>
          {open && (
            <div className="mute sm em-to">
              to {(m.to_addrs || []).join(', ') || '—'}
              {m.cc_addrs?.length ? ' · cc ' + m.cc_addrs.join(', ') : ''}
            </div>
          )}
        </div>
        <span className="mute sm nowrap">{fDate(ts(m.date))} · {fTime(ts(m.date))}</span>
      </div>
      {open && (
        <div className="em-b">
          {(full ? m.body_raw : m.body) || <span className="mute">(no text)</span>}
          {hasMore && (
            <button className="link sm" onClick={() => setFull(!full)}>
              {full ? 'Hide quoted text' : 'Show quoted text & signature'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Threads({ c }) {
  const { threads, err } = useThreads(c.id);
  const [openT, setOpenT] = useState(0);

  if (!threads) {
    return <div className="tl"><div className="spin sm-spin" /> <span className="mute">Loading email threads…</span></div>;
  }
  if (!threads.length) {
    return (
      <div className="tl">
        <Empty t={err || 'No email threads found'} s="Send an email to this contact to start tracking conversation threads." />
      </div>
    );
  }

  return (
    <div className="threads">
      {threads.map((t, i) => (
        <div key={t.account + t.thread_id + i} className={'thr' + (openT === i ? ' open' : '')}>
          <div className="thr-h" onClick={() => setOpenT(openT === i ? -1 : i)}>
            <span className={'chev' + (openT === i ? ' open' : '')}><I n="chev" s={14} /></span>
            <div className="row-m">
              <b className="trunc">{t.subject || '(no subject)'}</b>
              <div className="mute sm">
                {t.messages.length} message{t.messages.length > 1 ? 's' : ''} · {[...new Set(t.messages.map(m => nameOf(m, c)))].slice(0, 4).join(', ')}
              </div>
            </div>
            <span className="mute sm nowrap">{fDate(ts(t.last))}</span>
            <a className="btn sm ghost" href={t.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
              <I n="mail" s={13} />Open in Gmail
            </a>
          </div>
          {openT === i && (
            <div className="thr-b">
              {t.messages.map((m, j) => (
                <Msg key={m.id || j} m={m} c={c} last={j === t.messages.length - 1} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Drawer({ c, close, edit, open }) {
  const [tab, setTab] = useState('overview');

  const groups = useMemo(() => {
    let filtered = c.tl;
    if (tab === 'linkedin') filtered = c.tl.filter(x => x.ch === 'linkedin');
    else if (tab === 'meetings') filtered = c.tl.filter(x => x.ch === 'meeting');

    const grps = [];
    for (const x of filtered) {
      const k = x.t ? new Date(x.t).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' }) : 'Undated';
      const g = grps[grps.length - 1];
      if (g && g.k === k) g.xs.push(x);
      else grps.push({ k, xs: [x] });
    }
    return grps;
  }, [c.tl, tab]);

  const latest = c.tl.find(x => x.url && x.ch === 'email');
  const icon = x => (
    x.ch === 'linkedin' ? <I n="li" s={14} /> :
    x.ch === 'meeting' ? <I n="cal" s={14} /> :
    x.dir === 'in' ? <I n="in" s={14} /> : <I n="out" s={14} />
  );

  const liUrl = c.linkedin ? (c.linkedin.startsWith('http') ? c.linkedin : 'https://' + c.linkedin) : null;
  const liMsgUrl = liUrl ? (liUrl.replace(/\/$/, '') + '/detail/recent-activity/') : 'https://www.linkedin.com/messaging/';

  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer">
        <div className="dr-h">
          <Avatar c={c} s={48} />
          <div className="grow">
            <h2>{who(c)}</h2>
            <div className="mute">{[c.title, c.org, c.email].filter(Boolean).join(' · ')}</div>
          </div>
          <button className="btn ghost" onClick={close}><I n="x" /></button>
        </div>

        <div className="dr-act">
          <select value={c.stage} onChange={e => edit('contact_stage', c.id, e.target.value, 'stage')}>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {liUrl && (
            <>
              <a className="btn ghost li-btn" href={liUrl} target="_blank" rel="noreferrer" title="Open LinkedIn Profile">
                <I n="li" s={14} />Profile
              </a>
              <a className="btn ghost" href={liMsgUrl} target="_blank" rel="noreferrer" title="Direct Message on LinkedIn">
                <I n="message" s={14} />Message
              </a>
              <select
                value={c.linkedin_status || 'not_connected'}
                onChange={e => edit('linkedin_status', c.id, e.target.value, 'li')}
                title="LinkedIn Connection Status"
              >
                {LI_STATUSES.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </>
          )}

          {c.email && (
            <a className="btn ghost" href={`mailto:${encodeURIComponent(c.email)}`}>
              <I n="mail" s={14} />Compose
            </a>
          )}

          {latest && (
            <a className="btn ghost" href={latest.url} target="_blank" rel="noreferrer">
              <I n="ext" s={14} />Latest thread
            </a>
          )}

          <button className={'btn' + (c.dnc ? ' danger' : ' ghost')} onClick={() => edit('contact', c.id, !c.dnc, 'dnc')}>
            <I n="ban" s={14} />{c.dnc ? 'Do not contact' : 'Mark DNC'}
          </button>
        </div>

        <div className="facts">
          <div>
            <span>Opportunity Stage</span>
            <b><Stage s={c.stage} /></b>
          </div>
          <div>
            <span>Deal Value</span>
            <b><span className="kc-val">{c.dealValueFormatted}</span></b>
          </div>
          <div>
            <span>LinkedIn Connection</span>
            <LinkedInBadge status={c.linkedin_status} />
          </div>
          <div>
            <span>Next action</span>
            <b className={'nx nx-' + c.next.k}>{c.next.s}</b>
          </div>
          <div>
            <span>Last touch</span>
            <b>{c.lastTouch ? fDate(c.lastTouch) + ' · ' + ago(c.lastTouch) : '—'}</b>
          </div>
          {c.nextMeet && (
            <div>
              <span>Next meeting</span>
              <b>{fFull(c.nextMeet.t)}</b>
            </div>
          )}
          {c.sentiment && (
            <div>
              <span>Sentiment</span>
              <Sent s={c.sentiment} />
            </div>
          )}
          {c.alternate_contact && (
            <div>
              <span>Alternate contact</span>
              <b>{c.alternate_contact.split(';').join(', ')}</b>
            </div>
          )}
          {c.reply_note && (
            <div className="wide">
              <span>Note</span>
              <b>{c.reply_note}</b>
            </div>
          )}
        </div>

        <div className="dr-tabs">
          <Chips
            v={tab}
            set={setTab}
            opts={[
              ['overview', 'All Activity'],
              ['emails', 'Email Threads'],
              ['linkedin', 'LinkedIn'],
              ['meetings', 'Meetings'],
            ]}
            counts={{
              overview: c.tl.length,
              emails: c.emails.length,
              linkedin: c.tl.filter(x => x.ch === 'linkedin').length,
              meetings: c.meets.length,
            }}
          />
        </div>

        {tab === 'emails' ? (
          <Threads c={c} />
        ) : tab === 'meetings' ? (
          <div className="tl">
            {c.meets.map(m => (
              <div key={m.id} style={{ marginBottom: '12px' }}>
                <MeetCard m={m} open={open} />
              </div>
            ))}
            {!c.meets.length && <Empty t="No meetings scheduled" s="No client meetings with this contact yet." />}
          </div>
        ) : (
          <div className="tl">
            {groups.map(g => (
              <div key={g.k}>
                <div className="tl-m">{g.k}</div>
                {g.xs.map((x, i) => (
                  <div key={i} className={'tl-i ch-' + x.ch + (x.dir === 'in' ? ' in' : '') + (x.type === 'draft' ? ' faint' : '')}>
                    <span className="tl-ic">{icon(x)}</span>
                    <div className="tl-b">
                      <div className="tl-t">
                        <b>{x.title}</b>
                        {x.sentiment && <Sent s={x.sentiment} />}
                        <span className="mute sm">
                          {x.t ? (x.type === 'meeting' ? fFull(x.t) : fDate(x.t) + (x.url && x.ch === 'email' ? ' · ' + fTime(x.t) : '')) : ''}
                        </span>
                      </div>
                      {x.subject && <div className="subj">{x.subject}</div>}
                      {x.body && <div className="tl-s">{x.body.length > 360 ? x.body.slice(0, 360) + '…' : x.body}</div>}
                      {x.note && <div className="mute sm">{x.note}</div>}
                      {x.alt && <div className="sm">Alternate contact: <b>{x.alt.split(';').join(', ')}</b></div>}
                      <div className="tl-l">
                        {x.url && x.ch === 'email' && <a href={x.url} target="_blank" rel="noreferrer"><I n="mail" s={12} /> Open in Gmail</a>}
                        {x.meet && <a href={x.meet} target="_blank" rel="noreferrer"><I n="video" s={12} /> Meet link</a>}
                        {x.url && x.ch === 'meeting' && <a href={x.url} target="_blank" rel="noreferrer"><I n="ext" s={12} /> Calendar event</a>}
                        {x.src && <span className="mute sm">from {x.src}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {!groups.length && <Empty t="No activity recorded" />}
          </div>
        )}
      </aside>
    </>
  );
}
