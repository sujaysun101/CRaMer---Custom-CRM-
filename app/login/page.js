'use client';
import { useEffect, useState } from 'react';
import { I } from '../_crm/ui';

export default function Login() {
  const [p, setP] = useState('');
  const [e, setE] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('crm_theme') || 'dark';
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } catch {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('crm_theme', next);
    } catch {}
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div className="login" style={{ position: 'relative' }}>
      <button
        type="button"
        className="theme-tog"
        onClick={toggleTheme}
        style={{ position: 'absolute', top: 20, right: 24 }}
      >
        <I n={theme === 'dark' ? 'sun' : 'moon'} s={14} />
        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
      <form
        onSubmit={async ev => {
          ev.preventDefault();
          setBusy(true);
          setE('');
          const r = await fetch('/api/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ password: p }),
          });
          if (r.ok) location.href = '/';
          else {
            setE('Wrong password');
            setBusy(false);
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mark">C</span>
          <div>
            <b style={{ fontSize: 16 }}>CRaMer</b>
            <span className="logo-sub">Zergware & MultiDomain Systems</span>
          </div>
        </div>
        <h2>Sign in to CRaMer</h2>
        <span className="mute">Sujay’s software pipeline, inbox, and meetings in one place.</span>
        <input
          type="password"
          autoFocus
          value={p}
          onChange={x => setP(x.target.value)}
          placeholder="Enter access password"
        />
        <button className="btn pri" disabled={busy}>
          {busy ? 'Signing in…' : 'Continue'}
        </button>
        <div className="err">{e}</div>
      </form>
    </div>
  );
}
