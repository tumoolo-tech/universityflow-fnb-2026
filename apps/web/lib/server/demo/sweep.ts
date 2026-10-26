import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DEMO_SWEEP_BATCH, deleteQueuedFile } from '@universityflow/db';
import type { Services } from '../services';
import { deleteFiles } from './core';

/**
 * The judge demo's SCHEDULED sweep (A11-61; docs/deploy/demo.md "The scheduled sweep"). The lazy
 * sweep (core.ts) runs only when someone starts a learner or signs in, so once visits stop nothing
 * is deleted; a Vercel cron (apps/web/vercel.json) calls `GET /api/demo/sweep` and this runs
 * every deletion the demo's words promise, and the retention sweeps nothing else runs on a demo
 * (a demo has no job runner):
 *
 * - copies of the made-up learners made more than a day ago, with their files ("deleted within
 *   24 hours"; the on-screen sign-up's accounts are copies too);
 * - the judges' own sign-up accounts 30 days after they were made ("after 30 days"; exception A);
 * - the files whose storage delete failed in their request (A1-88's `file.delete` queue);
 * - D10's module marks and outlines past their keep-until date (A11-60; none on a demo before
 *   2028, run so the schedule exists), and the expired sessions (A11-03's daily sweep).
 *
 * Every sweep is idempotent (a second run finds nothing) and bounded: at most `SWEEP_MAX_ROUNDS`
 * batches of `DEMO_SWEEP_BATCH` each, inside `SWEEP_TIME_BUDGET_MS`, so a run always ends well
 * inside the function's limit and a backlog is finished by the next runs. Vercel may invoke a cron
 * twice or not at all: both are safe here. Counts only are reported and logged (hard rule 4):
 * never an id, a number or an email.
 */

/** Full batches one run takes from each of the two account sweeps, at most. */
export const SWEEP_MAX_ROUNDS = 10;
/** The wall-clock budget one run keeps to, so it ends well inside the route's `maxDuration`. */
export const SWEEP_TIME_BUDGET_MS = 40_000;

export interface SweepCounts {
  /** Made-up learners' copies (and on-screen sign-up accounts) deleted: older than a day. */
  readonly copies: number;
  /** Judges' own sign-up accounts deleted: older than 30 days. */
  readonly signups: number;
  /** Stored files deleted with those accounts. */
  readonly files: number;
  /** Queued file deletions (A1-88) done. */
  readonly queuedFiles: number;
  /** D10 retention: module marks and targets rows past keep-until. */
  readonly moduleMarks: number;
  /** D10 retention: module outlines past keep-until. */
  readonly moduleOutlines: number;
  /** Expired sessions deleted (their push tokens with them). */
  readonly sessions: number;
  /** Batches taken from the account sweeps. */
  readonly rounds: number;
  /** True when a sweep stopped at its bound with more left: the next run continues. */
  readonly truncated: boolean;
}

/**
 * Whether the request carries the cron's secret: `Authorization: Bearer <CRON_SECRET>`, as Vercel
 * sends it. Compared in constant time over fixed-length digests, so neither the secret's length
 * nor how much of it matched shows in the timing; a missing or oddly shaped header is compared
 * all the same (an empty candidate), never answered early.
 */
export function cronAuthorised(authorization: string | null, secret: string): boolean {
  const given = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  const a = createHash('sha256').update(given.trim()).digest();
  const b = createHash('sha256').update(secret).digest();
  return timingSafeEqual(a, b);
}

/** One sweep's name, for the log line that says which failed (the error's name only). */
type SweepName =
  | 'copies'
  | 'signups'
  | 'queued files'
  | 'module marks'
  | 'module outlines'
  | 'sessions';

export class SweepFailedError extends Error {
  override readonly name = 'SweepFailedError';
  constructor(readonly failed: ReadonlyArray<SweepName>) {
    super('A demo sweep failed');
  }
}

/**
 * Runs every sweep, each bounded, and reports counts. A sweep that fails is logged by its name
 * and the error's name only, the others still run, and the run ends by throwing
 * `SweepFailedError` so the cron's log shows it (Vercel never retries; the next run tries again).
 */
export async function runDemoSweep(
  services: Services,
  options: { readonly now?: () => number } = {},
): Promise<SweepCounts> {
  const now = options.now ?? Date.now;
  const started = now();
  const withinBudget = () => now() - started < SWEEP_TIME_BUDGET_MS;
  const { store } = services;
  const failed: SweepName[] = [];
  const counts = {
    copies: 0,
    signups: 0,
    files: 0,
    queuedFiles: 0,
    moduleMarks: 0,
    moduleOutlines: 0,
    sessions: 0,
    rounds: 0,
    truncated: false,
  };

  /** Batches of one account sweep until a short batch, the round cap or the time budget. */
  const accounts = async (
    name: 'copies' | 'signups',
    sweep: () => Promise<{ readonly students: number; readonly fileKeys: string[] }>,
  ) => {
    try {
      for (let round = 0; round < SWEEP_MAX_ROUNDS; round++) {
        if (!withinBudget()) {
          counts.truncated = true;
          return;
        }
        const batch = await sweep();
        counts.rounds += 1;
        counts[name] += batch.students;
        await deleteFiles(services, batch.fileKeys);
        counts.files += batch.fileKeys.length;
        if (batch.students < DEMO_SWEEP_BATCH) return;
      }
      counts.truncated = true;
    } catch (error) {
      failed.push(name);
      console.error(`demo sweep: ${name} failed (${(error as Error)?.name ?? 'Error'})`);
    }
  };

  const one = async (name: SweepName, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      failed.push(name);
      console.error(`demo sweep: ${name} failed (${(error as Error)?.name ?? 'Error'})`);
    }
  };

  await accounts('copies', () => store.sweepDemoStudents());
  await accounts('signups', () => store.sweepDemoSignups());
  await one('queued files', async () => {
    const ids = await store.queuedFileDeletionIds(DEMO_SWEEP_BATCH);
    for (const id of ids) {
      if (!withinBudget()) {
        counts.truncated = true;
        return;
      }
      await deleteQueuedFile({ store, files: services.files }, id);
      counts.queuedFiles += 1;
    }
    if (ids.length === DEMO_SWEEP_BATCH) counts.truncated = true;
  });
  await one('module marks', async () => {
    counts.moduleMarks = await store.deleteExpiredModuleMarks();
  });
  await one('module outlines', async () => {
    counts.moduleOutlines = await store.deleteExpiredModuleOutlines();
  });
  await one('sessions', async () => {
    counts.sessions = (await store.sweepExpiredSessions()).sessions;
  });

  // The counts line (the house's informational level, as every server note here).
  console.warn(
    `demo sweep: ${Object.entries(counts)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(' ')}`,
  );
  if (failed.length > 0) throw new SweepFailedError(failed);
  return counts;
}
