import { NextResponse } from 'next/server';
import { getAuthContextFromRequest } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const ctx = await getAuthContextFromRequest(req);
  if (!ctx) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: ctx.user,
    org: ctx.org,
  });
}
