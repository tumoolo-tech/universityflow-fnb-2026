/**
 * Migration 0036: which provider wrote each AI reply (A10-49, audit S1-A10b), on the stored reply
 * and on a learner's report of it, so a person looking at a report can tell which provider's
 * output it was. Append-only.
 */
export const sql = `-- Who wrote a reply: a provider name and a model id, nothing else (hard rule 4).
--   reply_provider  'anthropic' | 'gemini': the real providers, reply_model the model id that
--                   answered (Anthropic's server-side fallback model when it took over).
--                   'local': the scripted stand-in (no AI at all).
--                   'system': no model wrote anything the learner read. The reviewed crisis reply
--                   (the model is never called in a crisis), or our own kind line when the model
--                   refused or failed before writing a word. reply_model is always null.
--                   When a model wrote words before refusing or failing, it is that model's,
--                   though our kind line follows its words.
--   null on both    not recorded: every reply before this migration, and the learner's own
--                   messages. Never backfilled with a guess.
-- reply_model may be null for a real provider too (an id the server could not vouch for).
-- A model id is a short token (letters, digits, . _ : @ / -), so it can never carry text.
-- Each check is wrapped in coalesce(..., false): a check that comes out null passes in SQL, and a
-- model id with no provider must not.
alter table messages
  add column reply_provider text,
  add column reply_model text;
alter table messages add constraint messages_reply_writer check (coalesce(
  (reply_provider is null and reply_model is null)
  or (
    role = 'assistant'
    and (
      (reply_provider = 'system' and reply_model is null)
      or (
        reply_provider in ('anthropic', 'gemini', 'local')
        and (reply_model is null or reply_model ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,99}$')
      )
    )
  ),
  false));

-- A report carries the reported reply's writer, copied when the learner reports it, so the report
-- says which provider wrote it on its own (the reviewer's alert names it too). Same values.
alter table reply_reports
  add column reply_provider text,
  add column reply_model text;
alter table reply_reports add constraint reply_reports_reply_writer check (coalesce(
  (reply_provider is null and reply_model is null)
  or (reply_provider = 'system' and reply_model is null)
  or (
    reply_provider in ('anthropic', 'gemini', 'local')
    and (reply_model is null or reply_model ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,99}$')
  ),
  false));
`;
