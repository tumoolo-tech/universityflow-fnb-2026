/**
 * Migration 0018: offers (Phase 5a). The places a learner has been offered, from an acceptance
 * letter they checked field by field or from their own word ("I got in"). Append-only.
 */
export const sql = String.raw`-- The conditions as the learner confirmed them, quoted from the letter: at most 20, each one line
-- of at most 500 characters. Never interpreted by anything (planning.md §11, 5a).
create function uf_offer_conditions_ok(conditions text[]) returns boolean
  language sql immutable set search_path = public as $$
  select coalesce(array_ndims(conditions), 1) = 1
    and coalesce(cardinality(conditions), 0) <= 20
    and not exists (
      select 1 from unnest(conditions) as c (text)
      where c.text is null
        or length(c.text) not between 1 and 500
        or c.text ~ '[[:cntrl:]]'
    )
$$;

-- One offer per programme per learner. Catalogue ids only for the university and programme
-- (hard rule 4); whether the programme is still in the catalogue the learner may see is decided
-- when it is read. The letter's student number, ID number and address are never stored (D4).
create table offers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  university_id text not null check (university_id ~ '^[a-z]{2,10}$'),
  programme_id text not null
    check (length(programme_id) between 3 and 80 and programme_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null check (kind in ('provisional', 'conditional', 'final', 'waitlist')),
  -- Where it came from: a letter the learner checked, or the learner's own word.
  source text not null check (source in ('letter', 'learner')),
  -- The letter it was read from. The offer outlives the letter's deletion.
  document_id uuid references documents (id) on delete set null,
  status text not null default 'held' check (status in ('held', 'accepted', 'declined')),
  reply_by date,
  conditions text[] not null default '{}' check (uf_offer_conditions_ok(conditions)),
  -- The reply-by reminder waiting for it, if any (the 4a pipeline). It goes with the offer.
  reminder_id uuid references reminders (id) on delete set null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  check (source = 'letter' or document_id is null),
  check ((status = 'accepted') = (accepted_at is not null)),
  check ((status = 'declined') = (declined_at is not null)),
  unique (student_id, programme_id)
);
create index offers_student_created on offers (student_id, created_at);

-- At most one accepted offer per learner, whatever the code above it does.
create unique index offers_one_accepted on offers (student_id) where status = 'accepted';

-- The letter and the reminder must be the learner's own. Foreign keys are checked without
-- row-level security, so this says it explicitly.
create function uf_offers_own_rows() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.document_id is not null and not exists (
    select 1 from documents where id = new.document_id and student_id = new.student_id
  ) then
    raise exception 'An offer''s letter is one of the learner''s own documents';
  end if;
  if new.reminder_id is not null and not exists (
    select 1 from reminders where id = new.reminder_id and student_id = new.student_id
  ) then
    raise exception 'An offer''s reminder is one of the learner''s own reminders';
  end if;
  return new;
end
$$;
create trigger offers_own_rows before insert or update on offers
  for each row execute function uf_offers_own_rows();

alter table offers enable row level security;
create policy offers_consented_self on offers
  using (student_id = uf_current_student() and uf_may_process(student_id))
  with check (student_id = uf_current_student() and uf_may_process(student_id));
grant select, insert, update, delete on offers to uf_app;
grant execute on function uf_offer_conditions_ok(text[]) to uf_app;
`;
