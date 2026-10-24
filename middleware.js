import { NextResponse } from 'next/server';
import { PW_HASH } from './lib/auth';

export function middleware(req) {
  const p = req.nextUrl.pathname;
  if (p.startsWith('/login') || p.startsWith('/api/login') || p.startsWith('/_next')) return NextResponse.next();
  // Allow Vercel daily cron trigger
  if (p === '/api/sync' && (req.headers.get('user-agent')?.includes('vercel-cron') || (process.env.CRON_SECRET && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`))) {
    return NextResponse.next();
  }
  if (PW_HASH && req.cookies.get('crm_auth')?.value === PW_HASH) return NextResponse.next();
  if (p.startsWith('/api')) return new NextResponse('unauthorized', { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}
