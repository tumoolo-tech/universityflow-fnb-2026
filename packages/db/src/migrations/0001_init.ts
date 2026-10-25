/**
 * Migration 0001 as a module, so every bundler (Next, Vitest, the CLI) ships it without file
 * access. Migrations are append-only: never edit one that has run; add the next number.
 */
export const sql = String.raw`-- UniversityFlow schema, version 1 (Phases 2–3).
--
-- Who can see what is enforced here, in the database, not only in application code
-- (planning.md §8.1):
--   * Row-level security: a query running for one student can't return another student's rows.
--   * Consent: nothing about a minor is readable or writable until a guardian has consented
--     (hard rule 5). "uf_may_process" is checked by every personal-data policy.
--   * The audit log is append-only: no role can update or delete a row.
--
-- The application connects as the table owner and drops to "uf_app" (SET LOCAL ROLE) for every
-- request made on a student's behalf; only sign-in and the guardian's consent link run as the
-- owner, because the student isn't known yet.

do $$ begin
  if not exists (select from pg_roles where rolname = 'uf_app') then
    create role uf_app nologin;
  end if;
end $$;

-- ── Identity ────────────────────────────────────────────────────────────────────────────────

create table students (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^\+27[0-9]{9}$'),
  date_of_birth date,
  -- unknown: not asked yet · not-required: 18 or older · pending: waiting for a guardian ·
  -- granted: guardian consented · withdrawn: guardian withdrew consent.
  consent_status text not null default 'unknown'
    check (consent_status in ('unknown', 'not-required', 'pending', 'granted', 'withdrawn')),
  created_at timestamptz not null default now()
);

create table guardian_consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  guardian_name text not null check (length(trim(guardian_name)) >= 2),
  guardian_phone text not null check (guardian_phone ~ '^\+27[0-9]{9}$'),
  relationship text not null check (relationship in ('parent', 'legal-guardian', 'other-caregiver')),
  token_hash text not null unique,
  consent_version text not null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  granted_at timestamptz,
  withdrawn_at timestamptz
);
create index guardian_consents_student on guardian_consents (student_id);

create table otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index otp_challenges_phone on otp_challenges (phone, created_at desc);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);

-- ── Personal data (consent-gated) ───────────────────────────────────────────────────────────

create table profiles (
  student_id uuid primary key references students (id) on delete cascade,
  display_name text,
  grade integer check (grade between 9 and 12),
  school_name text,
  province text,
  goal text,
  updated_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind text not null,
  storage_key text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  -- uploaded → extracted (values read, waiting for the student) → confirmed; or failed.
  status text not null default 'uploaded'
    check (status in ('uploaded', 'extracted', 'confirmed', 'failed')),
  extraction jsonb,
  created_at timestamptz not null default now()
);
create index documents_student on documents (student_id, created_at desc);

create table reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind text not null
    check (kind in ('grade-11-final', 'grade-12-june', 'grade-12-september', 'grade-12-final')),
  document_id uuid references documents (id) on delete set null,
  -- Hard rule 6: a report only exists once the student has confirmed its marks.
  confirmed_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index reports_student on reports (student_id, confirmed_at desc);

create table report_marks (
  report_id uuid not null references reports (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  subject text not null,
  percent integer not null check (percent between 0 and 100),
  primary key (report_id, subject)
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  role text not null check (role in ('student', 'assistant')),
  content text not null,
  artifacts jsonb not null default '[]',
  -- Set when the crisis protocol answered this message (planning.md §4.3).
  crisis boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_conversation on messages (conversation_id, created_at);

create table memory_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind text not null check (kind in ('goal', 'preference', 'note')),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table shortlist (
  student_id uuid not null references students (id) on delete cascade,
  programme_id text not null,
  rank integer not null check (rank > 0),
  added_at timestamptz not null default now(),
  primary key (student_id, programme_id)
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  university_id text not null,
  status text not null default 'planning'
    check (status in ('planning', 'in-progress', 'submitted', 'provisional-offer', 'offer',
                      'waitlisted', 'unsuccessful', 'declined')),
  reference text,
  submitted_on date,
  updated_at timestamptz not null default now(),
  unique (student_id, university_id)
);

create table checklist_items (
  student_id uuid not null references students (id) on delete cascade,
  -- e.g. 'application:uj' or 'funding:nsfas'
  scope text not null,
  item text not null,
  done_at timestamptz,
  primary key (student_id, scope, item)
);

-- ── Audit (append-only) ─────────────────────────────────────────────────────────────────────

create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('student', 'guardian', 'staff', 'system')),
  actor_id uuid,
  -- No foreign key: the record of what happened outlives a deleted account. IDs only (rule 4).
  student_id uuid,
  action text not null,
  reason text
);

create function uf_audit_is_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function uf_audit_is_append_only();
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function uf_audit_is_append_only();

-- ── Row-level security ──────────────────────────────────────────────────────────────────────

create function uf_current_student() returns uuid language sql stable as $$
  select nullif(current_setting('uf.student_id', true), '')::uuid
$$;

-- True when the student may have their personal data processed: an adult, or a minor whose
-- guardian has consented. Runs as the owner so the policy can read "students".
create function uf_may_process(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students where id = sid and consent_status in ('not-required', 'granted')
  )
$$;

alter table students enable row level security;
create policy students_self on students
  using (id = uf_current_student()) with check (id = uf_current_student());

alter table guardian_consents enable row level security;
create policy guardian_consents_self on guardian_consents
  using (student_id = uf_current_student()) with check (student_id = uf_current_student());

alter table sessions enable row level security;
create policy sessions_self on sessions
  using (student_id = uf_current_student()) with check (student_id = uf_current_student());

do $$
declare t text;
begin
  foreach t in array array['profiles', 'documents', 'reports', 'report_marks', 'conversations',
                           'messages', 'memory_notes', 'shortlist', 'applications',
                           'checklist_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I using (student_id = uf_current_student() and uf_may_process(student_id))'
      ' with check (student_id = uf_current_student() and uf_may_process(student_id))',
      t || '_consented_self', t);
  end loop;
end $$;

alter table audit_log enable row level security;
create policy audit_log_insert on audit_log for insert with check (true);
create policy audit_log_read_own on audit_log for select using (student_id = uf_current_student());

-- ── Grants for the per-request role ─────────────────────────────────────────────────────────

grant usage on schema public to uf_app;
grant select, delete on students to uf_app;
grant select, insert, update on guardian_consents to uf_app;
grant select, delete on sessions to uf_app;
grant select, insert, update, delete on profiles, documents, reports, report_marks, conversations,
  messages, memory_notes, shortlist, applications, checklist_items to uf_app;
grant select, insert on audit_log to uf_app;
grant execute on function uf_current_student(), uf_may_process(uuid) to uf_app;`;
