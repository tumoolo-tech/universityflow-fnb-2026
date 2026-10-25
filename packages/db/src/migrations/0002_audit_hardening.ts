/**
 * Migration 0002: fixes from the Phase 1–3 audit (2026-10-13). Append-only: 0001 stays as it
 * ran.
 */
export const sql = String.raw`-- Finding 7: on RDS (Postgres 16+) the master user is not a superuser, so it may not
-- SET ROLE uf_app unless it is a member. Superusers (local Docker, PGlite) are unaffected.
do $$ begin
  if not pg_has_role(current_user, 'uf_app', 'member') then
    execute format('grant uf_app to %I', current_user);
  end if;
end $$;

-- Finding 8: uf_app needs only to read its own consent rows; grants and withdrawals are written
-- by the guardian flow, which runs as the owner.
revoke update, insert on guardian_consents from uf_app;

-- Finding 8: a student's session may write audit rows only about that student.
drop policy audit_log_insert on audit_log;
create policy audit_log_insert on audit_log for insert
  with check (student_id = uf_current_student());

-- Finding 8: the consent check answers only for the student the request is running as.
create or replace function uf_may_process(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select sid = uf_current_student() and exists (
    select 1 from students where id = sid and consent_status in ('not-required', 'granted')
  )
$$;

-- Findings 4 and 6: rate limits. The key is an HMAC of a phone number, an IP address or a
-- student id, never the value itself (hard rule 4). Written and read by the owner only.
create table rate_events (
  id bigint generated always as identity primary key,
  action text not null,
  key_hash text not null,
  at timestamptz not null default now()
);
create index rate_events_lookup on rate_events (action, key_hash, at desc);
alter table rate_events enable row level security;
`;
