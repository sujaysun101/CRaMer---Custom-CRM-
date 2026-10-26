'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { I } from '../_crm/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasskeyMode, setIsPasskeyMode] = useState(false);
  const [error, setError] = useState('');
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

  const handleSubmit = async ev => {
    ev.preventDefault();
    setBusy(true);
    setError('');

    try {
      let endpoint = '/api/auth/login';
      let payload = { email, password };

      if (isPasskeyMode || !email) {
        endpoint = '/api/login';
        payload = { password };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        window.location.href = '/';
      } else {
        setError(data.error || 'Invalid credentials');
        setBusy(false);
      }
    } catch {
      setError('Connection error, please try again.');
      setBusy(false);
    }
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

      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span className="mark">C</span>
          <div>
            <b style={{ fontSize: 16 }}>CRaMer Cloud</b>
            <span className="logo-sub">Multi-Tenant Sales & Outreach Engine</span>
          </div>
        </div>

        <h2 style={{ margin: '8px 0 4px 0' }}>Sign in to your account</h2>
        <span className="mute" style={{ marginBottom: 12 }}>
          {isPasskeyMode
            ? 'Sign in with your administrator master passkey'
            : 'Access your team pipeline, emails, and meetings'}
        </span>

        {error && (
          <div style={{
            background: 'var(--hot-s)',
            color: 'var(--hot)',
            padding: '10px 14px',
            borderRadius: 'var(--r-sm)',
            fontSize: 13,
            border: '1px solid rgba(244,63,94,0.3)',
          }}>
            {error}
          </div>
        )}

        {!isPasskeyMode && (
          <input
            type="email"
            autoFocus
            placeholder="Work email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        )}

        <input
          type="password"
          autoFocus={isPasskeyMode}
          placeholder={isPasskeyMode ? 'Enter master passkey' : 'Password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          className="btn brand"
          disabled={busy}
          style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 14, fontWeight: 600 }}
        >
          {busy ? 'Signing in...' : 'Sign In'}
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => {
              setIsPasskeyMode(!isPasskeyMode);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--mute)',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
              fontSize: 12,
            }}
          >
            {isPasskeyMode ? 'Use Email & Password' : 'Use Admin Master Passkey'}
          </button>

          <a href="/signup" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
            Create Workspace →
          </a>
        </div>
      </form>
    </div>
  );
}
