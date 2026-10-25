/**
 * Migration 0006: goals and exams (Phase 4b). The learner's target programme, and their own
 * changes to which subjects they write. Append-only.
 */
export const sql = String.raw`-- The learner's goal (planning.md §3, Stage 3): one target programme from the catalogue, which
-- they may change at any time. A catalogue id only, never free text (hard rule 4); whether the
-- programme still exists and is verified is decided when it is read, by the catalogue.
create table goals (
  student_id uuid primary key references students (id) on delete cascade,
  programme_id text not null
    check (length(programme_id) <= 80 and programme_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  set_at timestamptz not null,
  updated_at timestamptz not null
);

-- Which subjects the learner writes, where their school differs from their report: a subject
-- added (included) or removed (not included). Only their choices are stored, never a copy of
-- the timetable, which stays in the catalogue where it is sourced and verified (hard rule 3).
create table exam_subject_choices (
  student_id uuid not null references students (id) on delete cascade,
  subject text not null check (subject ~ '^[a-z][a-z-]{1,60}$'),
  included boolean not null,
  updated_at timestamptz not null,
  primary key (student_id, subject)
);

do $$
declare t text;
begin
  foreach t in array array['goals', 'exam_subject_choices'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I using (student_id = uf_current_student() and uf_may_process(student_id))'
      ' with check (student_id = uf_current_student() and uf_may_process(student_id))',
      t || '_consented_self', t);
  end loop;
end $$;
grant select, insert, update, delete on goals, exam_subject_choices to uf_app;
`;
