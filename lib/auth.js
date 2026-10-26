import crypto from 'crypto';
import { Pool } from 'pg';
import { PW_HASH } from './auth-constants';

export { PW_HASH };

let authPool = null;
function getAuthPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!authPool) {
    authPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' || process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }
  return authPool;
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update((password || '').trim()).digest('hex');
}

export async function createSession(userId, orgId) {
  const pool = getAuthPool();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const id = 'sess_' + crypto.randomBytes(12).toString('hex');

  if (pool) {
    try {
      await pool.query(
        'INSERT INTO public.sessions (id, user_id, org_id, token, expires_at) VALUES ($1, $2, $3, $4, $5)',
        [id, userId, orgId, token, expiresAt]
      );
    } catch (e) {
      console.error('Failed to save session to DB:', e.message);
    }
  }

  return { token, expiresAt };
}

export async function getSessionContext(token) {
  if (!token) return null;
  const pool = getAuthPool();
  if (!pool) return null;

  try {
    const res = await pool.query(
      `SELECT s.id as session_id, s.expires_at, 
              u.id as user_id, u.email, u.name as user_name, u.role,
              o.id as org_id, o.name as org_name, o.slug as org_slug, o.plan, o.custom_domain
       FROM public.sessions s
       JOIN public.users u ON s.user_id = u.id
       JOIN public.organizations o ON s.org_id = o.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      user: { id: r.user_id, email: r.email, name: r.user_name, role: r.role },
      org: { id: r.org_id, name: r.org_name, slug: r.org_slug, plan: r.plan, custom_domain: r.custom_domain },
      org_id: r.org_id,
    };
  } catch (e) {
    console.error('Session lookup failed:', e.message);
    return null;
  }
}

export async function getAuthContextFromRequest(req) {
  const sessionToken = req.cookies.get('crm_session')?.value;
  if (sessionToken) {
    const ctx = await getSessionContext(sessionToken);
    if (ctx) return ctx;
  }

  const legacyCookie = req.cookies.get('crm_auth')?.value;
  if (PW_HASH && legacyCookie === PW_HASH) {
    return {
      user: { id: 'u_admin_default', name: 'Sujay Sundar', email: 'sujay@multidomain.com', role: 'owner' },
      org: { id: 'org_default', name: 'MultiDomain Systems', slug: 'multidomain', plan: 'enterprise' },
      org_id: 'org_default',
    };
  }

  return null;
}
