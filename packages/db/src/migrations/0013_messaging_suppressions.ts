/**
 * Migration 0013: the messaging suppression list (audit A12-04). Append-only.
 */
export const sql = String.raw`-- A number that replied STOP on a channel, whether or not it has an account (a guardian sent
-- the consent SMS, say). Every SMS and WhatsApp message we start checks this list, the guardian
-- consent SMS included, so a STOP is honoured from any number (planning.md §7.1; WhatsApp's
-- policy; ECTA s45).
--
-- number_hash is an HMAC-SHA256 of the E.164 number under the server secret, the same keying as
-- rate_events (hard rule 4): never the number itself, and no student id. So the list holds no
-- learner's personal data: account deletion leaves it alone (the objection outlives the account,
-- which is the point), and a learner's export has nothing in it to show. A learner's own later
-- opt-in in the app is newer than their STOP and wins (MessagingStore.mayMessage).
create table messaging_suppressions (
  channel text not null check (channel in ('sms', 'whatsapp')),
  number_hash text not null check (number_hash ~ '^[0-9a-f]{64}$'),
  -- The latest STOP from this number on this channel.
  stopped_at timestamptz not null,
  primary key (channel, number_hash)
);

-- Written and read by the owner only (the inbound webhook, the channels' gate, the guardian
-- request): like rate_events and jobs, no grant to uf_app and no policy.
alter table messaging_suppressions enable row level security;
`;
