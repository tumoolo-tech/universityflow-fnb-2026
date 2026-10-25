/**
 * Migration 0005: messaging (Phase 4a). Per-channel opt-in, the learner's weekly cap, and
 * reminders. Append-only.
 */
export const sql = String.raw`-- Per-channel opt-in (planning.md §7.1), recorded with a time stamp and withdrawable: in the
-- app, or by STOP on the channel itself. Personal data: consent-gated like every other table
-- (hard rule 5), so nothing about a minor is written or read until a guardian has consented.
create table messaging_channels (
  student_id uuid not null references students (id) on delete cascade,
  channel text not null check (channel in ('sms', 'whatsapp', 'push')),
  opted_in boolean not null default false,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  -- How the last opt-out came: the learner in the app, or STOP on the channel.
  opt_out_source text check (opt_out_source in ('app', 'stop')),
  -- When the learner last wrote to us on this channel: opens WhatsApp's 24-hour window.
  last_inbound_at timestamptz,
  updated_at timestamptz not null,
  primary key (student_id, channel),
  check (not opted_in or opted_in_at is not null)
);

-- The learner's own cap: messages we start, in any seven days (planning.md §7.2).
create table messaging_preferences (
  student_id uuid primary key references students (id) on delete cascade,
  max_per_week integer not null default 2 check (max_per_week between 1 and 7),
  updated_at timestamptz not null
);

-- A reminder's references to the catalogue (a university, a subject): short ids, never free
-- text, so nothing personal can ride along (hard rule 4).
create function uf_reminder_params_ok(params jsonb) returns boolean
  language sql immutable set search_path = public as $$
  select case
    when jsonb_typeof(params) is distinct from 'object' then false
    else not exists (
      select 1 from jsonb_each(params) as e (key, value)
      where e.key not in ('universityId', 'subjectId')
        or jsonb_typeof(e.value) <> 'string'
        or (e.value #>> '{}') !~ '^[a-z0-9][a-z0-9-]{0,63}$'
    )
  end
$$;

-- One message we mean to start. Its job carries the reminder's id only; everything else is
-- looked up, and re-checked, when the job runs. "sending" and "sent" carry sent_at, which is what
-- the cadence counts.
create table reminders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  template_id text not null check (template_id ~ '^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$'),
  channel text not null check (channel in ('sms', 'whatsapp', 'push')),
  params jsonb not null default '{}' check (uf_reminder_params_ok(params)),
  desired_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sending', 'sent', 'dropped', 'failed')),
  -- Why it was dropped or failed: a word, never an error message (hard rule 4).
  outcome_reason text check (outcome_reason ~ '^[a-z][a-z-]{1,40}$'),
  job_id uuid,
  reschedules integer not null default 0 check (reschedules >= 0),
  receipt_id text check (length(receipt_id) <= 200),
  delivery_status text check (delivery_status in ('accepted', 'delivered', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check ((status in ('sending', 'sent')) = (sent_at is not null))
);
create index reminders_student_sent on reminders (student_id, sent_at) where sent_at is not null;
create index reminders_student_created on reminders (student_id, created_at desc);
create index reminders_receipt on reminders (receipt_id) where receipt_id is not null;

do $$
declare t text;
begin
  foreach t in array array['messaging_channels', 'messaging_preferences', 'reminders'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I using (student_id = uf_current_student() and uf_may_process(student_id))'
      ' with check (student_id = uf_current_student() and uf_may_process(student_id))',
      t || '_consented_self', t);
  end loop;
end $$;
grant select, insert, update, delete on messaging_channels, messaging_preferences, reminders to uf_app;

-- Account deletion purges the learner's scheduled jobs in the same transaction (POPIA): the
-- jobs table is the owner's, so this index finds a learner's reminder jobs quickly.
create index jobs_reminder on jobs ((payload ->> 'reminderId'));
`;
