/**
 * Migration 0023: the registration-day reminder (planning.md §11, 5d; audit A1-33). The accepted
 * offer's reminder before first-year registration, tied to the offer as the reply-by reminder is
 * (0018), so it is dropped when that offer is declined or deleted. Append-only.
 */
export const sql = String.raw`-- The registration-day reminder waiting for the accepted offer, if any (the 4a pipeline). The
-- offers table's row-level security and consent gate (0018) cover the new column as they cover
-- the rest of the row.
alter table offers
  add column registration_reminder_id uuid references reminders (id) on delete set null;

-- A4-11's lesson (0022): every foreign key that sets null on delete has an index led by its column.
create index offers_registration_reminder_id on offers (registration_reminder_id)
  where registration_reminder_id is not null;

-- The letter and both reminders must be the learner's own. Foreign keys are checked without
-- row-level security, so this says it explicitly. Replaces 0018's function with one more check.
create or replace function uf_offers_own_rows() returns trigger
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
  if new.registration_reminder_id is not null and not exists (
    select 1 from reminders where id = new.registration_reminder_id and student_id = new.student_id
  ) then
    raise exception 'An offer''s registration reminder is one of the learner''s own reminders';
  end if;
  return new;
end
$$;
`;
