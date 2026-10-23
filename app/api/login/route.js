import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { PW_HASH } from '../../../lib/auth';

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  const trimmed = (password || '').trim();
  const h = crypto.createHash('sha256').update(trimmed).digest('hex');

  if (!PW_HASH || h !== PW_HASH) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const host = req.headers.get('host') || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

  const r = NextResponse.json({ ok: true });
  r.cookies.set('crm_auth', h, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  return r;
}
