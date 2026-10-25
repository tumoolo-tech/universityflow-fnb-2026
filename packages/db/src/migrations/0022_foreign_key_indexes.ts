/**
 * Migration 0022: an index behind every foreign key that sets null on delete (audit A4-11).
 * Append-only.
 */
export const sql = String.raw`-- A4-11. offers.document_id, offers.reminder_id, registrations.document_id and
-- registrations.reminder_id (0018, 0020), and reports.document_id (0001), are all
-- "on delete set null" with no index. Postgres then finds the rows to clear by scanning the whole
-- referencing table, every learner's rows, outside row-level security, once per deleted document
-- or reminder: measured at 16-21 ms per row against 0.4-0.9 ms with an index (200,000 offers).
-- Deleting an account deletes every one of the learner's reminders, each scanning offers and
-- registrations again, inside one transaction.
--
-- Partial: most rows have no document and no reminder, and the referential action only looks
-- for a value (column = $1 is never true of a null), so the index leaves the nulls out.
-- packages/db's foreign-key-indexes test holds every such key to having one.
create index offers_document_id on offers (document_id) where document_id is not null;
create index offers_reminder_id on offers (reminder_id) where reminder_id is not null;
create index registrations_document_id on registrations (document_id)
  where document_id is not null;
create index registrations_reminder_id on registrations (reminder_id)
  where reminder_id is not null;
create index reports_document_id on reports (document_id) where document_id is not null;
`;
