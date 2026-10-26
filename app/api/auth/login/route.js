import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { hashPassword, createSession, PW_HASH } from '../../../../lib/auth';

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' || process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    })
  : null;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email || '').toLowerCase().trim();
  const password = (body.password || '').trim();

  // If email is provided, perform multi-tenant user authentication
  if (email && pool) {
    const pwHash = hashPassword(password);
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT u.id, u.org_id, u.email, u.name, u.role, o.name as org_name
         FROM public.users u
         JOIN public.organizations o ON u.org_id = o.id
         WHERE u.email = $1 AND u.password_hash = $2`,
        [email, pwHash]
      );

      if (res.rows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Invalid email or password' }, { status: 401 });
      }

      const user = res.rows[0];
      const { token } = await createSession(user.id, user.org_id);

      const isLocal = (req.headers.get('host') || '').includes('localhost');
      const response = NextResponse.json({ ok: true, user: { name: user.name, email: user.email, org: user.org_name } });
      response.cookies.set('crm_session', token, {
        httpOnly: true,
        secure: !isLocal,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      });
      return response;
    } finally {
      client.release();
    }
  }

  // Master password fallback
  const h = hashPassword(password);
  if (PW_HASH && h === PW_HASH) {
    const isLocal = (req.headers.get('host') || '').includes('localhost');
    const response = NextResponse.json({ ok: true });
    response.cookies.set('crm_auth', h, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return response;
  }

  return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
}
