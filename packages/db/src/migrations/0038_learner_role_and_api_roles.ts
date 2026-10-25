/**
 * Migration 0038: the learner role on Postgres 16+, and Supabase's API roles (the judge demo's
 * database, docs/deploy/demo.md). Append-only.
 */
export const sql = String.raw`-- 1. On Postgres 16 and later, a role made by a user that may create roles but isn't a superuser
-- (Supabase's "postgres", RDS's master user) is granted back to it WITH ADMIN but without SET, so
-- 0002's membership check passed and yet every "set local role uf_app" failed. The owner made
-- uf_app, so it holds ADMIN and may give itself SET. A no-op for a superuser and before 16 (where
-- membership is enough). If it can't (uf_app made by someone else), migrate() refuses to start
-- with the one-line fix (UF_LEARNER_ROLE) rather than run a broken app.
do $$ begin
  if current_setting('server_version_num')::int >= 160000
     and not pg_has_role(current_user, 'uf_app', 'SET') then
    begin
      execute format('grant uf_app to %I with set true', current_user);
    exception when insufficient_privilege or invalid_grant_operation then
      null;
    end;
  end if;
end $$;

-- 2. The two tables without row-level security. Only the owner (the app) uses them, and the owner
-- bypasses it (no FORCE), so this changes nothing for the app; any other role that is ever
-- granted them sees no rows. uf_app was never granted either.
alter table otp_challenges enable row level security;
alter table uf_migrations enable row level security;

-- 3. Supabase grants its Data API roles (anon: anyone holding the project's public key) every new
-- table, sequence and function in public. The app never uses the Data API: take all of it back,
-- now and for what later migrations make. Only where those roles exist, so nothing changes on RDS,
-- Docker or the embedded database. Functions keep PUBLIC's default EXECUTE, which uf_app's policies
-- need; with no table grants and the Data API off (docs/deploy/demo.md), there is nothing to call
-- them about.
do $$
declare api_role text;
begin
  foreach api_role in array array['anon', 'authenticated'] loop
    if exists (select from pg_roles where rolname = api_role) then
      execute format('revoke all on all tables in schema public from %I', api_role);
      execute format('revoke all on all sequences in schema public from %I', api_role);
      execute format('revoke all on all functions in schema public from %I', api_role);
      execute format('alter default privileges in schema public revoke all on tables from %I', api_role);
      execute format('alter default privileges in schema public revoke all on sequences from %I', api_role);
      execute format('alter default privileges in schema public revoke all on functions from %I', api_role);
    end if;
  end loop;
end $$;
`;
