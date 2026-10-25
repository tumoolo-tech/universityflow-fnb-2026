/**
 * Migration 0008: the app's push tokens (Phase 4d). Append-only.
 */
export const sql = String.raw`-- One Expo push token per phone the learner turned notifications on for. A learner may have
-- several phones; a token belongs to one learner only (the primary key): when someone else signs
-- in on that phone and turns notifications on, the token moves to them.
--
-- The token identifies a device, so it is personal data: consent-gated like every other table
-- (hard rule 5), exported with the learner's data and deleted with the account.
--
-- Each token hangs off the session that registered it, so signing out (which deletes the session)
-- removes the token too, even if the app couldn't say so itself (offline, uninstalled).
create table push_tokens (
  token text primary key check (token ~ '^ExponentPushToken\[[A-Za-z0-9_-]{10,64}\]$'),
  student_id uuid not null references students (id) on delete cascade,
  session_id uuid not null references sessions (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index push_tokens_student on push_tokens (student_id);
create index push_tokens_session on push_tokens (session_id);

-- The session must be the learner's own. Foreign keys are checked without row-level security,
-- so this says it explicitly.
create function uf_push_token_own_session() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from sessions where id = new.session_id and student_id = new.student_id) then
    raise exception 'A push token belongs to one of the learner''s own sessions';
  end if;
  return new;
end
$$;
create trigger push_tokens_own_session before insert or update on push_tokens
  for each row execute function uf_push_token_own_session();

alter table push_tokens enable row level security;
create policy push_tokens_consented_self on push_tokens
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, update, delete on push_tokens to uf_app;
`;
