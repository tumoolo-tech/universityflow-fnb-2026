/**
 * Migration 0012: a reminder the provider may have taken but never confirmed (A12-06). A timeout
 * after the request went out leaves us not knowing whether the learner got the message, so it is
 * recorded as "unconfirmed" and never sent again. Like "sending" and "sent", it carries sent_at:
 * it may well have reached the phone, so it counts towards the learner's cap. Append-only.
 */
export const sql = `alter table reminders drop constraint reminders_status_check;
alter table reminders add constraint reminders_status_check
  check (status in ('scheduled', 'sending', 'sent', 'unconfirmed', 'dropped', 'failed'));

alter table reminders drop constraint reminders_check;
alter table reminders add constraint reminders_sent_at_check
  check ((status in ('sending', 'sent', 'unconfirmed')) = (sent_at is not null));
`;
