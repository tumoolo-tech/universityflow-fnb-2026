/**
 * Migration 0014: one consent rule for pages, routes and jobs (audit A1-13 / A5-07), and
 * withdrawal turns messaging off (audit A11-05). Append-only.
 */
export const sql = String.raw`-- A1-13 / A5-07. The app treats a learner as ready only when their consent covers them now
-- (apps/web/lib/server/session.ts isReady, Store.account needsAdultConsent, planning.md §8.1):
--   * an adult (18 or older in South Africa today) is ready only once they have agreed in their
--     own name, to a recorded version of the wording (consent_status 'not-required' with
--     adult_consent_version set, migration 0009). A guardian's consent ('granted') stops covering
--     them on their 18th birthday, and an adult with no recorded version (one who agreed before
--     the wording named the AI provider) is asked again;
--   * anyone else is ready with a guardian's consent ('granted') or 'not-required'.
-- uf_may_process only checked consent_status, so jobs that run without a request (reminders,
-- the exam timetable) kept reading and messaging learners the app refused. Now the rule lives
-- here, and every policy, job and the channels' last-moment check ask this one function.

-- Today's date in South Africa (UTC+2 all year, as packages/db/src/age.ts counts it). The data
-- layer pins it per transaction from its own clock (uf.today, set beside uf.student_id, so the
-- database and Store.account agree to the millisecond at a birthday); without it, the
-- database's own clock decides.
create function uf_today() returns date language sql stable as $$
  select coalesce(
    nullif(current_setting('uf.today', true), '')::date,
    ((now() at time zone 'UTC') + interval '2 hours')::date
  )
$$;

-- Whole years from a date of birth to a day, counted as packages/db/src/age.ts ageOn does
-- (someone born on 29 February turns a year older on 1 March in a common year).
create function uf_age_on(dob date, on_day date) returns integer
  language sql immutable as $$
  select extract(year from on_day)::integer - extract(year from dob)::integer
    - case when to_char(on_day, 'MMDD') < to_char(dob, 'MMDD') then 1 else 0 end
$$;

-- The rule itself, for any learner on a given day. Read by the owner only: the learner's role
-- asks through uf_may_process, which answers only for the learner it runs as (0002, finding 8).
create function uf_consent_covers(sid uuid, on_day date) returns boolean
  language sql stable set search_path = public as $$
  select exists (
    select 1 from students s
    where s.id = sid
      and case
        when s.date_of_birth is not null and uf_age_on(s.date_of_birth, on_day) >= 18
          then s.consent_status = 'not-required' and s.adult_consent_version is not null
        else s.consent_status in ('not-required', 'granted')
      end
  )
$$;
revoke execute on function uf_consent_covers(uuid, date) from public;

create or replace function uf_may_process(sid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select sid = uf_current_student() and uf_consent_covers(sid, uf_today())
$$;

-- A11-05. Withdrawing consent opts the learner out of every channel, recorded as such: a later
-- consent, even from a different guardian, never resumes messages the learner chose under the
-- old one. The learner opts in again themselves.
alter table messaging_channels drop constraint messaging_channels_opt_out_source_check;
alter table messaging_channels add constraint messaging_channels_opt_out_source_check
  check (opt_out_source in ('app', 'stop', 'consent-withdrawn'));
`;
