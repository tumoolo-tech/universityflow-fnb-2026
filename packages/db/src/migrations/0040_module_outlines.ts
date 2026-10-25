/**
 * Migration 0040: confirmed module outlines (Phase 6b, docs/plans/phase-6-proposal.md D3, D9,
 * D10). The assessment, dates, books and lecturers of one module in one academic year, as the
 * learner confirmed them section by section from their module outline or typed them in (hard
 * rule 6), and the consent gate for the outline itself. Append-only.
 */
export const sql = String.raw`-- D9. A module outline goes whole to the AI provider outside South Africa, with whatever is
-- printed on it (the learner's name or student number, a class list, lecturers' details). The
-- wording that first names it is guardian consent v4 and the adult agreement adult-v3
-- (docs/legal/consent-v4-draft.md, C9), owed legal review and not live yet (packages/db
-- MODULE_OUTLINES_CONSENT_VERSION, MODULE_OUTLINES_ADULT_CONSENT_VERSION). So, whatever the code
-- above does, the database refuses an outline upload, and an outline read from one, unless the
-- learner's recorded consent names it, as 0021 does for letters. An outline the learner types by
-- hand is read from no document and needs only consent (uf_may_process, hard rule 5).
--
-- Whether it does: an adult's own agreement at adult-v3 or later; for anyone younger, the latest
-- granted and not withdrawn guardian consent at v4 or later (or, for a learner who needs no
-- guardian, their own agreement at adult-v3). A guardian's consent stops covering a learner on
-- their 18th birthday (A1-13), so an adult needs their own. Read by the owner only (as 0021's is).
-- There is no preview stand-in: the judge demo's made-up learners record the draft wording
-- themselves (docs/deploy/hackathon-undo-pr.md, I).
create function uf_consent_covers_module_outlines(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s
    where s.id = sid
      and s.consent_status in ('not-required', 'granted')
      and case
        when uf_is_adult(sid) or s.consent_status = 'not-required' then
          s.consent_status = 'not-required'
          and coalesce(uf_wording_version(s.adult_consent_version, 'adult-v'), 0) >= 3
        else
          coalesce((
            select uf_wording_version(g.consent_version, 'v') from guardian_consents g
            where g.student_id = sid and g.granted_at is not null and g.withdrawn_at is null
            order by g.granted_at desc
            limit 1
          ), 0) >= 4
      end
  )
$$;
revoke execute on function uf_consent_covers_module_outlines(uuid) from public;

-- The learner's role asks only about itself (as uf_may_process does, 0002 finding 8), so the
-- store can refuse with a reason before the database refuses without one.
create function uf_may_process_module_outlines(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select sid = uf_current_student() and uf_may_process(sid) and uf_consent_covers_module_outlines(sid)
$$;
revoke execute on function uf_may_process_module_outlines(uuid) from public;
grant execute on function uf_may_process_module_outlines(uuid) to uf_app;

-- An outline upload, or a document turned into one, for every role, the owner's included.
create function uf_documents_consent_covers_outline() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'module-outline' and not uf_consent_covers_module_outlines(new.student_id) then
    raise exception 'The learner''s consent does not cover module outlines'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger documents_consent_covers_outline before insert or update of kind on documents
  for each row execute function uf_documents_consent_covers_outline();

-- D3. A South African mobile number anywhere in the text (its digits perhaps grouped by single
-- spaces or hyphens): a lecturer's personal number is never kept. The same rule as packages/
-- documents holdsMobileNumber, and the prefixes of the no-real-pii guard.
create function uf_holds_mobile_number(t text) returns boolean
  language sql immutable set search_path = public as $$
  select t ~ '(^|[^0-9+])(\+27|27|0)[ -]?(6[0-9]|7[1-9]|8[1-4])([ -]?[0-9]){7}($|[^0-9])'
$$;
grant execute on function uf_holds_mobile_number(text) to uf_app;

-- The confirmed outline, checked here whatever the code above does: an object with the module's
-- name and term and four sections (components, dates, books, people), each confirmed with at
-- least one row or "not-in-outline"; component weights that add up to 100 (hard rule 6: refused,
-- never rescaled); an ISBN of the right shape; and nowhere an ID number, a student number (0021's
-- rule) or a mobile number (D3). A book's ISBN is checked for its shape only: 13 digits are not an
-- ID number there.
create function uf_module_outline_ok(o jsonb) returns boolean
  language plpgsql immutable set search_path = public as $$
declare
  k text;
  s jsonb;
  item jsonb;
  total numeric := 0;
  words text;
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
    end loop;
    if round(total, 2) <> 100 then return false; end if;
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
grant execute on function uf_module_outline_ok(jsonb) to uf_app;

-- One outline per learner, module and academic year; confirming again replaces it. The module
-- code is kept upper-cased (packages/documents confirmedModuleOutlineSchema), in the catalogue's
-- module-code pattern. There is no column for a student number or a class list, and the file the
-- outline was read from is deleted once it is confirmed (D10): only whether it was read from one.
create table module_outlines (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  module_code text not null check (module_code ~ '^[A-Z0-9][A-Z0-9 ./-]{1,23}$'),
  academic_year smallint not null check (academic_year between 2020 and 2100),
  outline jsonb not null check (uf_module_outline_ok(outline)),
  from_document boolean not null,
  confirmed_at timestamptz not null,
  updated_at timestamptz not null,
  unique (student_id, academic_year, module_code)
);

-- An outline read from a document needs the wording that names outlines; one typed by hand does
-- not. Checked on every write that says it was read from one.
create function uf_module_outline_consented() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.from_document and not uf_consent_covers_module_outlines(new.student_id) then
    raise exception 'The learner''s consent does not cover module outlines'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger module_outlines_consented before insert or update on module_outlines
  for each row execute function uf_module_outline_consented();

-- Each learner sees and changes only their own, while their data may be processed (hard rule 5).
-- Supabase's API roles get nothing: 0038 took back their default grants for every table made
-- after it.
alter table module_outlines enable row level security;
create policy module_outlines_consented_self on module_outlines
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, update, delete on module_outlines to uf_app;
`;
