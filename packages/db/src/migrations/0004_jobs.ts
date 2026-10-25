/**
 * Migration 0004: scheduled jobs (open finding A1-08), the queue behind `PostgresJobScheduler`,
 * the local stand-in for the hosted scheduler. Append-only.
 */
export const sql = String.raw`-- A job's payload holds IDs only (hard rule 4): a flat object of camelCase "…Id" fields, each a
-- lower-case UUID. The application checks this before it writes; the database checks it again.
create function uf_job_payload_is_ids(payload jsonb) returns boolean
  language sql immutable set search_path = public as $$
  select case
    when jsonb_typeof(payload) is distinct from 'object' then false
    else (select count(*) from jsonb_object_keys(payload)) between 1 and 8
      and not exists (
        select 1 from jsonb_each(payload) as e (key, value)
        where e.key !~ '^[a-z][A-Za-z0-9]*Id$'
          or jsonb_typeof(e.value) <> 'string'
          or (e.value #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
  end
$$;

-- One row per scheduled job. Runners claim a due row by moving it to "running" with a lease
-- (skip locked, so racing runners never take the same row); a runner that dies loses the lease
-- and the row is claimed again. "attempts" is also the claim's fencing token: a late runner
-- can't record over a newer claim. No error text is kept: it could quote personal data.
create table jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind ~ '^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)*$' and length(kind) <= 64),
  payload jsonb not null check (uf_job_payload_is_ids(payload)),
  run_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  idempotency_key text unique check (idempotency_key ~ '^[a-z0-9][a-z0-9:._-]{0,199}$'),
  lease_until timestamptz,
  created_at timestamptz not null,
  finished_at timestamptz,
  check ((status = 'running') = (lease_until is not null))
);
create index jobs_due on jobs (run_at) where status = 'pending';
create index jobs_leased on jobs (lease_until) where status = 'running';

-- Written and read by the owner role (the job runner), never by a learner's request.
alter table jobs enable row level security;
`;
