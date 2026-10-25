import {
  defineJobKind,
  entityId,
  handle,
  type JobHandler,
  type JobScheduler,
  type ScheduledJob,
} from '@universityflow/jobs';
import type { Store } from './store';

/**
 * The daily session sweep (audit A11-03): deletes the sessions that can no longer be used, and
 * the push tokens that hang off them (`Store.sweepExpiredSessions`).
 *
 * **How it runs daily.** The job schedulers have no recurring jobs, so the sweep keeps its own
 * chain: each run first puts the next one on the schedule, at 01:00 SAST the next day, under an
 * idempotency key naming that date (`session-sweep:2026-10-15`), then sweeps. Putting the next
 * one first means a sweep that fails still leaves tomorrow's behind. The web app also schedules
 * the next sweep every time a server starts (`scheduleSessionSweep`): the same key makes that
 * one job however many servers start, and it restarts the chain if it was ever lost (a job that
 * ran out of attempts, a hosted scheduler that was swapped). Locally the job runs with the
 * others, from the Postgres queue; live, the hosted scheduler runs it like every other job.
 *
 * **What it carries (hard rule 4).** A job carries IDs only, and this one is about no learner:
 * its one field holds `SESSION_SWEEP_ID`, a fixed id that names the sweep itself.
 */

export const SESSION_SWEEP = defineJobKind('session.sweep', ['sweepId']);
/** The sweep's own id: not a row, not a person. Fixed, so every run carries the same payload. */
export const SESSION_SWEEP_ID = entityId('5e5510a0-0000-4000-8000-000000000001');
/** 23:00 UTC is 01:00 SAST: well inside quiet hours, when hardly anyone is signed in. */
export const SESSION_SWEEP_HOUR_UTC = 23;
export const SESSION_SWEEP_ATTEMPTS = 3;

/** The next sweep strictly after `now`: today at 23:00 UTC, or tomorrow's if that has passed. */
export function nextSessionSweepAt(now: Date): Date {
  const at = new Date(now.getTime());
  at.setUTCHours(SESSION_SWEEP_HOUR_UTC, 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setUTCDate(at.getUTCDate() + 1);
  return at;
}

/** Puts the next sweep after `now` on the schedule; once per day, however often it is called. */
export function scheduleSessionSweep(scheduler: JobScheduler, now: Date): Promise<ScheduledJob> {
  const runAt = nextSessionSweepAt(now);
  return scheduler.schedule({
    kind: SESSION_SWEEP,
    payload: { sweepId: SESSION_SWEEP_ID },
    runAt,
    idempotencyKey: `session-sweep:${runAt.toISOString().slice(0, 10)}`,
    maxAttempts: SESSION_SWEEP_ATTEMPTS,
  });
}

/** The `session.sweep` handler: tomorrow's sweep first, then today's. */
export function sessionSweepHandler(options: {
  readonly store: Pick<Store, 'sweepExpiredSessions'>;
  readonly scheduler: JobScheduler;
  readonly clock?: () => Date;
}): JobHandler {
  const clock = options.clock ?? (() => new Date());
  return handle(SESSION_SWEEP, async () => {
    await scheduleSessionSweep(options.scheduler, clock());
    await options.store.sweepExpiredSessions();
  });
}
