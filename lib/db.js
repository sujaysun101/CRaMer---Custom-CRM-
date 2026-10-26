// Pure PostgreSQL database client with connection pooling.
// Supports direct self-hosted PostgreSQL (via DATABASE_URL).
// Falls back to Supabase or local seed if DATABASE_URL is not set.
import 'server-only';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

let pgPool = null;
let initPromise = null;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pgPool) {
    const isSsl = process.env.DATABASE_SSL === 'true' || process.env.DATABASE_URL.includes('sslmode=require');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isSsl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pgPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return pgPool;
}

// Auto-initialize tables from schema.sql on first startup if empty
export async function ensureDatabaseReady() {
  const pool = getPool();
  if (!pool) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const client = await pool.connect();
      try {
        const tableCheck = await client.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contacts'"
        );
        if (tableCheck.rows.length === 0) {
          console.log('[PostgreSQL] Initializing tables from schema.sql...');
          const schemaPath = path.join(process.cwd(), 'schema.sql');
          if (fs.existsSync(schemaPath)) {
            const sql = fs.readFileSync(schemaPath, 'utf8');
            await client.query(sql);
            console.log('[PostgreSQL] Tables and indexes created successfully.');

            // Seed initial data if seed.json exists
            const seedPath = path.join(process.cwd(), 'data', 'seed.json');
            if (fs.existsSync(seedPath)) {
              console.log('[PostgreSQL] Seeding initial data from seed.json...');
              const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
              for (const [table, rows] of [
                ['accounts', raw.accounts || []],
                ['contacts', raw.contacts || []],
                ['deals', raw.deals || []],
                ['messages', raw.messages || []],
                ['thread_messages', raw.thread_messages || []],
                ['events', raw.events || []],
                ['meetings', raw.meetings || []],
                ['queue_items', raw.queue_items || []],
                ['notifications', raw.notifications || []],
                ['sync_state', raw.sync || []],
              ]) {
                if (rows.length > 0) {
                  await upsertPg(client, table, rows);
                }
              }
              console.log('[PostgreSQL] Database seeded successfully.');
            }
          }
        }
      } finally {
        client.release();
      }
    } catch (e) {
      console.error('[PostgreSQL] Initialization error:', e.message);
    }
  })();

  return initPromise;
}

export const isPg = () => Boolean(process.env.DATABASE_URL);
export const isSupabase = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
export const dbEnabled = () => isPg() || isSupabase();

// --- PostgreSQL Implementation ---

function formatOrder(order) {
  if (!order) return 'id ASC';
  return order
    .split(',')
    .map(part => {
      const p = part.trim();
      if (p.endsWith('.asc')) return `"${p.replace('.asc', '')}" ASC`;
      if (p.endsWith('.desc')) return `"${p.replace('.desc', '')}" DESC`;
      return `"${p}" ASC`;
    })
    .join(', ');
}

export async function selectAll(table, select = '*', order = 'id', max = Infinity) {
  if (isPg()) {
    await ensureDatabaseReady();
    const pool = getPool();
    const selectCols = select === '*' ? '*' : select.split(',').map(c => `"${c.trim()}"`).join(', ');
    const orderClause = formatOrder(order);
    const limitClause = Number.isFinite(max) ? ` LIMIT ${Math.floor(max)}` : '';
    const sql = `SELECT ${selectCols} FROM "${table}" ORDER BY ${orderClause}${limitClause}`;
    const res = await pool.query(sql);
    return res.rows;
  }

  // Supabase fallback
  return supabaseSelectAll(table, select, order, max);
}

// Handles PostgREST-style query parameters or standard SQL queries
export async function select(table, query) {
  if (isPg()) {
    await ensureDatabaseReady();
    const pool = getPool();
    const params = new URLSearchParams(query);
    const selectClause = params.get('select')
      ? params.get('select').split(',').map(c => `"${c.trim()}"`).join(', ')
      : '*';
    const limitClause = params.get('limit') ? ` LIMIT ${parseInt(params.get('limit'), 10)}` : '';
    const orderClause = params.get('order') ? ` ORDER BY ${formatOrder(params.get('order'))}` : '';

    const whereClauses = [];
    const values = [];

    for (const [key, val] of params.entries()) {
      if (['select', 'limit', 'order'].includes(key)) continue;
      if (val.startsWith('eq.')) {
        values.push(val.slice(3));
        whereClauses.push(`"${key}" = $${values.length}`);
      } else if (val.startsWith('cs.')) {
        // PostgREST contains: e.g. contact_ids=cs.{c_123}
        const inner = val.slice(3).replace(/^\{|\}$/g, '');
        values.push(inner);
        whereClauses.push(`$${values.length} = ANY("${key}")`);
      } else if (val === 'is.null') {
        whereClauses.push(`"${key}" IS NULL`);
      }
    }

    const where = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `SELECT ${selectClause} FROM "${table}"${where}${orderClause}${limitClause}`;
    const res = await pool.query(sql, values);
    return res.rows;
  }

  return supabaseSelect(table, query);
}

export async function patch(table, id, values) {
  if (isPg()) {
    await ensureDatabaseReady();
    const pool = getPool();
    const keys = Object.keys(values);
    if (keys.length === 0) return null;

    const setClauses = keys.map((k, idx) => `"${k}" = $${idx + 2}`).join(', ');
    const params = [id, ...Object.values(values)];
    const sql = `UPDATE "${table}" SET ${setClauses}, updated_at = NOW() WHERE "id" = $1 RETURNING *`;
    const res = await pool.query(sql, params);
    return res.rows[0];
  }

  return supabasePatch(table, id, values);
}

export async function patchWhere(table, filter, values) {
  if (isPg()) {
    await ensureDatabaseReady();
    const pool = getPool();
    const valKeys = Object.keys(values);
    if (valKeys.length === 0) return;

    const queryParams = [];
    const setClauses = valKeys.map(k => {
      queryParams.push(values[k]);
      return `"${k}" = $${queryParams.length}`;
    });

    const whereClauses = [];
    for (const part of filter.split('&')) {
      const [k, v] = part.split('=');
      if (!k || !v) continue;
      if (v.startsWith('eq.')) {
        queryParams.push(decodeURIComponent(v.slice(3)));
        whereClauses.push(`"${k}" = $${queryParams.length}`);
      } else if (v === 'is.null') {
        whereClauses.push(`"${k}" IS NULL`);
      }
    }

    const where = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `UPDATE "${table}" SET ${setClauses.join(', ')}${where}`;
    await pool.query(sql, queryParams);
    return;
  }

  return supabasePatchWhere(table, filter, values);
}

export async function insert(table, row) {
  if (isPg()) {
    await ensureDatabaseReady();
    const pool = getPool();
    const keys = Object.keys(row);
    const cols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`;
    await pool.query(sql, Object.values(row));
    return;
  }

  return supabaseInsert(table, row);
}

async function upsertPg(clientOrPool, table, rows) {
  if (!rows || rows.length === 0) return;
  const list = Array.isArray(rows) ? rows : [rows];
  const conflictCol = table === 'sync_state' ? 'key' : 'id';

  for (const item of list) {
    const keys = Object.keys(item);
    if (keys.length === 0) continue;
    const cols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updateClauses = keys
      .filter(k => k !== conflictCol && k !== 'created_at')
      .map(k => `"${k}" = EXCLUDED."${k}"`)
      .join(', ');

    const sql = `
      INSERT INTO "${table}" (${cols})
      VALUES (${placeholders})
      ON CONFLICT ("${conflictCol}")
      DO UPDATE SET ${updateClauses.length > 0 ? updateClauses : `"${conflictCol}" = EXCLUDED."${conflictCol}"`}
    `;
    await clientOrPool.query(sql, Object.values(item));
  }
}

export async function upsert(table, rows) {
  if (isPg()) {
    await ensureDatabaseReady();
    const pool = getPool();
    await upsertPg(pool, table, rows);
    return;
  }

  return supabaseUpsert(table, rows);
}

// --- Supabase PostgREST Fallback ---
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = (extra = {}) => ({ apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...extra });

async function supabaseSelectAll(table, select = '*', order = 'id', max = Infinity) {
  if (!URL_ || !KEY) return [];
  const out = []; const page = Math.min(1000, max);
  for (let from = 0; from < max; from += page) {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${select}&order=${order}`, {
      headers: h({ Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }),
      cache: 'no-store',
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    const rows = await r.json(); out.push(...rows);
    if (rows.length < page) return out;
  }
  return out;
}

async function supabaseSelect(table, query) {
  if (!URL_ || !KEY) return [];
  const r = await fetch(`${URL_}/rest/v1/${table}?${query}`, { headers: h(), cache: 'no-store' });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function supabasePatchWhere(table, filter, values) {
  if (!URL_ || !KEY) return;
  const r = await fetch(`${URL_}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: h({ Prefer: 'return=minimal' }), body: JSON.stringify(values) });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
}

async function supabasePatch(table, id, values) {
  if (!URL_ || !KEY) return null;
  const r = await fetch(`${URL_}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: h({ Prefer: 'return=representation' }), body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }) });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  return (await r.json())[0];
}

async function supabaseInsert(table, row) {
  if (!URL_ || !KEY) return;
  const r = await fetch(`${URL_}/rest/v1/${table}`, { method: 'POST', headers: h({ Prefer: 'return=minimal' }), body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
}

async function supabaseUpsert(table, rows) {
  if (!URL_ || !KEY || !rows || (Array.isArray(rows) && rows.length === 0)) return;
  const r = await fetch(`${URL_}/rest/v1/${table}`, {
    method: 'POST',
    headers: h({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
}
