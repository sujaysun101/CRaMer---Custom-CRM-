# CRaMer — Custom CRM (v1)

Pipedrive-style personal CRM: deals pipeline kanban (Lead → Contacted → Replied → Meeting → Negotiation → Won/Lost), contacts with a unified timeline (email, LinkedIn, Meet notes), a Needs-reply queue, and do-not-contact flags. Nothing in the app sends email or messages; outbound is drafts-only.

## Setup
```bash
npm install
python3 seed.py                 # reads /workspace/crm/import -> data/seed.json
echo -n 'your-password' | sha256sum   # put the hex into .env.local:
cp .env.example .env.local      # CRM_PASSWORD_HASH=<hex>
npm run build && npm start
```

## Configuration
- `SUPABASE_URL`: Supabase project URL. Server-only.
- `SUPABASE_SERVICE_ROLE_KEY`: service_role key. Server-only; read only in `lib/db.js` (guarded by `server-only`), never sent to the browser, never committed.
  With both set, `/api/data` reads from Supabase and `/api/edit` persists stage moves, DNC toggles and queue status (each also logged to `edits`). Without them the app falls back to `data/seed.json` and edits stay in browser localStorage.
- `CRM_SENDER` (optional, seed.py only): label for the outreach inbox shown on timeline events.
- `CRM_PASSWORD_HASH` (required): SHA-256 hex of the access password. If unset, the app rejects every request. On Easel, set it as a project environment variable (the Easel CLI does not upload `.env*` files).

## Database
Schema: `supabase/schema.sql` (RLS on, no policies, anon/authenticated privileges revoked).

## Data (not in this repo)
`data/seed.json` and the raw import logs contain personal contact data and are git-ignored. Regenerate with `python3 seed.py`. Input: `gmail-send-*`, `gmail-bounce-fix-*`, `gmail-ooo-*` (sent/bounced/rerouted), `gmail-batch-*` (drafts → pending), `linkedin-batch-*` (invites), `deny-emails.txt` / `linkedin-deny.txt` (do-not-contact). Files starting with `_` are ignored.

## Needs-reply queue
Implements `follow-up-rules.md`: statuses Open/Drafted/Waiting/Blocked/Closed/Unknown; bounce → Blocked, auto-reply → Waiting; deny-listed contacts suppressed; dedupe by contact + normalized ask; owners and due dates never inferred.

## Import hooks
Append to `events` (`{contact_id, channel: email|linkedin|meet, kind, date, summary}`) and `queue` in `data/seed.json`. Gmail/Drive/Meet sync is not in v1. UI edits persist to Supabase via `POST /api/edit {entity: deal|contact|queue_item, id, value}` (localStorage fallback when no DB).
