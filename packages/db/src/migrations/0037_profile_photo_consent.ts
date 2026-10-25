/**
 * Migration 0037: the profile photo needs consent wording that names it (audit A11-31), as 0021
 * did for letters. Until now a server switch (`UF_PROFILE_PHOTO`) was the only gate. Append-only.
 */
export const sql = `-- A11-31. A learner's photo of themselves, from Grade 10, kept for their own About me card and
-- used for nothing else (the owner's decision of 2026-10-23). The wording that first names it is
-- guardian consent v4 and the adult agreement adult-v3 (docs/legal/consent-v4-draft.md, C5), owed
-- legal review and not live yet (packages/db PHOTO_CONSENT_VERSION, PHOTO_ADULT_CONSENT_VERSION).
-- So, whatever the code above does, the database keeps a photo only for a learner whose recorded
-- consent names it. The one stand-in is the owner's preview: the server sets uf.profile_photo to
-- 'preview' for the one transaction when UF_PROFILE_PHOTO=1 while the live wording is older (a
-- switch production refuses), and for the judge demo's SAMPLE pictures (no real photo is received
-- there). It stands in for the wording only: consent itself (uf_may_process, hard rule 5) is never
-- skipped. Clearing a photo is always allowed (A11-32).
--
-- A photo already kept (only ever in the owner's preview: production refused the switch) stays
-- where it is, unserved: the store hands out its key only while the consent names it
-- (uf_may_photo), so it is not shown, and it goes when the learner removes it, when a guardian
-- withdraws, or with the account. It is not deleted here: the file is in S3, which SQL cannot
-- reach, and a key cleared here would leave its file behind for ever.
create function uf_photo_preview() returns boolean
  language sql stable set search_path = public as $$
  select coalesce(current_setting('uf.profile_photo', true), '') = 'preview'
$$;
grant execute on function uf_photo_preview() to uf_app;

-- Whether the learner's recorded consent names the photo: an adult's own agreement at adult-v3 or
-- later; for anyone younger, the latest granted and not withdrawn guardian consent at v4 or later
-- (or, for a learner who needs no guardian, their own agreement at adult-v3). A guardian's consent
-- stops covering a learner on their 18th birthday (A1-13), so an adult needs their own. Read by
-- the owner only (as 0021's is).
create function uf_consent_covers_photo(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students s
    where s.id = sid
      and s.consent_status in ('not-required', 'granted')
      and case
        when uf_is_adult(sid) then
          s.consent_status = 'not-required'
          and (uf_photo_preview() or coalesce(uf_wording_version(s.adult_consent_version, 'adult-v'), 0) >= 3)
        when s.consent_status = 'not-required' then
          uf_photo_preview() or coalesce(uf_wording_version(s.adult_consent_version, 'adult-v'), 0) >= 3
        else
          uf_photo_preview() or coalesce((
            select uf_wording_version(g.consent_version, 'v') from guardian_consents g
            where g.student_id = sid and g.granted_at is not null and g.withdrawn_at is null
            order by g.granted_at desc
            limit 1
          ), 0) >= 4
      end
  )
$$;
revoke execute on function uf_consent_covers_photo(uuid) from public;

-- The learner's role asks only about itself (as uf_may_process does, 0002 finding 8), so the
-- store can refuse with a reason before the database refuses without one, and serves a key only
-- while this answers true.
create function uf_may_photo(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select sid = uf_current_student() and uf_may_process(sid) and uf_consent_covers_photo(sid)
$$;
revoke execute on function uf_may_photo(uuid) from public;
grant execute on function uf_may_photo(uuid) to uf_app;

-- Keeping a new photo needs the wording; clearing one (null) never does. Checked for every role,
-- the database owner's included, as 0021's trigger is.
create function uf_profile_photo_consented() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.photo_key is not null
    and (tg_op = 'INSERT' or new.photo_key is distinct from old.photo_key)
    and not uf_consent_covers_photo(new.student_id) then
    raise exception 'The learner''s consent does not name the profile photo'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger profiles_photo_consented before insert or update of photo_key on profiles
  for each row execute function uf_profile_photo_consented();
`;
