import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import {
  type CvDraftRequest,
  type CvSubmitted,
  type CvTailorRequest,
  MemoryCvEngine,
} from '@universityflow/cv';
import {
  checkSchedule,
  type JobHandler,
  type JobKind,
  type JobScheduler,
  type JobView,
  type ScheduledJob,
  type ScheduleOptions,
} from '@universityflow/jobs';

/**
 * My CV on the judge demo: a HACKATHON EXCEPTION (the owner's decision of 2026-10-24;
 * docs/deploy/demo.md, docs/deploy/hackathon-undo-pr.md). The demo shows My CV on the built-in
 * stand-in engine only, never Mmereko (D14: config.ts refuses any engine or Mmereko setting on a
 * demo).
 *
 * A demo has no job runner (the dev runner answers 404 there, and nothing hosted runs jobs) and
 * runs on serverless instances that each hold their own memory, so the stand-in's way of working
 * locally (finish a moment later, send a webhook, a runner collects) would leave every CV "being
 * made" for ever. Here, instead, inside the learner's own request and on one instance:
 *
 * - `DemoCvEngine` is the stand-in, finishing each CV as it is asked for (no webhook, no model,
 *   no network: the same deterministic text and tiny PDF the E2E and the preview use);
 * - `InlineCvScheduler` runs each CV job as it is scheduled, with the same handlers a runner
 *   would use (submit, then the polls collect it, ack it and keep its PDF in our own files), so
 *   every consent check, crisis check and data-layer rule runs exactly as everywhere else. Nothing
 *   is written to the job queue, so nothing is left waiting there for a runner that never comes.
 *
 * Delete this file when the exception is undone.
 */

/** The stand-in engine, finishing each CV at once (the judge demo only). */
export class DemoCvEngine extends MemoryCvEngine {
  override async createDraft(
    request: CvDraftRequest,
    idempotencyKey: string,
  ): Promise<CvSubmitted> {
    const submitted = await super.createDraft(request, idempotencyKey);
    await this.complete(submitted.jobId);
    return submitted;
  }

  override async tailor(request: CvTailorRequest, idempotencyKey: string): Promise<CvSubmitted> {
    const submitted = await super.tailor(request, idempotencyKey);
    await this.complete(submitted.jobId);
    return submitted;
  }
}

/** How deep one job may schedule another inside it before the rest are let go. */
export const MAX_INLINE_DEPTH = 4;

/**
 * A scheduler that runs each job at once, in the caller's request, whenever it was asked to run
 * (a poll "in two minutes" runs now: the demo's stand-in has already finished). A job that throws
 * is tried again at once up to its attempts; the last failure is logged by kind and error name
 * only (hard rule 4). Jobs scheduled deeper than `MAX_INLINE_DEPTH` are let go.
 */
export class InlineCvScheduler implements JobScheduler {
  #handlers: ReadonlyArray<JobHandler> = [];
  readonly #depth = new AsyncLocalStorage<number>();

  /** The handlers it runs (built with this scheduler, so they are given it afterwards). */
  use(handlers: ReadonlyArray<JobHandler>): void {
    this.#handlers = handlers;
  }

  async schedule<K extends JobKind>(options: ScheduleOptions<K>): Promise<ScheduledJob> {
    const job = checkSchedule(options, new Date());
    const id = randomUUID();
    const depth = this.#depth.getStore() ?? 0;
    const handler = this.#handlers.find((h) => h.kind.name === job.kind);
    if (handler && depth < MAX_INLINE_DEPTH) {
      await this.#depth.run(depth + 1, async () => {
        for (let attempt = 1; attempt <= job.maxAttempts; attempt++) {
          try {
            await handler.run(job.payload, { jobId: id, attempt });
            return;
          } catch (error) {
            if (attempt === job.maxAttempts) {
              console.error(
                `demo cv job ${job.kind}: gave up (${(error as Error)?.name ?? 'Error'})`,
              );
            }
          }
        }
      });
    }
    return { id, runAt: job.runAt, created: true };
  }

  async cancel(): Promise<boolean> {
    return false;
  }

  async get(): Promise<JobView | null> {
    return null;
  }
}
