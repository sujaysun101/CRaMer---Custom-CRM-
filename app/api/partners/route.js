import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getAuthContextFromRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';
const file = path.join(process.cwd(), 'data', 'partners.json');
const fields = ['name','contact','stage','priority','scope','success','onboarding','contract','payment','issues','features','proof','followup','evidence'];
async function authorized(req) {
  return process.env.CRM_LOCAL_PARTNERS === '1' && !process.env.DATABASE_URL && !process.env.SUPABASE_URL && Boolean(await getAuthContextFromRequest(req));
}
async function read() {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}
export async function GET(req) {
  if (!await authorized(req)) return Response.json({error:'Local workspace unavailable or session invalid'}, {status:401});
  try { return Response.json(await read(), {headers:{'Cache-Control':'no-store'}}); }
  catch { return Response.json({error:'Could not read partner records'}, {status:500}); }
}
export async function POST(req) {
  if (!await authorized(req)) return Response.json({error:'Local workspace unavailable or session invalid'}, {status:401});
  let origin;
  try { origin = new URL(req.headers.get('origin')); } catch { return Response.json({error:'Invalid origin'}, {status:403}); }
  if (origin.host !== req.headers.get('host') || !['http:', 'https:'].includes(origin.protocol)) return Response.json({error:'Invalid origin'}, {status:403});
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 200 || fields.some(k => body[k] != null && (typeof body[k] !== 'string' || body[k].length > 20000))) return Response.json({error:'Enter a partner name and valid fields'}, {status:400});
  try {
    const records = await read();
    let index = body.id ? records.findIndex(p => p.id === body.id) : -1;
    if (body.id && index < 0) return Response.json({error:'Record not found'}, {status:404});
    const record = Object.fromEntries(fields.map(k => [k, (body[k] || '').trim()]));
    record.id = body.id || crypto.randomUUID();
    record.updatedAt = new Date().toISOString();
    if (index < 0) records.push(record); else records[index] = record;
    await fs.mkdir(path.dirname(file), {recursive:true});
    const temp = file + '.' + crypto.randomUUID() + '.tmp';
    await fs.writeFile(temp, JSON.stringify(records, null, 2), {mode:0o600});
    await fs.rename(temp, file);
    return Response.json(record);
  } catch { return Response.json({error:'Could not save partner record'}, {status:500}); }
}
