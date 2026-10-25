/**
 * Migration 0016: at most one waiting `recheck.changed` reminder per learner (audit A1-12).
 * Re-confirming June reports with alternating marks used to add a reminder, and a job, each
 * time. The message says only that there is an update, so one waiting is all a learner needs: a
 * newer re-check replaces it (the store marks the old one dropped as `replaced` and the app
 * cancels its job). This index holds the database to it whatever the code above it does.
 * Append-only.
 */
export const sql = String.raw`-- A learner already holding several keeps the newest; the rest are dropped as replaced, and
-- their jobs, when they are ours, are cancelled. A hosted scheduler's job that still runs finds
-- its reminder no longer waiting and sends nothing.
with ranked as (
  select id, job_id, row_number() over (
    partition by student_id order by created_at desc, id desc
  ) as n
  from reminders
  where template_id = 'recheck.changed' and status = 'scheduled'
), replaced as (
  update reminders r
    set status = 'dropped', outcome_reason = 'replaced', updated_at = now()
    from ranked
    where r.id = ranked.id and ranked.n > 1
    returning r.job_id
)
update jobs set status = 'cancelled', finished_at = now()
  where status = 'pending' and id in (select job_id from replaced where job_id is not null);

create unique index reminders_one_waiting_recheck on reminders (student_id)
  where template_id = 'recheck.changed' and status = 'scheduled';
`;
