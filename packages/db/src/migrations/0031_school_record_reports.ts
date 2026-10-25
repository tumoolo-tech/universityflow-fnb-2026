/**
 * Migration 0031: the school record's June and September reports (planning.md §18.7 C2; the
 * owner's decision 2026-10-21, §18.8 G10-2): `grade-10-june`, `grade-11-june` and
 * `grade-11-september`, beside 0024's kinds. The kinds follow `REPORT_KINDS` in
 * packages/catalogue, which a test holds this list to. Append-only.
 */
export const sql = `-- A learner confirms their June Grade 10 report and their June and September Grade 11 reports,
-- for their school record. No university admits on them: packages/admissions shows their marks as
-- "on track", and "the latest report" takes them only after every admission report (A1-34).
-- Every row the old constraint accepted, this one still accepts.
alter table reports drop constraint reports_kind_check;
alter table reports add constraint reports_kind_check check (kind in (
  'grade-10-june', 'grade-10-final',
  'grade-11-june', 'grade-11-september', 'grade-11-final',
  'grade-12-june', 'grade-12-september', 'grade-12-final'
));
`;
