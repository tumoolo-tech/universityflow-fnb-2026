/**
 * Migration 0034: the judge demo's real sign-up, a HACKATHON EXCEPTION the owner approved on
 * 2026-10-23 (docs/deploy/demo.md "Hackathon exceptions"). Numbered after 0033 (the CV core,
 * built beside it, became 0035 at merge). Append-only. Undone
 * after the hackathon by a later migration that drops the table.
 */
export const sql = `-- On a demo deployment only (UF_DEPLOYMENT=demo, UF_DEMO_SIGNUP=firebase), an adult judge may
-- sign in with Firebase (email link or Google). The server verifies the ID token itself and keeps
-- only what the account needs: the Firebase uid, to find the account again, and the email. Nothing
-- else from Google. The row goes with the account (on delete cascade), and the demo deletes the
-- account 30 days after it was made. Production never writes here: only a store built for a demo
-- does (Store option demo), and production refuses every demo switch.
create table demo_signups (
  student_id uuid primary key references students (id) on delete cascade,
  firebase_uid text not null unique check (char_length(firebase_uid) between 1 and 128),
  email text not null check (char_length(email) between 3 and 320 and email like '%_@_%'),
  created_at timestamptz not null default now()
);

alter table demo_signups enable row level security;
create policy demo_signups_self on demo_signups
  using (student_id = uf_current_student()) with check (student_id = uf_current_student());
grant select, delete on demo_signups to uf_app;
`;
