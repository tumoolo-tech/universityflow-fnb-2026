/**
 * Migration 0015: push token limits, every push ticket, and the session sweep (audits A5-04,
 * A11-07, A11-03). Append-only.
 */
export const sql = String.raw`-- One push token per session (A5-04): a session is one phone signed in, so a second token on the
-- same session replaces the first (the store does that; this index makes it hold whatever the
-- code above it does). Any session already holding several keeps its most recent.
delete from push_tokens p
  using push_tokens q
  where p.session_id = q.session_id
    and (p.updated_at, p.created_at, p.token) < (q.updated_at, q.created_at, q.token);
drop index push_tokens_session;
create unique index push_tokens_one_per_session on push_tokens (session_id);

-- At most five phones per learner (A5-04): the store evicts the least recently registered when a
-- sixth registers. A learner already above it keeps their five most recent.
delete from push_tokens
  where token in (
    select token from (
      select token, row_number() over (
        partition by student_id order by updated_at desc, created_at desc, token desc
      ) as n
      from push_tokens
    ) ranked
    where n > 5
  );

-- Every ticket a push send was given, one per phone (A11-07), so each phone's receipt is checked
-- and a phone Expo says is gone is forgotten, whichever ticket was first. The first is still
-- receipt_id. Ticket ids are Expo's ids, never personal data.
alter table reminders add column receipt_ids text[];

-- The daily sweep deletes sessions by their end (A11-03).
create index sessions_expires_at on sessions (expires_at);
`;
