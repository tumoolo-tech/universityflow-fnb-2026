/**
 * Migration 0039: a learner reports a fitted CV for a person to look at (A10-58;
 * docs/design/mmereko-api-proposal.md §11, "a report button as on AI replies"), as 0026 does for
 * an AI reply. Append-only.
 */
export const sql = `-- Ids and a reason from a fixed list only (hard rule 4): the report points at the stored CV, and
-- copies none of its text or the advert. One report per CV. Deleted with the CV (the learner may
-- delete one, A11-38) and with the account, like the CV.
create table cv_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  document_id uuid not null unique references cv_documents (id) on delete cascade,
  reason text not null check (reason in ('untrue', 'harmful', 'other')),
  created_at timestamptz not null default now()
);
create index cv_reports_student on cv_reports (student_id, created_at);

-- Each learner sees and adds only their own, while their data may be processed (hard rule 5).
-- Supabase's API roles get nothing: 0038 took back their default grants for every table made
-- after it.
alter table cv_reports enable row level security;
create policy cv_reports_consented_self on cv_reports
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert on cv_reports to uf_app;
`;
