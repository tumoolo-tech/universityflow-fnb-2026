/**
 * Migration 0024: the final Grade 10 report (planning.md §18.3, G10-2; the owner's decision
 * 2026-10-21, §18.8: `grade-10-final` only). The kinds follow `REPORT_KINDS` in
 * packages/catalogue, which a test holds this list to. Append-only.
 */
export const sql = String.raw`-- A learner from Grade 10 confirms their final Grade 10 report. Its marks are never scored as
-- an application (no university admits on them): packages/admissions shows them as "on track".
alter table reports drop constraint reports_kind_check;
alter table reports add constraint reports_kind_check check (kind in (
  'grade-10-final', 'grade-11-final', 'grade-12-june', 'grade-12-september', 'grade-12-final'
));

-- A re-check from a Grade 10 report names Grade 10's group, on track. Replaces 0007's function
-- with one more standing; every row it accepted before, it still accepts.
create or replace function uf_recheck_moves_ok(moves jsonb) returns boolean
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
        or (m.move ->> 'from') not in ('qualify-now', 'on-track', 'close', 'plan-b', 'not-yet')
        or (m.move ->> 'to') is null
        or (m.move ->> 'to') not in ('qualify-now', 'on-track', 'close', 'plan-b', 'not-yet')
        or (m.move ->> 'direction') is null
        or (m.move ->> 'direction') not in ('up', 'down')
    )
  end
$$;
`;
