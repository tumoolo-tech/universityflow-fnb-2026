/**
 * Migration 0007: re-checks after a new Grade 12 report (Phase 4c). Append-only. (0006 belongs
 * to another Phase 4 branch; ids only need to be unique and run in list order.)
 */
export const sql = `-- A re-check's moves name catalogue programmes and Stage 1's groups, nothing else: no marks,
-- no names, no free text (hard rule 4). The marks stay in report_marks.
create function uf_recheck_moves_ok(moves jsonb) returns boolean
  language sql immutable set search_path = public as $$
  select case
    when jsonb_typeof(moves) is distinct from 'array' then false
    else not exists (
      select 1 from jsonb_array_elements(moves) as m (move)
      where jsonb_typeof(m.move) <> 'object'
        or (select count(*) from jsonb_object_keys(m.move)) <> 4
        or (m.move ->> 'programmeId') is null
        or (m.move ->> 'programmeId') !~ '^[a-z0-9][a-z0-9-]{0,79}$'
        or (m.move ->> 'from') is null
        or (m.move ->> 'from') not in ('qualify-now', 'close', 'plan-b', 'not-yet')
        or (m.move ->> 'to') is null
        or (m.move ->> 'to') not in ('qualify-now', 'close', 'plan-b', 'not-yet')
        or (m.move ->> 'direction') is null
        or (m.move ->> 'direction') not in ('up', 'down')
    )
  end
$$;

-- What changed when a learner confirmed a Grade 12 June or September report: their results on
-- the new report against the previous confirmed one, both scored against the same catalogue.
-- Personal data, so consent-gated like every other table (hard rule 5); deleted with the
-- account, and with either report.
create table rechecks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  report_id uuid not null unique references reports (id) on delete cascade,
  previous_report_id uuid not null references reports (id) on delete cascade,
  moves jsonb not null check (uf_recheck_moves_ok(moves)),
  -- How many programmes were in each group, before and after.
  counts jsonb not null check (jsonb_typeof(counts) = 'object'),
  includes_drafts boolean not null,
  created_at timestamptz not null,
  check (report_id <> previous_report_id)
);
create index rechecks_student_created on rechecks (student_id, created_at desc);

-- Both reports must be the learner's own. Foreign keys are checked without row-level security,
-- so this says it explicitly.
create function uf_rechecks_own_reports() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports
      where id in (new.report_id, new.previous_report_id) and student_id = new.student_id) <> 2 then
    raise exception 'A re-check compares two of the learner''s own reports';
  end if;
  return new;
end
$$;
create trigger rechecks_own_reports before insert or update on rechecks
  for each row execute function uf_rechecks_own_reports();

alter table rechecks enable row level security;
create policy rechecks_consented_self on rechecks
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, delete on rechecks to uf_app;
grant execute on function uf_recheck_moves_ok(jsonb) to uf_app;
`;
