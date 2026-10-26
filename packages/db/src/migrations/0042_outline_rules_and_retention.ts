/**
 * Migration 0042: module outlines held to the module card's own rule, kept for the academic year
 * plus one, and their files deleted by a job (Phase 6 audit fixes A1-81, A11-63, A1-88;
 * docs/plans/phase-6-proposal.md D10). Append-only.
 */
export const sql = String.raw`-- A1-81. One rule for a weighting's components, the one packages/admissions resolveScheme
-- applies (packages/catalogue weights.ts, weightingProblems): the weights add up to 100 exactly
-- (within 0.000001, float noise in the app's sums; 0040 rounded to two decimals, so 33.333 x 3
-- passed here and was refused there) and no two components share a name, compared as the app
-- compares them (case and runs of spaces aside). The same function, so 0040's other checks stand.
create or replace function uf_module_outline_ok(o jsonb) returns boolean
  language plpgsql immutable set search_path = public as $$
declare
  k text;
  s jsonb;
  item jsonb;
  total numeric := 0;
  words text;
  names text[] := array[]::text[];
  name_key text;
begin
  if jsonb_typeof(o) is distinct from 'object' or octet_length(o::text) > 65536 then
    return false;
  end if;
  for k in select jsonb_object_keys(o) loop
    if k not in ('moduleName', 'term', 'components', 'dates', 'books', 'people') then
      return false;
    end if;
  end loop;
  if coalesce(jsonb_typeof(o -> 'moduleName'), 'null') not in ('string', 'null') then
    return false;
  end if;
  if coalesce(jsonb_typeof(o -> 'term'), 'null') = 'string' then
    if (o ->> 'term') not in ('S1', 'S2', 'Y', 'Q1', 'Q2', 'Q3', 'Q4') then return false; end if;
  elsif coalesce(jsonb_typeof(o -> 'term'), 'null') <> 'null' then
    return false;
  end if;
  foreach k in array array['components', 'dates', 'books', 'people'] loop
    s := o -> k;
    if jsonb_typeof(s) is distinct from 'object' then return false; end if;
    if (s ->> 'status') = 'not-in-outline' then
      if (select count(*) from jsonb_object_keys(s)) <> 1 then return false; end if;
    elsif (s ->> 'status') = 'confirmed' then
      if jsonb_typeof(s -> 'items') is distinct from 'array'
        or jsonb_array_length(s -> 'items') not between 1 and 40 then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;

  if (o -> 'components' ->> 'status') = 'confirmed' then
    for item in select value from jsonb_array_elements(o -> 'components' -> 'items') loop
      if jsonb_typeof(item -> 'weight') is distinct from 'number'
        or (item ->> 'weight')::numeric <= 0 or (item ->> 'weight')::numeric > 100 then
        return false;
      end if;
      total := total + (item ->> 'weight')::numeric;
      if jsonb_typeof(item -> 'name') is distinct from 'string' then return false; end if;
      name_key := lower(btrim(regexp_replace(item ->> 'name', '\s+', ' ', 'g')));
      if name_key = any(names) then return false; end if;
      names := names || name_key;
    end loop;
    if abs(total - 100) >= 0.000001 then return false; end if;
  end if;

  -- Every word but the books' ISBNs, for the personal-number and mobile-number rules.
  words := (o - 'books')::text;
  if (o -> 'books' ->> 'status') = 'confirmed' then
    for item in select value from jsonb_array_elements(o -> 'books' -> 'items') loop
      if coalesce(jsonb_typeof(item -> 'isbn'), 'null') = 'string' then
        if (item ->> 'isbn') !~ '^(97[89][0-9]{10}|[0-9]{9}[0-9X])$' then return false; end if;
      elsif coalesce(jsonb_typeof(item -> 'isbn'), 'null') <> 'null' then
        return false;
      end if;
      words := words || ' ' || (item - 'isbn')::text;
    end loop;
  end if;
  if uf_holds_personal_number(words) or uf_holds_mobile_number(words) then return false; end if;
  return true;
end
$$;

-- An outline confirmed before this migration under 0040's looser rule is the learner's data: it
-- is kept, never deleted or changed here (the module card says it couldn't be used, A1-81, and the
-- learner confirms it again). So the check is re-made NOT VALID: every insert and every update is
-- held to the rule from now on, rows already written are not re-checked.
alter table module_outlines drop constraint module_outlines_outline_check;
alter table module_outlines add constraint module_outlines_outline_check
  check (uf_module_outline_ok(outline)) not valid;

-- A11-63. D10: a confirmed outline is kept until the learner deletes it, or for the academic year
-- plus one (Stage 8's continuity reads last year's modules), as 0041 keeps marks: from 1 January
-- two years on the owner's sweep deletes it. Generated, so every row written before this one has
-- its date too.
alter table module_outlines
  add column keep_until date not null generated always as (make_date(academic_year + 2, 1, 1)) stored;

-- The sweep, as 0041's for marks. The owner's only (a learner's role can't run it): it says how
-- many rows went, nothing else. A11-04's schedule runs it (A11-60 for the schedule).
create function uf_delete_expired_module_outlines(today date) returns integer
  language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  delete from module_outlines where keep_until <= today;
  get diagnostics n = row_count;
  return n;
end
$$;
revoke execute on function uf_delete_expired_module_outlines(date) from public;

-- A1-88. The file an outline was read from goes once it is confirmed (D10), but storage is not this
-- database: its delete can fail after the save commits. So the save queues the file's key here, in
-- the same transaction that deletes the document's row, and a job carrying only this row's id
-- deletes the file and then the row (packages/db file-deletions.ts), retried. A key the app made
-- (every file store's rule), nothing else: no learner id, no name. The owner's only: no grant and no
-- policy for the learner's role.
create table file_deletions (
  id uuid primary key default gen_random_uuid(),
  storage_key text not null unique check (storage_key ~ '^[a-z0-9][a-z0-9-]{7,127}$'),
  created_at timestamptz not null default now()
);
alter table file_deletions enable row level security;

-- The learner's role queues the file of one of its own module-outline documents, and nothing
-- else: the document's row goes and its key is queued, and the queue row's id comes back. Asked
-- as the learner, about themselves, while their data may be processed (hard rule 5).
create function uf_queue_outline_file_deletion(did uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  k text;
  qid uuid;
begin
  delete from documents
    where id = did
      and student_id = uf_current_student()
      and uf_may_process(student_id)
      and kind = 'module-outline'
    returning storage_key into k;
  if k is null then
    raise exception 'No such module outline document' using errcode = 'no_data_found';
  end if;
  insert into file_deletions (storage_key) values (k)
    on conflict (storage_key) do update set storage_key = excluded.storage_key
    returning id into qid;
  return qid;
end
$$;
revoke execute on function uf_queue_outline_file_deletion(uuid) from public;
grant execute on function uf_queue_outline_file_deletion(uuid) to uf_app;
`;
