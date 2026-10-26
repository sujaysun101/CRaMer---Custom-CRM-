'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { I } from '../_crm/ui';

export default function Signup() {
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleSignup = async ev => {
    ev.preventDefault();
    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ companyName, name, email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        window.location.href = '/';
      } else {
        setError(data.error || 'Failed to create workspace');
        setBusy(false);
      }
    } catch (err) {
      setError('Network error, please try again.');
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

      <form onSubmit={handleSignup} style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span className="mark" style={{ width: 40, height: 40, fontSize: 18 }}>C</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: -0.3 }}>CRaMer Cloud</div>
            <div style={{ fontSize: 13, color: 'var(--mute)' }}>Start your 14-day free workspace trial</div>
          </div>
        </div>

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mute)' }}>Company / Team Name</label>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Acme Corporation"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mute)' }}>Your Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Jane Doe"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mute)' }}>Work Email</label>
          <input
            type="email"
            required
            placeholder="jane@acmecorp.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--mute)' }}>Password</label>
          <input
            type="password"
            required
            placeholder="Minimum 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="btn brand"
          disabled={busy}
          style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 14, fontWeight: 600, marginTop: 4 }}
        >
          {busy ? 'Creating Workspace...' : 'Create Workspace & Start Trial'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--mute)', marginTop: 12 }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>
            Sign In
          </a>
        </div>
      </form>
    </div>
  );
}
