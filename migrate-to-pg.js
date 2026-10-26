// Standalone migration script to seed any PostgreSQL database from seed.json.
// Usage: DATABASE_URL="postgresql://user:password@localhost:5432/dbname" node migrate-to-pg.js

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Error: DATABASE_URL environment variable is required.');
    console.error('Example: DATABASE_URL="postgresql://cramer@localhost:5433/cramer_db" node migrate-to-pg.js');
    process.exit(1);
  }

  console.log('[1/4] Connecting to PostgreSQL at', dbUrl.replace(/:[^:@]+@/, ':****@'));
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    console.log('[2/4] Executing schema.sql to ensure all tables and indexes exist...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schemaSql);
    console.log('✓ Schema applied successfully.');

    console.log('[3/4] Reading data from data/seed.json...');
    const seedPath = path.join(__dirname, 'data', 'seed.json');
    if (!fs.existsSync(seedPath)) {
      console.log('Notice: data/seed.json not found. Database schema is ready with empty tables.');
      return;
    }

    const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

    const tables = [
      ['accounts', data.accounts || []],
      ['contacts', data.contacts || []],
      ['deals', data.deals || []],
      ['messages', data.messages || []],
      ['thread_messages', data.thread_messages || []],
      ['events', data.events || []],
      ['meetings', data.meetings || []],
      ['queue_items', data.queue_items || []],
      ['notifications', data.notifications || []],
      ['sync_state', data.sync || []],
    ];

    console.log('[4/4] Migrating rows into PostgreSQL...');
    for (const [table, rows] of tables) {
      if (!rows || rows.length === 0) continue;
      let inserted = 0;

      if (table === 'events') {
        // Clear events and insert clean history
        await client.query('TRUNCATE table public.events RESTART IDENTITY CASCADE');
        for (const item of rows) {
          const keys = Object.keys(item).filter(k => k !== 'id');
          if (keys.length === 0) continue;
          const cols = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const sql = `INSERT INTO "events" (${cols}) VALUES (${placeholders})`;
          await client.query(sql, keys.map(k => item[k]));
          inserted++;
        }
      } else {
        const conflictCol = table === 'sync_state' ? 'key' : 'id';
        for (const item of rows) {
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
          await client.query(sql, Object.values(item));
          inserted++;
        }
      }
      console.log(`  ✓ ${table}: ${inserted} rows migrated`);
    }

    console.log('\nMigration complete! Your PostgreSQL database is fully populated and ready.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
