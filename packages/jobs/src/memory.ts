import { randomUUID } from 'node:crypto';
import { type JobKind, samePayload } from './payload';
import {
  type CheckedSchedule,
  checkSchedule,
  JOB_LEASE_MS,
  JobConflictError,
  type JobHandler,
  type JobRunner,
  type JobScheduler,
  type JobStatus,
  type JobView,
  type RunOptions,
  type RunOutcome,
  type RunReport,
  reportOf,
  retryDelayMs,
  runClaimedJob,
  runLimit,
  type ScheduledJob,
  type ScheduleOptions,
} from './scheduler';

interface MemoryJob extends CheckedSchedule {
  readonly id: string;
  runAt: Date;
  status: JobStatus;
  attempts: number;
  leaseUntil: Date | null;
}

/**
 * The in-memory stand-in: for unit tests and anything that doesn't need jobs to survive a
 * restart. `PostgresJobScheduler` (packages/db) is the one local development runs, and both
 * pass the same contract. Time comes from `clock`, so tests move it instead of sleeping.
 */
export class MemoryJobScheduler implements JobScheduler, JobRunner {
  readonly #jobs = new Map<string, MemoryJob>();
  readonly #byKey = new Map<string, string>();
  readonly #clock: () => Date;

  constructor(options: { readonly clock?: () => Date } = {}) {
    this.#clock = options.clock ?? (() => new Date());
  }

  async schedule<K extends JobKind>(options: ScheduleOptions<K>): Promise<ScheduledJob> {
    const checked = checkSchedule(options, this.#clock());
    if (checked.idempotencyKey !== null) {
      const existing = this.#jobs.get(this.#byKey.get(checked.idempotencyKey) ?? '');
      if (existing) {
        if (existing.kind !== checked.kind || !samePayload(existing.payload, checked.payload)) {
          throw new JobConflictError('That idempotency key belongs to a different job');
        }
        return { id: existing.id, runAt: new Date(existing.runAt), created: false };
      }
    }
    const job: MemoryJob = {
      ...checked,
      id: randomUUID(),
      status: 'pending',
      attempts: 0,
      leaseUntil: null,
    };
    this.#jobs.set(job.id, job);
    if (job.idempotencyKey !== null) this.#byKey.set(job.idempotencyKey, job.id);
    return { id: job.id, runAt: new Date(job.runAt), created: true };
  }

  async cancel(id: string): Promise<boolean> {
    const job = this.#jobs.get(id);
    if (job?.status !== 'pending') return false;
    job.status = 'cancelled';
    return true;
  }

  async get(id: string): Promise<JobView | null> {
    const job = this.#jobs.get(id);
    if (!job) return null;
    return {
      id: job.id,
      kind: job.kind,
      payload: job.payload,
      runAt: new Date(job.runAt),
      status: job.status,
      attempts: job.attempts,
    };
  }

  async runDue(handlers: readonly JobHandler[], options?: RunOptions): Promise<RunReport> {
    const limit = runLimit(options);
    const outcomes: Array<[string, RunOutcome]> = [];
    while (outcomes.length < limit) {
      const job = this.#claim();
      if (!job) break;
      const attempt = job.attempts;
      const outcome = await runClaimedJob(
        job,
        attempt,
        job.maxAttempts,
        handlers,
        options?.onError,
      );
      this.#finish(job, attempt, outcome);
      outcomes.push([job.id, outcome]);
    }
    return reportOf(outcomes);
  }

  /** Takes the earliest due job. Synchronous, so two runners never take the same one. */
  #claim(): MemoryJob | null {
    const now = this.#clock();
    for (;;) {
      let next: MemoryJob | null = null;
      for (const job of this.#jobs.values()) {
        const due =
          (job.status === 'pending' && job.runAt <= now) ||
          (job.status === 'running' && job.leaseUntil !== null && job.leaseUntil <= now);
        if (due && (!next || job.runAt < next.runAt)) next = job;
      }
      if (!next) return null;
      if (next.status === 'running' && next.attempts >= next.maxAttempts) {
        // Its runner died on the last attempt: give it up rather than run it again.
        next.status = 'failed';
        next.leaseUntil = null;
        continue;
      }
      next.status = 'running';
      next.attempts += 1;
      next.leaseUntil = new Date(now.getTime() + JOB_LEASE_MS);
      return next;
    }
  }

  /** Records an outcome, unless the lease ran out and another runner has the job now. */
  #finish(job: MemoryJob, attempt: number, outcome: RunOutcome): void {
    if (job.status !== 'running' || job.attempts !== attempt) return;
    job.leaseUntil = null;
    if (outcome === 'retry') {
      job.status = 'pending';
      job.runAt = new Date(this.#clock().getTime() + retryDelayMs(job.attempts));
    } else {
      job.status = outcome;
    }
  }
}
