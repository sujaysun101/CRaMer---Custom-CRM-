'use client';
import { useState } from 'react';
export default function Login() {
  const [p, setP] = useState(''); const [e, setE] = useState(''); const [busy, setBusy] = useState(false);
  return <div className="login"><form onSubmit={async ev => { ev.preventDefault(); setBusy(true); setE('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: p }) });
    if (r.ok) location.href = '/'; else { setE('Wrong password'); setBusy(false); } }}>
    <span className="mark">C</span><h2>Sign in to CRaMer</h2><span className="mute">Sujay’s pipeline, inbox and meetings in one place.</span>
    <input type="password" autoFocus value={p} onChange={x => setP(x.target.value)} placeholder="Password" />
    <button className="btn pri" disabled={busy}>{busy ? 'Signing in…' : 'Continue'}</button><div className="err">{e}</div>
  </form></div>;
}
