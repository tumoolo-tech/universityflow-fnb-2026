/**
 * Migration 0021: offer letters and proofs of registration need consent wording that names them
 * (audit A11-13), and no ID or student number in a quoted condition or a module row (audit
 * A11-17). Append-only.
 */
export const sql = String.raw`-- A11-13. A letter or a proof goes whole to the AI provider outside South Africa, with whatever
-- is printed on it (an ID or student number, a home address, fees). Guardian consent before v3
-- and an adult's agreement before adult-v2 never named them (packages/content consent.version,
-- adultConsent.version). So, whatever the code above does, the database refuses such an upload,
-- and an offer or registration read from one, unless the learner's recorded consent covers it.
-- An offer in the learner's own word, and modules typed by hand, are not read from a document.

-- The number in a wording version: 3 for 'v3-2026-10' with prefix 'v', 2 for 'adult-v2-2026-10'
-- with prefix 'adult-v' (as packages/db consentVersionNumber reads it). Null when there is none.
create function uf_wording_version(version text, prefix text) returns integer
  language sql immutable set search_path = public as $$
  select (regexp_match(btrim(version), '^' || prefix || '([0-9]+)(-|$)'))[1]::integer
$$;

-- Whether a learner's recorded consent covers letters and proofs: an adult's own agreement at
-- adult-v2 or later, or, for a learner whose guardian consented, the latest granted and not
-- withdrawn guardian consent at v3 or later. Read by the owner only; whether the learner may be
-- processed at all is still uf_may_process's question.
create function uf_consent_covers_university_documents(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s
    where s.id = sid
      and case s.consent_status
        when 'not-required' then
          coalesce(uf_wording_version(s.adult_consent_version, 'adult-v'), 0) >= 2
        when 'granted' then
          coalesce((
            select uf_wording_version(g.consent_version, 'v') from guardian_consents g
            where g.student_id = sid and g.granted_at is not null and g.withdrawn_at is null
            order by g.granted_at desc
            limit 1
          ), 0) >= 3
        else false
      end
  )
$$;
revoke execute on function uf_consent_covers_university_documents(uuid) from public;

-- The learner's role asks only about itself (as uf_may_process does, 0002 finding 8), so the
-- store can refuse with a reason before the database refuses without one.
create function uf_may_process_university_documents(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select sid = uf_current_student() and uf_consent_covers_university_documents(sid)
$$;
revoke execute on function uf_may_process_university_documents(uuid) from public;
grant execute on function uf_may_process_university_documents(uuid) to uf_app;

create function uf_documents_consent_covers_kind() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.kind in ('acceptance-letter', 'proof-of-registration')
    and not uf_consent_covers_university_documents(new.student_id) then
    raise exception 'The learner''s consent does not cover offer letters and proofs of registration'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger documents_consent_covers_kind before insert or update of kind on documents
  for each row execute function uf_documents_consent_covers_kind();

-- An offer or a registration read from a letter or proof. Clearing the link (the document was
-- deleted) is always allowed.
create function uf_read_from_document_consented() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.document_id is not null
    and not uf_consent_covers_university_documents(new.student_id) then
    raise exception 'The learner''s consent does not cover offer letters and proofs of registration'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger offers_read_from_document_consented before insert or update of document_id on offers
  for each row execute function uf_read_from_document_consented();
create trigger registrations_read_from_document_consented
  before insert or update of document_id on registrations
  for each row execute function uf_read_from_document_consented();

-- A11-17. Keeping an ID number or a student number out of a quoted condition or a module row
-- rested on the reader's prompt alone. Now the database refuses one too, as packages/db's
-- holdsPersonalNumber does: 13 digits in a row, perhaps grouped by single spaces or hyphens (the
-- shape of an SA ID number), or a run of 7 or more digits shortly after a word that names a
-- number (student, applicant, reference, ID, no, number…). Module codes, marks, dates and phone
-- numbers are none of those.
create function uf_holds_personal_number(t text) returns boolean
  language sql immutable set search_path = public as $$
  select t ~ '[0-9]([ -]?[0-9]){12}'
    or t ~* '\y(student|applicant|application|reference|ref|id|identity|passport|no|nr|number|num)\y[^0-9]{0,12}[0-9]{7,}'
$$;
grant execute on function uf_holds_personal_number(text) to uf_app;

create or replace function uf_offer_conditions_ok(conditions text[]) returns boolean
  language sql immutable set search_path = public as $$
  select coalesce(array_ndims(conditions), 1) = 1
    and coalesce(cardinality(conditions), 0) <= 20
    and not exists (
      select 1 from unnest(conditions) as c (text)
      where c.text is null
        or length(c.text) not between 1 and 500
        or c.text ~ '[[:cntrl:]]'
        or uf_holds_personal_number(c.text)
    )
$$;

create or replace function uf_registration_modules_ok(modules jsonb) returns boolean
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
      or (m ->> 'code') !~ '^[A-Za-z0-9][A-Za-z0-9 ./-]{1,23}$'
      or (m ->> 'code') ~ '[0-9]([ -]?[0-9]){12}' then
      return false;
    end if;
    if coalesce(jsonb_typeof(m -> 'name'), 'null') = 'string' then
      if length(m ->> 'name') not between 1 and 160 or (m ->> 'name') ~ '[[:cntrl:]]'
        or uf_holds_personal_number(m ->> 'name') then
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
`;
