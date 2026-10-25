/**
 * Migration 0026: a learner reports an AI reply for a person to look at (A10-35; Films and
 * Publications Act s24C, the app stores). Append-only.
 */
export const sql = `-- Ids and a reason from a fixed list only (hard rule 4): the report points at the stored reply,
-- and holds no text of its own. One report per reply. Deleted with the account, like the reply.
create table reply_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  message_id uuid not null unique references messages (id) on delete cascade,
  reason text not null check (reason in ('harmful', 'wrong', 'other')),
  created_at timestamptz not null default now()
);
create index reply_reports_student on reply_reports (student_id, created_at);

alter table reply_reports enable row level security;
create policy reply_reports_consented_self on reply_reports
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert on reply_reports to uf_app;
`;
