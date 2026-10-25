/**
 * Migration 0020: confirmed registrations (Phase 5c). The modules a learner is registered for, as
 * they confirmed them row by row from their proof of registration or typed them in (hard rule 6),
 * for one programme and academic year. Append-only.
 *
 * There is no column for a student number, ID number, name, address or fees: the proof's are
 * never read, and nothing here could hold them (data minimisation, D4).
 */
export const sql = String.raw`-- The confirmed module rows: 1 to 40 objects with only a code (as printed, the catalogue's module
-- code pattern), and optionally a name (one line, at most 160 characters), a term (S1, S2, Y,
-- Q1-Q4) and credits (0-240). Checked here whatever the code above does.
create function uf_registration_modules_ok(modules jsonb) returns boolean
  language plpgsql immutable set search_path = public as $$
declare
  m jsonb;
  k text;
begin
  if jsonb_typeof(modules) is distinct from 'array' then return false; end if;
  if jsonb_array_length(modules) not between 1 and 40 then return false; end if;
  for m in select value from jsonb_array_elements(modules) loop
    if jsonb_typeof(m) <> 'object' then return false; end if;
    for k in select jsonb_object_keys(m) loop
      if k not in ('code', 'name', 'term', 'credits') then return false; end if;
    end loop;
    if jsonb_typeof(m -> 'code') is distinct from 'string'
      or (m ->> 'code') !~ '^[A-Za-z0-9][A-Za-z0-9 ./-]{1,23}$' then
      return false;
    end if;
    if coalesce(jsonb_typeof(m -> 'name'), 'null') = 'string' then
      if length(m ->> 'name') not between 1 and 160 or (m ->> 'name') ~ '[[:cntrl:]]' then
        return false;
      end if;
    elsif coalesce(jsonb_typeof(m -> 'name'), 'null') <> 'null' then
      return false;
    end if;
    if coalesce(jsonb_typeof(m -> 'term'), 'null') = 'string' then
      if (m ->> 'term') not in ('S1', 'S2', 'Y', 'Q1', 'Q2', 'Q3', 'Q4') then return false; end if;
    elsif coalesce(jsonb_typeof(m -> 'term'), 'null') <> 'null' then
      return false;
    end if;
    if coalesce(jsonb_typeof(m -> 'credits'), 'null') = 'number' then
      if (m ->> 'credits')::numeric not between 0 and 240 then return false; end if;
    elsif coalesce(jsonb_typeof(m -> 'credits'), 'null') <> 'null' then
      return false;
    end if;
  end loop;
  return true;
end
$$;

-- One registration per learner per academic year; confirming again replaces it. Catalogue ids only
-- for the university and programme (hard rule 4); whether the programme is still in the catalogue
-- the learner may see, and whether a curriculum exists for it, is decided when it is read.
create table registrations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  university_id text not null check (university_id ~ '^[a-z]{2,10}$'),
  programme_id text not null
    check (length(programme_id) between 3 and 80 and programme_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  academic_year smallint not null check (academic_year between 2020 and 2100),
  year_of_study smallint check (year_of_study between 1 and 10),
  modules jsonb not null check (uf_registration_modules_ok(modules)),
  -- The proof the rows were read from. The registration outlives the proof's deletion.
  document_id uuid references documents (id) on delete set null,
  -- The change-deadline reminder waiting for it, if any (the 4a pipeline).
  reminder_id uuid references reminders (id) on delete set null,
  confirmed_at timestamptz not null,
  updated_at timestamptz not null,
  check (starts_with(programme_id, university_id || '-')),
  unique (student_id, academic_year)
);

-- The proof and the reminder must be the learner's own. Foreign keys are checked without
-- row-level security, so this says it explicitly.
create function uf_registrations_own_rows() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.document_id is not null and not exists (
    select 1 from documents where id = new.document_id and student_id = new.student_id
  ) then
    raise exception 'A registration''s proof is one of the learner''s own documents';
  end if;
  if new.reminder_id is not null and not exists (
    select 1 from reminders where id = new.reminder_id and student_id = new.student_id
  ) then
    raise exception 'A registration''s reminder is one of the learner''s own reminders';
  end if;
  return new;
end
$$;
create trigger registrations_own_rows before insert or update on registrations
  for each row execute function uf_registrations_own_rows();

alter table registrations enable row level security;
create policy registrations_consented_self on registrations
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, update, delete on registrations to uf_app;
grant execute on function uf_registration_modules_ok(jsonb) to uf_app;
`;
