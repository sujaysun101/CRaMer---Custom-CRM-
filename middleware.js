import { NextResponse } from 'next/server';
import { PW_HASH } from './lib/auth-constants';

export function middleware(req) {
  const p = req.nextUrl.pathname;

  // Allow public static assets and auth routes
  if (
    p.startsWith('/login') ||
    p.startsWith('/signup') ||
    p.startsWith('/api/login') ||
    p.startsWith('/api/auth') ||
    p.startsWith('/_next') ||
    p === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Allow internal/cron background sync calls
  if (
    p === '/api/sync' &&
    (req.headers.get('user-agent')?.includes('vercel-cron') ||
      (process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`))
  ) {
    return NextResponse.next();
  }

  // Multi-tenant session cookie or legacy master password
  const hasSession = Boolean(req.cookies.get('crm_session')?.value);
  const hasLegacyAuth = Boolean(PW_HASH && req.cookies.get('crm_auth')?.value === PW_HASH);

  if (hasSession || hasLegacyAuth) {
    return NextResponse.next();
  }

  if (p.startsWith('/api')) {
    return new NextResponse('unauthorized', { status: 401 });
  }

  return NextResponse.redirect(new URL('/login', req.url));
}
