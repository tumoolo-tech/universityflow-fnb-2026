import {
  copyJobPayload,
  InvalidJobError,
  type JobKind,
  type JobPayload,
  type JobPayloadOf,
  validateIdempotencyKey,
  validateJobPayload,
} from './payload';

/**
 * Scheduling work for later, behind an interface (decision D8): Phase 4's reminders and matric
 * support. The hosted scheduler (Trigger.dev, spike 5) is connected by the owner at the end;
 * until then `MemoryJobScheduler` (here) and `PostgresJobScheduler` (packages/db) stand in, and
 * every implementation passes `jobSchedulerContract`.
 *
 * The guarantees:
 * - A job runs **at or after** its time, never before.
 * - A job's handler **completes at most once**. A handler that throws is retried (with backoff,
 *   up to `maxAttempts`), and a runner that dies mid-job loses its lease, so the job runs again:
 *   delivery is at-least-once until a run succeeds. Handlers re-check the state they act on (a
 *   reminder the learner already completed is skipped), which also makes a late cancel safe.
 * - A job cancelled before it starts never runs.
 * - Scheduling twice with one idempotency key makes one job.
 * - Payloads hold IDs only (payload.ts).
 */

export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface ScheduleOptions<K extends JobKind> {
  readonly kind: K;
  readonly payload: JobPayloadOf<K>;
  /** When to run. Give this or `delayMs`, not both. A time in the past runs on the next pass. */
  readonly runAt?: Date;
  /** How long from now to run. */
  readonly delayMs?: number;
  /** Names one logical job: scheduling the same key again returns the first job. */
  readonly idempotencyKey?: string;
  /** Attempts before the job is given up as failed. Default 3, at most 10. */
  readonly maxAttempts?: number;
}

export interface ScheduledJob {
  readonly id: string;
  readonly runAt: Date;
  /** False when an idempotency key matched a job that already existed. */
  readonly created: boolean;
}

export interface JobView {
  readonly id: string;
  readonly kind: string;
  readonly payload: JobPayload;
  readonly runAt: Date;
  readonly status: JobStatus;
  readonly attempts: number;
}

/** What the app uses: put a job on the schedule, take it off, look at it. */
export interface JobScheduler {
  schedule<K extends JobKind>(options: ScheduleOptions<K>): Promise<ScheduledJob>;
  /**
   * Takes a job off the schedule if it hasn't started. True if this call cancelled it; false
   * for a job already running, finished or cancelled, and for an unknown or malformed id.
   */
  cancel(id: string): Promise<boolean>;
  get(id: string): Promise<JobView | null>;
}

export interface JobContext {
  readonly jobId: string;
  /** 1 on the first run, 2 on the first retry, … */
  readonly attempt: number;
}

export interface JobHandler {
  readonly kind: JobKind;
  run(payload: JobPayload, context: JobContext): Promise<void>;
}

/** Pairs a kind with the code that runs it. The payload arrives checked against the kind. */
export function handle<K extends JobKind>(
  kind: K,
  run: (payload: JobPayloadOf<K>, context: JobContext) => Promise<void>,
): JobHandler {
  return { kind, run: (payload, context) => run(payload as JobPayloadOf<K>, context) };
}

export interface RunReport {
  /** Jobs whose handler succeeded in this pass. */
  readonly completed: string[];
  /** Jobs whose handler threw and that will be tried again later. */
  readonly retrying: string[];
  /** Jobs given up: out of attempts, no handler for their kind, or an invalid payload. */
  readonly failed: string[];
}

/**
 * The stand-ins' runner: claims due jobs one at a time and runs them. Local development and a
 * polling cron call this; a hosted scheduler runs jobs itself and has no runner.
 */
export interface JobRunner {
  runDue(handlers: readonly JobHandler[], options?: RunOptions): Promise<RunReport>;
}

export interface RunOptions {
  /** Jobs to run in this pass at most. Default `DEFAULT_RUN_LIMIT`. */
  readonly limit?: number;
  /**
   * Hears about a handler that threw, for error reporting. The runner itself keeps nothing
   * about the error: its message could quote the data the job touched (hard rule 4).
   */
  readonly onError?: (error: unknown, job: { readonly kind: string } & JobContext) => void;
}

export const DEFAULT_MAX_ATTEMPTS = 3;
export const MAX_ATTEMPTS_LIMIT = 10;
/** How long a runner holds a claimed job before another runner may take it over. */
export const JOB_LEASE_MS = 5 * 60 * 1000;
/** Jobs a single `runDue` pass runs at most, unless told otherwise. */
export const DEFAULT_RUN_LIMIT = 50;

/** Wait before retry n (1-based): 1, 2, 4 … minutes, at most an hour. */
export function retryDelayMs(attempt: number): number {
  return Math.min(60 * 60 * 1000, 60 * 1000 * 2 ** Math.max(0, attempt - 1));
}

export interface CheckedSchedule {
  readonly kind: string;
  readonly payload: JobPayload;
  readonly runAt: Date;
  readonly idempotencyKey: string | null;
  readonly maxAttempts: number;
}

/** Validates a schedule request the same way in every implementation. */
export function checkSchedule<K extends JobKind>(
  options: ScheduleOptions<K>,
  now: Date,
): CheckedSchedule {
  const { kind, runAt, delayMs, idempotencyKey } = options;
  const payload = copyJobPayload(kind, options.payload);
  if ((runAt === undefined) === (delayMs === undefined)) {
    throw new InvalidJobError('Schedule a job with runAt or delayMs, not both');
  }
  let at: Date;
  if (runAt !== undefined) {
    if (!(runAt instanceof Date) || Number.isNaN(runAt.getTime())) {
      throw new InvalidJobError('runAt must be a valid date');
    }
    at = new Date(runAt.getTime());
  } else {
    if (!Number.isFinite(delayMs) || (delayMs as number) < 0) {
      throw new InvalidJobError('delayMs must be a number of milliseconds, 0 or more');
    }
    at = new Date(now.getTime() + (delayMs as number));
  }
  if (idempotencyKey !== undefined) validateIdempotencyKey(idempotencyKey);
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS_LIMIT) {
    throw new InvalidJobError(`maxAttempts must be a whole number from 1 to ${MAX_ATTEMPTS_LIMIT}`);
  }
  return {
    kind: kind.name,
    payload,
    runAt: at,
    idempotencyKey: idempotencyKey ?? null,
    maxAttempts,
  };
}

/** Scheduling an idempotency key again with a different kind or payload is a bug, not a repeat. */
export class JobConflictError extends InvalidJobError {
  override readonly name = 'JobConflictError';
}

export type RunOutcome = 'done' | 'retry' | 'failed';

/**
 * Runs one claimed job through its handler and says what became of it. Shared by the stand-ins,
 * so they treat failure alike. The payload is checked again: it came back from storage.
 */
export async function runClaimedJob(
  job: { readonly id: string; readonly kind: string; readonly payload: unknown },
  attempt: number,
  maxAttempts: number,
  handlers: readonly JobHandler[],
  onError?: RunOptions['onError'],
): Promise<RunOutcome> {
  const handler = handlers.find((h) => h.kind.name === job.kind);
  if (!handler) return 'failed';
  try {
    validateJobPayload(handler.kind, job.payload);
  } catch {
    return 'failed';
  }
  try {
    await handler.run(job.payload as JobPayload, { jobId: job.id, attempt });
    return 'done';
  } catch (error) {
    try {
      onError?.(error, { kind: job.kind, jobId: job.id, attempt });
    } catch {
      // A broken error reporter must not change what happens to the job.
    }
    return attempt < maxAttempts ? 'retry' : 'failed';
  }
}

/** The pass size, checked. */
export function runLimit(options: RunOptions | undefined): number {
  const limit = options?.limit ?? DEFAULT_RUN_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new InvalidJobError('limit must be a whole number above 0');
  }
  return limit;
}

/** Collects outcomes into a report. */
export function reportOf(outcomes: ReadonlyArray<readonly [string, RunOutcome]>): RunReport {
  const pick = (o: RunOutcome) => outcomes.filter(([, x]) => x === o).map(([id]) => id);
  return { completed: pick('done'), retrying: pick('retry'), failed: pick('failed') };
}
