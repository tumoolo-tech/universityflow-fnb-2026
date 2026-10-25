/**
 * Migration 0027: UniversityFlow starts at Grade 10 (A1-39; the owner's choice, 2026-10-22). The
 * grades are `SCHOOL_GRADES` (packages/catalogue): 10, 11 and 12. Append-only.
 */
export const sql = `-- A Grade 9 given before (only through the API: no screen offered it) is cleared, with its
-- date, so the app asks the grade again; it never moves up to a grade the learner didn't give.
update profiles set grade = null, grade_given_on = null where grade = 9;

alter table profiles drop constraint profiles_grade_check;
alter table profiles add constraint profiles_grade_check check (grade between 10 and 12);
`;
