/**
 * Migration 0025: when the learner gave their grade (planning.md §18.3, G10-1). The grade then
 * moves up a year each school year (`currentGrade`, packages/catalogue) and the learner confirms
 * it each January, which records the date afresh. Append-only.
 */
export const sql = `-- The South African date the grade was given or last confirmed. A grade always has one.
alter table profiles add column grade_given_on date;

-- A grade given before this migration: the profile's last change is the latest it can have been
-- given, so it moves up no sooner than it should. A learner whose grade it moves too little
-- corrects it at the January check.
update profiles
  set grade_given_on = (updated_at at time zone 'Africa/Johannesburg')::date
  where grade is not null;

alter table profiles add constraint profiles_grade_given_on
  check ((grade is null) = (grade_given_on is null));
`;
