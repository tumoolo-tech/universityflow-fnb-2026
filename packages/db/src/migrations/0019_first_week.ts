/**
 * Migration 0019: the first-week checklist (Phase 5b). Which steps a learner ticked, for which
 * university, and when. A row exists only while the step is ticked: unticking deletes it.
 * Append-only.
 */
export const sql = String.raw`-- Ids only (hard rule 4): the university is a catalogue id and the step one of content's
-- FIRST_WEEK_STEPS (the store refuses any other); nothing the learner typed is kept here.
create table first_week_steps (
  student_id uuid not null references students (id) on delete cascade,
  university_id text not null check (university_id ~ '^[a-z]{2,10}$'),
  step text not null check (length(step) between 2 and 40 and step ~ '^[a-z]+(-[a-z]+)*$'),
  done_at timestamptz not null,
  primary key (student_id, university_id, step)
);

alter table first_week_steps enable row level security;
create policy first_week_steps_consented_self on first_week_steps
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, update, delete on first_week_steps to uf_app;
`;
