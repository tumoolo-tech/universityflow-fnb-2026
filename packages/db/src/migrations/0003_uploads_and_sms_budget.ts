/**
 * Migration 0003: direct-to-S3 uploads (open finding 3) and the global SMS budget (open
 * finding 1). Append-only.
 */
export const sql = String.raw`-- Direct uploads: the server issues a ticket for one object at a key it chose, then the
-- learner says it's done. This row ties the key to the learner, and is claimed once, so a
-- ticket can't be completed twice or by anyone else. Personal data: consent-gated like
-- "documents" (hard rule 5).
create table upload_intents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  storage_key text not null unique,
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index upload_intents_student on upload_intents (student_id, created_at desc);

alter table upload_intents enable row level security;
create policy upload_intents_consented_self on upload_intents
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, update on upload_intents to uf_app;

-- Global budgets (the SMS budget first): one row per send, counted over rolling windows under
-- an advisory lock, and pruned past the longest window. No key, no number, no body: a budget
-- is global, so the only thing recorded is when (hard rule 4). Written and read by the owner.
create table budget_events (
  id bigint generated always as identity primary key,
  budget text not null,
  at timestamptz not null default now()
);
create index budget_events_lookup on budget_events (budget, at desc);
alter table budget_events enable row level security;
`;
