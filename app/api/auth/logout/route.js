import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' || process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    })
  : null;

export async function POST(req) {
  const token = req.cookies.get('crm_session')?.value;
  if (token && pool) {
    try {
      await pool.query('DELETE FROM public.sessions WHERE token = $1', [token]);
    } catch {}
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete('crm_session');
  res.cookies.delete('crm_auth');
  return res;
}
