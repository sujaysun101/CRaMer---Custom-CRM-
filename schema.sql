-- CRaMer Salesforce-style CRM Architecture Schema for PostgreSQL
-- Standard Objects: Accounts, Contacts/Leads, Opportunities (Deals), Activities (Emails, LinkedIn, Tasks, Events)

-- 1. Accounts (Organizations / Companies)
create table if not exists public.accounts (
  id text primary key,
  name text not null,
  domain text,
  industry text,
  website text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Contacts / Leads (Individuals)
create table if not exists public.contacts (
  id text primary key,
  account_id text references public.accounts(id) on delete set null,
  name text,
  email text,
  phone text,
  title text,
  org text,
  linkedin text,
  linkedin_status text not null default 'not_connected' check (linkedin_status in ('not_connected','invite_sent','connected','messaged')),
  stage text not null default 'Lead' check (stage in ('Lead','Contacted','Replied','Meeting','Negotiation','Won','Lost')),
  status text not null default 'pending' check (status in ('pending','sent','bounced','rerouted')),
  dnc boolean not null default false,
  never_contact boolean not null default false,
  sentiment text,
  needs_followup boolean not null default false,
  reply_note text,
  next_action text,
  alternate_contact text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Opportunities / Deals (Pipeline Transactions)
create table if not exists public.deals (
  id text primary key,
  contact_id text not null references public.contacts(id) on delete cascade,
  account_id text references public.accounts(id) on delete set null,
  title text not null,
  stage text not null default 'Lead' check (stage in ('Lead','Contacted','Replied','Meeting','Negotiation','Won','Lost')),
  value numeric default 0,
  probability numeric default 10,
  close_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Email Messages (Inbound and Outbound Emails)
create table if not exists public.messages (
  id text primary key,
  contact_id text not null references public.contacts(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  kind text not null default 'email',
  date text not null,
  subject text,
  snippet text,
  body text,
  body_raw text,
  from_addr text,
  from_name text,
  to_addrs text[],
  cc_addrs text[],
  url text,
  thread_id text,
  account text,
  sentiment text,
  needs_followup boolean not null default false,
  note text,
  alternate_contact text,
  ooo_type text,
  created_at timestamptz not null default now()
);

-- 5. Thread Messages (Full Gmail / Email Thread History)
create table if not exists public.thread_messages (
  id text primary key,
  thread_id text not null,
  account text,
  contact_ids text[],
  from_addr text,
  from_name text,
  to_addrs text[],
  cc_addrs text[],
  date text not null,
  subject text,
  body text,
  body_raw text,
  direction text not null check (direction in ('in','out')),
  created_at timestamptz not null default now()
);

-- 6. Events / Activities (Timeline history: email sends, linkedin interactions, notes)
create table if not exists public.events (
  id bigserial primary key,
  contact_id text not null references public.contacts(id) on delete cascade,
  channel text check (channel in ('email','linkedin','meeting','call','note')),
  kind text,
  date text,
  summary text,
  source_file text,
  created_at timestamptz not null default now()
);

-- 7. Calendar Meetings (Salesforce Events)
create table if not exists public.meetings (
  id text primary key,
  title text not null,
  start_at text not null,
  end_at text not null,
  external_attendees text[],
  contact_ids text[],
  url text,
  meet_link text,
  calendar text,
  description text,
  created_at timestamptz not null default now()
);

-- 8. Queue Items (Tasks / To-Dos / Follow-ups)
create table if not exists public.queue_items (
  id text primary key,
  contact_id text not null references public.contacts(id) on delete cascade,
  deal_id text references public.deals(id) on delete set null,
  type text check (type in ('ask','commitment_by_me','commitment_by_them','record_fact','followup','call','meeting')),
  summary text,
  quote text,
  source text,
  source_link text,
  source_timestamp text,
  owner text,
  due_date date,
  status text not null check (status in ('Open','Drafted','Waiting','Blocked','Closed','Unknown')),
  closure_action text,
  draft_id text,
  last_checked_at text,
  sources jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 9. Edits (Salesforce Audit History Tracking)
create table if not exists public.edits (
  id bigserial primary key,
  entity text not null check (entity in ('deal','contact','queue_item','message','notification','account')),
  entity_id text not null,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

-- 10. Notifications
create table if not exists public.notifications (
  id text primary key,
  kind text not null,
  title text not null,
  body text,
  contact_id text references public.contacts(id) on delete cascade,
  ref text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- 11. Sync State
create table if not exists public.sync_state (
  key text primary key,
  last_synced_at text,
  info jsonb,
  updated_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_contacts_account on public.contacts(account_id);
create index if not exists idx_deals_contact on public.deals(contact_id);
create index if not exists idx_messages_contact on public.messages(contact_id);
create index if not exists idx_thread_messages_contact on public.thread_messages using gin (contact_ids);
create index if not exists idx_events_contact on public.events(contact_id);
create index if not exists idx_queue_contact on public.queue_items(contact_id);
create index if not exists idx_edits_entity on public.edits(entity, entity_id);
