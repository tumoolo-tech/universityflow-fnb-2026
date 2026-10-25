/**
 * Migration 0041: the learner's own marks per assessment component, and their target, for one
 * module in one academic year (Phase 6c, docs/plans/phase-6-proposal.md D10, D11). The mark
 * calculator on the module card works from them. Typed (or confirmed) by the learner, never read
 * from a document (hard rule 6), so they need consent only (uf_may_process, hard rule 5), never the
 * module-outline wording. Phase 7 later fills them from marked tests. Append-only.
 */
export const sql = String.raw`-- One mark per component and attempt (a "best 2 of 3" component takes one per attempt). The
-- component is the name the module's scheme gives it, as the learner's device sent it: words of
-- the outline or the published scheme, checked here like an outline's (no ID, student or mobile
-- number). A mark is a percentage from 0 to 100, refused otherwise whatever the code above does;
-- a NaN is refused too (numeric NaN is greater than every number). Kept for the academic year
-- plus one (D10: Stage 8's continuity needs last year's modules), then the owner's sweep deletes
-- it (uf_delete_expired_module_marks below; A11-04's schedule runs it).
create table module_marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  module_code text not null check (module_code ~ '^[A-Z0-9][A-Z0-9 ./-]{1,23}$'),
  academic_year smallint not null check (academic_year between 2020 and 2100),
  component text not null check (
    char_length(component) between 2 and 160
    and component = btrim(regexp_replace(component, '\s+', ' ', 'g'))
    and not uf_holds_personal_number(component)
    and not uf_holds_mobile_number(component)
  ),
  attempt smallint not null check (attempt between 1 and 20),
  percent numeric(5, 2) not null check (percent >= 0 and percent <= 100),
  updated_at timestamptz not null,
  keep_until date not null generated always as (make_date(academic_year + 2, 1, 1)) stored
);
create unique index module_marks_one_per_attempt
  on module_marks (student_id, academic_year, module_code, lower(component), attempt);

-- The learner's own target for the module, one per module and year, the same rules.
create table module_targets (
  student_id uuid not null references students (id) on delete cascade,
  module_code text not null check (module_code ~ '^[A-Z0-9][A-Z0-9 ./-]{1,23}$'),
  academic_year smallint not null check (academic_year between 2020 and 2100),
  percent numeric(5, 2) not null check (percent >= 0 and percent <= 100),
  updated_at timestamptz not null,
  keep_until date not null generated always as (make_date(academic_year + 2, 1, 1)) stored,
  primary key (student_id, academic_year, module_code)
);

-- Each learner sees and changes only their own, while their data may be processed (hard rule 5).
-- Supabase's API roles get nothing: 0038 took back their default grants for every table made
-- after it.
alter table module_marks enable row level security;
create policy module_marks_consented_self on module_marks
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, update, delete on module_marks to uf_app;

alter table module_targets enable row level security;
create policy module_targets_consented_self on module_targets
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, update, delete on module_targets to uf_app;

-- D10: the sweep. Deletes every learner's marks and targets past their keep-until day and says how
-- many rows went. The owner's only (a learner's role can't run it): ids and counts, nothing else.
create function uf_delete_expired_module_marks(today date) returns integer
  language plpgsql security definer set search_path = public as $$
declare
  n integer;
  m integer;
begin
  delete from module_marks where keep_until <= today;
  get diagnostics n = row_count;
  delete from module_targets where keep_until <= today;
  get diagnostics m = row_count;
  return n + m;
end
$$;
revoke execute on function uf_delete_expired_module_marks(date) from public;
`;
