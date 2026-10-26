-- CRaMer CRM Architecture Schema for PostgreSQL
-- Accounts, Contacts/Leads, Deals, Messages, Threads, Events, Meetings, Tasks, Notifications, Sync

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

-- 5. Thread Messages (Full Email Thread History)
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
  id text primary key,
  contact_id text not null references public.contacts(id) on delete cascade,
  channel text not null check (channel in ('email','linkedin','note','calendar')),
  kind text not null,
  date text not null,
  summary text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- 7. Calendar Meetings
create table if not exists public.meetings (
  id text primary key,
  contact_ids text[] not null default '{}',
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','tentative','cancelled')),
  meeting_url text,
  description text,
  location text,
  organizer text,
  attendees jsonb,
  is_follow_up boolean not null default false,
  source text default 'google_calendar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Queue Items (Tasks / Action Items)
create table if not exists public.queue_items (
  id text primary key,
  contact_id text not null references public.contacts(id) on delete cascade,
  kind text not null,
  title text not null,
  summary text,
  status text not null default 'Open' check (status in ('Open','Drafted','Waiting','Blocked','Closed','Unknown')),
  priority text default 'Normal' check (priority in ('Low','Normal','High','Urgent')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. Audit Log / Edits
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
  info jsonb
);

-- Performance Indexes
create index if not exists idx_contacts_account on public.contacts(account_id);
create index if not exists idx_deals_contact on public.deals(contact_id);
create index if not exists idx_messages_contact on public.messages(contact_id);
create index if not exists idx_messages_thread on public.messages(thread_id);
create index if not exists idx_thread_messages_thread on public.thread_messages(thread_id);
create index if not exists idx_events_contact on public.events(contact_id);
create index if not exists idx_queue_contact on public.queue_items(contact_id);
create index if not exists idx_edits_entity on public.edits(entity, entity_id);
