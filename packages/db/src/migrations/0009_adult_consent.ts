/**
 * Migration 0009: an adult's own consent, with the version of the wording they agreed to
 * (audit A7-04). Append-only.
 */
export const sql = String.raw`-- An adult (18 or older) agrees in their own name to what UniversityFlow does with their
-- information, including that chats and report photos go to the AI provider outside South
-- Africa, before chat or any upload is allowed. Until now an adult went from date of birth
-- straight in, and the only record of an adult's consent was an audit row when a learner whose
-- guardian had consented turned 18.
--
-- Both columns are set together, or neither. A learner who is 18 or older with no version here
-- is asked again, including anyone who agreed before this migration: the wording they saw never
-- mentioned the AI provider.
alter table students
  add column adult_consent_version text,
  add column adult_consented_at timestamptz,
  add constraint students_adult_consent_pair
    check ((adult_consent_version is null) = (adult_consented_at is null)),
  add constraint students_adult_consent_version_ok
    check (adult_consent_version is null or length(trim(adult_consent_version)) between 1 and 40);
`;
