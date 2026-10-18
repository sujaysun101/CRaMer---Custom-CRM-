'use client';
// Small presentational primitives shared by CRaMer views.
import { initials, who } from './model';
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M22 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  board: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  reply: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v4',
  loop: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-5-5',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  x: 'M6 6l12 12M18 6 6 18', check: 'M5 12l5 5L20 7', refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  video: 'M3 7h12v10H3zM15 10l6-3v10l-6-3', bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4', bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  out: 'M7 17 17 7M8 7h9v9', in: 'M17 7 7 17M16 17H7V8', ban: 'M5.6 5.6l12.8 12.8M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18', chev: 'M9 6l6 6-6 6',
};
export const I = ({ n, s = 16, c }) => (n === 'li'
  ? <svg width={s} height={s} viewBox="0 0 24 24" className={c}><rect width="24" height="24" rx="4" fill="#0a66c2" /><path fill="#fff" d="M7 10h2.6v8H7zM8.3 6a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3M11.2 10h2.5v1.1c.4-.7 1.3-1.3 2.6-1.3 2.7 0 3.2 1.7 3.2 4V18h-2.6v-3.7c0-.9 0-2-1.3-2s-1.5 1-1.5 2V18h-2.6z" /></svg>
  : <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={c}><path d={P[n]} /></svg>);
const HUES = [221, 262, 291, 330, 14, 32, 152, 174, 196];
export const Avatar = ({ c, s = 28 }) => { const k = who(c); let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const hue = HUES[h % HUES.length];
  return <span className="av" style={{ width: s, height: s, fontSize: s * .38, background: `hsl(${hue} 70% 94%)`, color: `hsl(${hue} 55% 38%)` }}>{initials(k)}</span>; };
export const Stage = ({ s }) => s ? <span className={'stage st-' + s.toLowerCase()}>{s}</span> : <span className="mute">—</span>;
export const Sent = ({ s }) => s ? <span className={'sent s-' + s}>{s.replace('-', ' ')}</span> : null;
export const Channels = ({ c }) => <span className="chs">
  {c.ch.has('email') && <span title="Email" className="chi em"><I n="mail" s={13} /></span>}
  {c.ch.has('linkedin') && <span title="LinkedIn" className="chi"><I n="li" s={14} /></span>}
  {c.ch.has('meeting') && <span title="Meeting" className="chi mt"><I n="cal" s={13} /></span>}
</span>;
export const Empty = ({ t, s }) => <div className="empty"><div className="empty-t">{t}</div>{s && <div className="mute">{s}</div>}</div>;
export const Chips = ({ opts, v, set, counts }) => <div className="chips">{opts.map(o => { const [k, l] = Array.isArray(o) ? o : [o, o];
  return <button key={k} className={'chip' + (v === k ? ' on' : '')} onClick={() => set(k)}>{l}{counts && counts[k] != null && <span className="cn">{counts[k]}</span>}</button>; })}</div>;
export const Lead = ({ c, open, sub }) => <button className="lead" onClick={() => open(c.id)}><Avatar c={c} /><span className="lead-t"><b>{who(c)}</b><span className="mute">{sub ?? (c.org || c.email || '')}</span></span></button>;
