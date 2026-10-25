/**
 * Migration 0010: the store-review account (audit A7-01, docs/store/review-notes.md option A).
 * Append-only.
 */
export const sql = String.raw`-- App Store and Play reviewers sign in to one synthetic account with a fixed PIN, for a
-- number the owner controls, until a date (UF_REVIEW_PHONE, UF_REVIEW_PIN_HASH,
-- UF_REVIEW_UNTIL). The configuration lives in the app; what the account may never do lives
-- here, so no route can forget it.
--
-- students.review: set only by the owner's seed (pnpm --filter @universityflow/db review:seed).
-- A review account is an adult (no guardian flow), and can never become a minor waiting for one.
alter table students
  add column review boolean not null default false,
  add constraint students_review_adult
    check (not review or (consent_status = 'not-required' and date_of_birth is not null));

-- otp_challenges.review: this challenge holds the configured review PIN hash, not a PIN we sent.
-- Sign-in refuses it unless the review configuration still names this number and its date has
-- not passed.
alter table otp_challenges
  add column review boolean not null default false;

-- Runs as the owner so the triggers below can read "students" whatever role is writing.
create function uf_is_review(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select review from students where id = sid), false)
$$;
grant execute on function uf_is_review(uuid) to uf_app;

-- The review account never asks a guardian to consent: that would send a real SMS to a real
-- number on behalf of a synthetic learner.
create function uf_review_no_guardian() returns trigger language plpgsql as $$
begin
  if uf_is_review(new.student_id) then
    raise exception 'the review account never asks a guardian for consent'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger guardian_consents_not_review before insert or update on guardian_consents
  for each row execute function uf_review_no_guardian();

-- The review account is never messaged by SMS or WhatsApp (the number is the owner's SIM; a
-- reviewer can't receive them anyway). Push is allowed: the reviewer may test it. Opting out is
-- always allowed.
create function uf_review_no_sms_whatsapp() returns trigger language plpgsql as $$
begin
  if new.opted_in and new.channel in ('sms', 'whatsapp') and uf_is_review(new.student_id) then
    raise exception 'the review account cannot opt in to %', new.channel
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger messaging_channels_not_review before insert or update on messaging_channels
  for each row execute function uf_review_no_sms_whatsapp();
`;
