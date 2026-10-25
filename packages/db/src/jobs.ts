import {
  checkSchedule,
  isEntityId,
  JOB_LEASE_MS,
  JobConflictError,
  type JobHandler,
  type JobKind,
  type JobPayload,
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
  samePayload,
} from '@universityflow/jobs';
import { type SQL, sql } from 'drizzle-orm';
import { type Database, rowsOf } from './client';

/**
 * The job scheduler local development runs (open finding A1-08): jobs in a Postgres table, so
 * they survive a restart, and runners that claim each due job with one atomic statement
 * (`for update skip locked`), so racing runners never take the same job. It passes the same
 * contract as the in-memory stand-in and, when the owner connects it, the hosted scheduler
 * (`@universityflow/jobs/contract`).
 *
 * Every time comes from `clock`, never from the database's `now()`, so tests move time instead
 * of sleeping. Every statement runs on its own (no transaction is held while a handler runs).
 */

interface JobRow {
  id: string;
  kind: string;
  payload: JobPayload;
  run_at: Date | string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
}

const iso = (date: Date) => date.toISOString();

export class PostgresJobScheduler implements JobScheduler, JobRunner {
  readonly #database: Database;
  readonly #clock: () => Date;

  constructor(database: Database, options: { readonly clock?: () => Date } = {}) {
    this.#database = database;
    this.#clock = options.clock ?? (() => new Date());
  }

  async #rows<T>(query: SQL): Promise<T[]> {
    return rowsOf<T>(await this.#database.db.execute(query));
  }

  async schedule<K extends JobKind>(options: ScheduleOptions<K>): Promise<ScheduledJob> {
    const now = this.#clock();
    const job = checkSchedule(options, now);
    const [inserted] = await this.#rows<Pick<JobRow, 'id' | 'run_at'>>(sql`
      insert into jobs (kind, payload, run_at, max_attempts, idempotency_key, created_at)
      values (${job.kind}, ${JSON.stringify(job.payload)}::jsonb, ${iso(job.runAt)}::timestamptz,
        ${job.maxAttempts}, ${job.idempotencyKey}, ${iso(now)}::timestamptz)
      on conflict (idempotency_key) do nothing
      returning id, run_at`);
    if (inserted) return { id: inserted.id, runAt: new Date(inserted.run_at), created: true };

    // The key is taken: the same logical job, or a mistake.
    const [existing] = await this.#rows<JobRow>(sql`
      select id, kind, payload, run_at from jobs where idempotency_key = ${job.idempotencyKey}`);
    if (!existing) throw new Error('A job with that idempotency key vanished');
    if (existing.kind !== job.kind || !samePayload(existing.payload, job.payload)) {
      throw new JobConflictError('That idempotency key belongs to a different job');
    }
    return { id: existing.id, runAt: new Date(existing.run_at), created: false };
  }

  async cancel(id: string): Promise<boolean> {
    if (!isEntityId(id)) return false;
    const rows = await this.#rows<{ id: string }>(sql`
      update jobs set status = 'cancelled', finished_at = ${iso(this.#clock())}::timestamptz
      where id = ${id}::uuid and status = 'pending'
      returning id`);
    return rows.length === 1;
  }

  async get(id: string): Promise<JobView | null> {
    if (!isEntityId(id)) return null;
    const [row] = await this.#rows<JobRow>(sql`
      select id, kind, payload, run_at, status, attempts from jobs where id = ${id}::uuid`);
    if (!row) return null;
    return {
      id: row.id,
      kind: row.kind,
      payload: row.payload,
      runAt: new Date(row.run_at),
      status: row.status,
      attempts: Number(row.attempts),
    };
  }

  async runDue(handlers: readonly JobHandler[], options?: RunOptions): Promise<RunReport> {
    const limit = runLimit(options);
    // A runner that died on a job's last attempt: give the job up rather than run it again.
    await this.#database.db.execute(sql`
      update jobs set status = 'failed', lease_until = null,
        finished_at = ${iso(this.#clock())}::timestamptz
      where status = 'running' and lease_until <= ${iso(this.#clock())}::timestamptz
        and attempts >= max_attempts`);

    const outcomes: Array<[string, RunOutcome]> = [];
    while (outcomes.length < limit) {
      const job = await this.#claim();
      if (!job) break;
      const attempt = Number(job.attempts);
      const outcome = await runClaimedJob(
        job,
        attempt,
        Number(job.max_attempts),
        handlers,
        options?.onError,
      );
      await this.#finish(job.id, attempt, outcome);
      outcomes.push([job.id, outcome]);
    }
    return reportOf(outcomes);
  }

  /**
   * Takes a due job, atomically: a row another runner holds is skipped. The earliest pending job
   * first, then, only when none is due, the earliest whose runner's lease ran out (A4-08). Two
   * statements, not one with `or`: each reads its own partial index in order and stops at the
   * first row (`jobs_due`, `jobs_leased`), where one query over both had to gather and sort every
   * due job for each claim, so draining a backlog was quadratic.
   */
  async #claim(): Promise<JobRow | null> {
    const now = this.#clock();
    const take = async (candidate: SQL) => {
      const [row] = await this.#rows<JobRow>(sql`
        update jobs
        set status = 'running', attempts = attempts + 1,
          lease_until = ${iso(new Date(now.getTime() + JOB_LEASE_MS))}::timestamptz
        where id = (${candidate})
        returning id, kind, payload, run_at, status, attempts, max_attempts`);
      return row ?? null;
    };
    return (
      (await take(sql`
        select id from jobs
        where status = 'pending' and run_at <= ${iso(now)}::timestamptz
        order by run_at, id
        limit 1
        for update skip locked`)) ??
      (await take(sql`
        select id from jobs
        where status = 'running' and lease_until <= ${iso(now)}::timestamptz
          and attempts < max_attempts
        order by lease_until, id
        limit 1
        for update skip locked`))
    );
  }

  /** Records an outcome, unless the lease ran out and another runner has the job now. */
  async #finish(id: string, attempt: number, outcome: RunOutcome): Promise<void> {
    const now = this.#clock();
    if (outcome === 'retry') {
      const next = new Date(now.getTime() + retryDelayMs(attempt));
      await this.#database.db.execute(sql`
        update jobs set status = 'pending', lease_until = null,
          run_at = ${iso(next)}::timestamptz
        where id = ${id}::uuid and status = 'running' and attempts = ${attempt}`);
      return;
    }
    await this.#database.db.execute(sql`
      update jobs set status = ${outcome}, lease_until = null, finished_at = ${iso(now)}::timestamptz
      where id = ${id}::uuid and status = 'running' and attempts = ${attempt}`);
  }
}
