/**
 * Migration 0035: My CV, made by Mmereko as UniversityFlow's operator
 * (docs/design/mmereko-api-proposal.md §10.4, approved by the owner 2026-10-23). UniversityFlow
 * keeps the CV of record (D2): the learner's opt-in, their own entries, what they ticked, the CVs
 * made and the recruiter links. 0031 is the school record. Append-only.
 */
export const sql = String.raw`-- The wording that first names Mmereko (D8): guardian consent v4 and the adult agreement adult-v3,
-- owed legal review and not live yet (packages/db CV_CONSENT_VERSION, CV_ADULT_CONSENT_VERSION;
-- the live versions are unchanged). Until one of them is agreed to, nothing about a learner's CV
-- is written, for anyone. The one exception is the owner's preview: the server sets uf.cv to
-- 'preview' for the one transaction when UF_CV=1, a switch the web app refuses in production, on
-- staging and on a demo while the live wording is older (plan maps' precedent, 0030). The age
-- rules below never depend on it.
create function uf_cv_preview() returns boolean
  language sql stable set search_path = public as $$
  select coalesce(current_setting('uf.cv', true), '') = 'preview'
$$;
grant execute on function uf_cv_preview() to uf_app;

-- 18 or older in South Africa today, by the date of birth the learner gave.
create function uf_is_adult(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s
    where s.id = sid and s.date_of_birth is not null and uf_age_on(s.date_of_birth, uf_today()) >= 18
  )
$$;
revoke execute on function uf_is_adult(uuid) from public;

-- Whether the learner's recorded consent names Mmereko: an adult's own agreement at adult-v3 or
-- later; for anyone younger, the latest granted and not withdrawn guardian consent at v4 or later
-- (or, for a learner who needs no guardian, their own agreement at adult-v3). A guardian's consent
-- stops covering a learner on their 18th birthday (A1-13), so an adult needs their own.
create function uf_consent_covers_cv(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s
    where s.id = sid
      and case
        when uf_is_adult(sid) then
          s.consent_status = 'not-required'
          and (uf_cv_preview() or coalesce(uf_wording_version(s.adult_consent_version, 'adult-v'), 0) >= 3)
        when s.consent_status = 'not-required' then
          uf_cv_preview() or coalesce(uf_wording_version(s.adult_consent_version, 'adult-v'), 0) >= 3
        when s.consent_status = 'granted' then
          uf_cv_preview() or coalesce((
            select uf_wording_version(g.consent_version, 'v') from guardian_consents g
            where g.student_id = sid and g.granted_at is not null and g.withdrawn_at is null
            order by g.granted_at desc
            limit 1
          ), 0) >= 4
        else false
      end
  )
$$;
revoke execute on function uf_consent_covers_cv(uuid) from public;

-- Text a CV may hold (§3.2): 1 to max characters, no control characters but tab and line breaks,
-- nothing that reads as an HTML tag, no ID or student number (A11-17, 0021).
create function uf_cv_text_ok(t text, max_length integer) returns boolean
  language sql immutable set search_path = public as $$
  select t is null or (
    char_length(t) between 1 and max_length
    and t !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'
    and t !~ '<[A-Za-z!/?]'
    and not uf_holds_personal_number(t)
  )
$$;

-- Module codes (a registration's shape, 0020) and fixed-list ids (subjects): never an ID number.
create function uf_cv_codes_ok(codes text[], max_items integer) returns boolean
  language sql immutable set search_path = public as $$
  select coalesce(array_ndims(codes), 1) = 1
    and coalesce(cardinality(codes), 0) <= max_items
    and not exists (
      select 1 from unnest(codes) as m (code)
      where m.code is null
        or m.code !~ '^[A-Za-z0-9][A-Za-z0-9 ./-]{1,23}$'
        or uf_holds_personal_number(m.code)
    )
$$;

create function uf_cv_ids_ok(ids text[], max_items integer) returns boolean
  language sql immutable set search_path = public as $$
  select coalesce(array_ndims(ids), 1) = 1
    and coalesce(cardinality(ids), 0) <= max_items
    and not exists (select 1 from unnest(ids) as s (id) where s.id is null or s.id !~ '^[a-z0-9-]{1,40}$')
$$;

create function uf_cv_list_ok(items text[], max_items integer, max_length integer) returns boolean
  language sql immutable set search_path = public as $$
  select coalesce(array_ndims(items), 1) = 1
    and coalesce(cardinality(items), 0) <= max_items
    and not exists (
      select 1 from unnest(items) as i (t) where i.t is null or not uf_cv_text_ok(i.t, max_length)
    )
$$;

-- A link (§3.2): https only, at most 500 characters, no user name or password, a named public
-- host (no IP address, no localhost or private name). Printed, never fetched (D10).
create function uf_cv_link_ok(url text) returns boolean
  language sql immutable set search_path = public as $$
  select url is not null
    and char_length(url) <= 500
    and url ~ '^https://[^\s/?#@]+([/?#][^\s]*)?$'
    and lower(substring(url from '^https://([^/?#:]+)')) ~ '\.'
    and lower(substring(url from '^https://([^/?#:]+)')) !~ '^[0-9.]+$'
    and lower(substring(url from '^https://([^/?#:]+)')) !~ '(^localhost$|\.(localhost|local|internal|lan|home|corp|intranet)$)'
$$;

create function uf_cv_evidence_ok(evidence jsonb) returns boolean
  language plpgsql immutable set search_path = public as $$
declare
  e jsonb;
  k text;
begin
  if jsonb_typeof(evidence) is distinct from 'array' then return false; end if;
  if jsonb_array_length(evidence) > 5 then return false; end if;
  for e in select value from jsonb_array_elements(evidence) loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    for k in select jsonb_object_keys(e) loop
      if k not in ('kind', 'url', 'label') then return false; end if;
    end loop;
    if (e ->> 'kind') is null
      or (e ->> 'kind') not in ('repository', 'demo', 'document', 'video', 'other') then
      return false;
    end if;
    if jsonb_typeof(e -> 'url') is distinct from 'string' or not uf_cv_link_ok(e ->> 'url') then
      return false;
    end if;
    if coalesce(jsonb_typeof(e -> 'label'), 'null') not in ('null', 'string')
      or not uf_cv_text_ok(e ->> 'label', 60) then
      return false;
    end if;
  end loop;
  return true;
end
$$;

-- ── The opt-in (§9.1 item 3): separate from the account consent, revocable ─────────────────────
-- learner_ref is the learner's reference for Mmereko only (§4.2): random, never the student id,
-- a phone, an ID or a student number. A learner who withdraws and opts in again gets a new one.
create table cv_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  learner_ref uuid not null unique default gen_random_uuid(),
  opted_in_at timestamptz not null,
  consent_version text not null check (consent_version ~ '^[a-z0-9-]{1,40}$'),
  purposes text[] not null check (
    coalesce(array_ndims(purposes), 1) = 1
    and cardinality(purposes) between 1 and 4
    and purposes <@ array['cv.draft', 'cv.tailor', 'cv.ats', 'cv.share']
  ),
  withdrawn_at timestamptz
);
create index cv_links_student on cv_links (student_id);
create unique index cv_links_one_active on cv_links (student_id) where withdrawn_at is null;

-- Whether the learner has an opt-in that covers a purpose now.
create function uf_cv_opted_in(sid uuid, purpose text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cv_links l
    where l.student_id = sid and l.withdrawn_at is null and purpose = any (l.purposes)
  )
$$;
revoke execute on function uf_cv_opted_in(uuid, text) from public;

-- A recruiter link (§9.3): only an adult, in their own name, under adult-v3 (or the preview's
-- stand-in for it), with an opt-in that names sharing. Never anyone under 18, whatever is set.
create function uf_cv_share_allowed(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select uf_is_adult(sid) and uf_consent_covers_cv(sid) and uf_cv_opted_in(sid, 'cv.share')
$$;
revoke execute on function uf_cv_share_allowed(uuid) from public;

-- The learner's role asks only about itself (as uf_may_process does, 0002 finding 8), so the
-- store can refuse with a reason before the database refuses without one.
create function uf_cv_allowed(sid uuid, purpose text) returns boolean
  language sql stable security definer set search_path = public as $$
  select sid = uf_current_student()
    and uf_consent_covers_cv(sid)
    and (purpose is null or uf_cv_opted_in(sid, purpose))
$$;
revoke execute on function uf_cv_allowed(uuid, text) from public;
grant execute on function uf_cv_allowed(uuid, text) to uf_app;

create function uf_cv_may_share(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select sid = uf_current_student() and uf_cv_share_allowed(sid)
$$;
revoke execute on function uf_cv_may_share(uuid) from public;
grant execute on function uf_cv_may_share(uuid) to uf_app;

create function uf_cv_link_allowed() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- Withdrawing is always allowed.
  if tg_op = 'UPDATE' and new.withdrawn_at is not null and old.withdrawn_at is null
    and new.purposes = old.purposes then
    return new;
  end if;
  if new.withdrawn_at is null and not uf_consent_covers_cv(new.student_id) then
    raise exception 'The learner''s consent does not name Mmereko'
      using errcode = 'insufficient_privilege';
  end if;
  if 'cv.share' = any (new.purposes) and new.withdrawn_at is null
    and not (uf_is_adult(new.student_id)
      and exists (select 1 from students s where s.id = new.student_id and s.consent_status = 'not-required')) then
    raise exception 'Only an adult, in their own name, may share a CV'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger cv_links_allowed before insert or update on cv_links
  for each row execute function uf_cv_link_allowed();

-- ── The learner's own entries (§3.3): projects, skills, work, volunteering, awards ─────────────
create table cv_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind text not null check (
    kind in ('project', 'skill', 'work', 'volunteer', 'award', 'language', 'certificate')
  ),
  title text not null check (uf_cv_text_ok(title, 120)),
  organisation text check (uf_cv_text_ok(organisation, 120)),
  role text check (uf_cv_text_ok(role, 120)),
  start_date text check (start_date ~ '^(19|20)[0-9]{2}(-(0[1-9]|1[0-2]))?$'),
  end_date text check (end_date ~ '^(19|20)[0-9]{2}(-(0[1-9]|1[0-2]))?$'),
  description text check (uf_cv_text_ok(description, 600)),
  highlights text[] not null default '{}' check (uf_cv_list_ok(highlights, 5, 200)),
  keywords text[] not null default '{}' check (uf_cv_list_ok(keywords, 15, 40)),
  evidence jsonb not null default '[]' check (uf_cv_evidence_ok(evidence)),
  linked_modules text[] not null default '{}' check (uf_cv_codes_ok(linked_modules, 10)),
  -- The learner's order across all their entries (at most 40 of each of 7 kinds).
  position smallint not null default 0 check (position between 0 and 279),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cv_entries_student on cv_entries (student_id, kind, position);

-- ── What goes on the CV (§10.4): ticks, and the contact details the learner typed (D9) ────────
create table cv_selections (
  student_id uuid primary key references students (id) on delete cascade,
  surname text check (uf_cv_text_ok(surname, 80)),
  label text check (uf_cv_text_ok(label, 120)),
  summary text check (uf_cv_text_ok(summary, 600)),
  email text check (
    email is null or (char_length(email) <= 120 and email ~ '^[^\s@<>()]+@[^\s@<>()]+\.[A-Za-z]{2,}$')
  ),
  -- Typed on the CV page, never the sign-in phone: 9 to 12 digits, never an ID-number shape.
  phone text check (
    phone is null or (
      phone ~ '^\+?[0-9 ()-]{9,20}$'
      and char_length(regexp_replace(phone, '[^0-9]', '', 'g')) between 9 and 12
      and not uf_holds_personal_number(phone)
    )
  ),
  city text check (uf_cv_text_ok(city, 80)),
  region text check (uf_cv_text_ok(region, 80)),
  include_school boolean not null default false,
  -- Marks are off unless ticked (D11): subject ids, never marks.
  subject_ids text[] not null default '{}' check (uf_cv_ids_ok(subject_ids, 12)),
  include_offer boolean not null default false,
  module_codes text[] not null default '{}' check (uf_cv_codes_ok(module_codes, 40)),
  entry_ids uuid[] not null default '{}' check (coalesce(cardinality(entry_ids), 0) <= 280),
  updated_at timestamptz not null default now()
);

-- ── The CVs made (§10.4) ───────────────────────────────────────────────────────────────────────
-- The advert's text is kept only until the job ends (D13): a check holds it to that. The CV's
-- text, gaps and ATS numbers are the learner's record (D2); the PDF is in our own files (S3 in
-- af-south-1), by a key the server made.
create table cv_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind text not null check (kind in ('draft', 'tailored')),
  status text not null default 'queued' check (status in ('queued', 'submitted', 'ready', 'failed')),
  engine_job_id text unique check (engine_job_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  problem text check (problem ~ '^[a-z_]{1,40}$'),
  advert_title text check (uf_cv_text_ok(advert_title, 120)),
  advert_company text check (uf_cv_text_ok(advert_company, 120)),
  advert_text text check (advert_text is null or char_length(advert_text) between 1 and 20000),
  markdown text check (markdown is null or char_length(markdown) <= 40000),
  gaps text[] not null default '{}' check (coalesce(cardinality(gaps), 0) <= 20),
  ats_coverage smallint check (ats_coverage between 0 and 100),
  ats_matched text[] not null default '{}' check (coalesce(cardinality(ats_matched), 0) <= 200),
  ats_missing text[] not null default '{}' check (coalesce(cardinality(ats_missing), 0) <= 200),
  ats_missing_must text[] not null default '{}' check (coalesce(cardinality(ats_missing_must), 0) <= 200),
  file_key text check (file_key ~ '^cv-[0-9a-f]{32}$'),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes integer check (bytes between 1 and 10485760),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint cv_documents_advert check (
    (kind = 'tailored') = (advert_title is not null)
    and (advert_text is null or status in ('queued', 'submitted'))
  ),
  constraint cv_documents_ready check (
    status <> 'ready' or (markdown is not null and file_key is not null and sha256 is not null)
  ),
  constraint cv_documents_confirmed check (confirmed_at is null or status = 'ready')
);
create index cv_documents_student on cv_documents (student_id, created_at);

-- Writing anything about a learner's CV needs consent wording that names Mmereko and an opt-in
-- that covers it (§9.1 item 4), whatever the code above does. A CV made for a job advert needs
-- the tailoring purpose. Closing a CV that couldn't be made (failed, the advert gone) is always
-- allowed, so a job that finds consent gone can still let go of the advert. Deleting is always
-- allowed.
create function uf_cv_write_allowed() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  purpose text := 'cv.draft';
begin
  if tg_table_name = 'cv_documents' then
    if tg_op = 'UPDATE' and new.status = 'failed' and new.advert_text is null then
      return new;
    end if;
    if new.kind = 'tailored' then purpose := 'cv.tailor'; end if;
  end if;
  if not (uf_consent_covers_cv(new.student_id) and uf_cv_opted_in(new.student_id, purpose)) then
    raise exception 'The learner''s consent does not cover this CV'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger cv_entries_allowed before insert or update on cv_entries
  for each row execute function uf_cv_write_allowed();
create trigger cv_selections_allowed before insert or update on cv_selections
  for each row execute function uf_cv_write_allowed();
create trigger cv_documents_allowed before insert or update on cv_documents
  for each row execute function uf_cv_write_allowed();

-- At most 40 entries of a kind (§2's per-section cap), counted as the learner (their own rows).
create function uf_cv_entry_limit() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (select count(*) from cv_entries where student_id = new.student_id and kind = new.kind) >= 40 then
    raise exception 'A CV keeps at most 40 entries of a kind' using errcode = 'check_violation';
  end if;
  return new;
end
$$;
create trigger cv_entries_limit before insert on cv_entries
  for each row execute function uf_cv_entry_limit();

-- ── Recruiter links (§9.3): 18+ only, in the database ──────────────────────────────────────────
-- A random token, kept as a hash; one CV version; 7 to 90 days; revocable; views counted.
create table cv_shares (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  document_id uuid not null references cv_documents (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count integer not null default 0 check (view_count >= 0),
  constraint cv_shares_expiry check (
    expires_at >= created_at + interval '7 days' and expires_at <= created_at + interval '90 days'
  )
);
create index cv_shares_student on cv_shares (student_id);
create index cv_shares_document on cv_shares (document_id);

create function uf_cv_share_row_allowed() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- Switching a link off is always allowed.
  if tg_op = 'UPDATE' and new.revoked_at is not null then
    return new;
  end if;
  if not uf_cv_share_allowed(new.student_id) then
    raise exception 'Only an adult, in their own name and under wording that names sharing, may share a CV'
      using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from cv_documents d
    where d.id = new.document_id and d.student_id = new.student_id
      and d.status = 'ready' and d.confirmed_at is not null
  ) then
    raise exception 'Only a CV its learner has checked line by line can be shared'
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;
create trigger cv_shares_allowed before insert or update on cv_shares
  for each row execute function uf_cv_share_row_allowed();

-- ── The record that a deletion reached the operator (§7.3) ─────────────────────────────────────
-- No link to the student: it outlives the account by design, and holds no personal information.
-- The owner's alone (jobs read it); no learner's role can see it.
create table cv_deletions (
  id uuid primary key default gen_random_uuid(),
  learner_ref uuid not null,
  requested_at timestamptz not null,
  scheduled_at timestamptz,
  engine_deletion_id text check (engine_deletion_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  confirmed_at timestamptz
);
create index cv_deletions_open on cv_deletions (requested_at) where confirmed_at is null;
alter table cv_deletions enable row level security;

-- Each learner sees and changes only their own rows, while their data may be processed (hard
-- rule 5); withdrawal and account deletion run as the owner, filtered to the learner.
alter table cv_links enable row level security;
alter table cv_entries enable row level security;
alter table cv_selections enable row level security;
alter table cv_documents enable row level security;
alter table cv_shares enable row level security;
create policy cv_links_consented_self on cv_links
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
create policy cv_entries_consented_self on cv_entries
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
create policy cv_selections_consented_self on cv_selections
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
create policy cv_documents_consented_self on cv_documents
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
create policy cv_shares_consented_self on cv_shares
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, update on cv_links to uf_app;
grant select, insert, update, delete on cv_entries, cv_selections, cv_documents, cv_shares to uf_app;
`;
