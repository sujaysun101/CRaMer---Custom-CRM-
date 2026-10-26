import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { Pool } from 'pg';
import { hashPassword, createSession } from '../../../../lib/auth';

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' || process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    })
  : null;

export async function POST(req) {
  if (!pool) {
    return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const companyName = (body.companyName || '').trim();
  const email = (body.email || '').toLowerCase().trim();
  const password = (body.password || '').trim();
  const name = (body.name || '').trim() || email.split('@')[0];

  if (!companyName || !email || !password) {
    return NextResponse.json({ ok: false, error: 'Company name, email, and password are required' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ ok: false, error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Check if user already exists
    const existing = await client.query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ ok: false, error: 'An account with this email already exists' }, { status: 409 });
    }

    const orgId = 'org_' + crypto.randomBytes(8).toString('hex');
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('org-' + Date.now());
    const userId = 'u_' + crypto.randomBytes(8).toString('hex');
    const pwHash = hashPassword(password);

    await client.query('BEGIN');

    // 1. Create Organization (Tenant)
    await client.query(
      `INSERT INTO public.organizations (id, name, slug, plan, subscription_status)
       VALUES ($1, $2, $3, 'pro', 'trialing')
       ON CONFLICT (slug) DO UPDATE SET slug = $3 || '-' || substring(md5(random()::text) from 1 for 4)`,
      [orgId, companyName, slug]
    );

    // 2. Create Owner User
    await client.query(
      `INSERT INTO public.users (id, org_id, email, name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'owner')`,
      [userId, orgId, email, name, pwHash]
    );

    // 3. Create initial empty sync state for this tenant
    await client.query(
      `INSERT INTO public.sync_state (key, org_id, last_synced_at, info)
       VALUES ($1, $2, $3, $4)`,
      ['last_run_' + orgId, orgId, new Date().toISOString(), JSON.stringify({ mode: 'initial_signup' })]
    );

    await client.query('COMMIT');

    // 4. Create Session
    const { token } = await createSession(userId, orgId);

    const isLocal = (req.headers.get('host') || '').includes('localhost');
    const res = NextResponse.json({ ok: true, org_id: orgId, user_id: userId });
    res.cookies.set('crm_session', token, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return res;
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Registration failed:', e);
    return NextResponse.json({ ok: false, error: e.message || 'Registration failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
