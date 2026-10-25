import { createHash, randomUUID } from 'node:crypto';
import {
  type AtsResult,
  type CvAtsScanRequest,
  type CvDeletion,
  type CvDraftRequest,
  type CvEngine,
  CvEngineError,
  type CvJob,
  type CvJobKind,
  type CvJobResult,
  type CvJobStatus,
  type CvLearnerExport,
  type CvSubmitted,
  type CvTailorRequest,
  type CvWebhookType,
  checkAtsScanRequest,
  checkDraftRequest,
  checkIdempotencyKey,
  checkTailorRequest,
  type ProblemCode,
  type VerifiedCvWebhook,
  type WebhookHeaders,
} from './engine';
import { renderCvMarkdown, renderTinyPdf, scoreAts } from './render';
import {
  canonicalJson,
  MMEREKO_EVENT_ID_HEADER,
  MMEREKO_EVENT_TYPE_HEADER,
  MMEREKO_SIGNATURE_HEADER,
  signCvWebhook,
  verifyCvWebhook,
} from './webhook';

/**
 * The stand-in CV engine (docs/design/mmereko-api-proposal.md §6.2), as `MemoryOutbox` stands in
 * for SMS: in memory, deterministic, no model and no network, held to Mmereko's shared contract.
 * It checks requests the way Mmereko does (`checkDraftRequest`), replays a used idempotency key's
 * answer (a changed body or route under it is `idempotency_conflict`), answers a job only to its
 * learner, refuses an ack while a job runs (`job_not_finished`), keeps content only until
 * acknowledged, renders a tiny real PDF, scores ATS by keyword overlap, and sends its "webhooks"
 * exactly as Mmereko does: the event as compact sorted JSON, signed for `mmereko`, with the event
 * id and type in headers. It can be told to fail. Local development, unit tests and E2E run on it;
 * it passes `cvEngineContract`.
 */

/** A signed webhook the fake sends, exactly as it would arrive over HTTP. */
export interface CvWebhookDelivery {
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface MemoryCvEngineOptions {
  /** Signs the fake's webhooks; at least 32 characters. Without one, it sends none. */
  readonly webhookSecret?: string;
  /** Where its webhooks go (the dev wiring hands them to the webhook route's own code). */
  readonly deliver?: (delivery: CvWebhookDelivery) => Promise<void> | void;
  /**
   * Finish each job by itself, just after it is created (local development). Off, a test
   * finishes it with `complete` or `fail`.
   */
  readonly autoComplete?: boolean;
  readonly clock?: () => Date;
}

interface StoredJob {
  readonly jobId: string;
  readonly kind: CvJobKind;
  readonly learnerRef: string;
  status: CvJobStatus;
  request: CvDraftRequest | CvTailorRequest | null;
  result: CvJobResult | null;
  pdf: Uint8Array | null;
  problem: { readonly code: ProblemCode; readonly retryable: boolean } | null;
  readonly createdAt: Date;
  finishedAt: Date | null;
}

/** How long the fake's PDF links last: Mmereko's are at most five minutes. */
export const FAKE_PDF_LINK_MS = 5 * 60 * 1000;
const PDF_HOST = 'https://cv-engine.invalid/pdf/';

const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

export class MemoryCvEngine implements CvEngine {
  readonly #jobs = new Map<string, StoredJob>();
  readonly #keys = new Map<string, { readonly hash: string; readonly jobId: string }>();
  readonly #deletions = new Map<string, CvDeletion>();
  readonly #failures: CvEngineError[] = [];
  readonly #sent: CvWebhookDelivery[] = [];
  readonly #options: MemoryCvEngineOptions;
  readonly #clock: () => Date;

  constructor(options: MemoryCvEngineOptions = {}) {
    this.#options = options;
    this.#clock = options.clock ?? (() => new Date());
  }

  /** The next call fails this way (a 429 with `Retry-After`, a 500, a timeout). */
  failNext(code: ProblemCode, status: number, retryAfterMs: number | null = null): void {
    const retryable = status >= 500 || status === 429 || status === 408 || code === 'timeout';
    this.#failures.push(new CvEngineError(code, status, retryable, { retryAfterMs }));
  }

  /** Every webhook sent so far, oldest first. */
  get webhooks(): ReadonlyArray<CvWebhookDelivery> {
    return this.#sent;
  }

  /** How many jobs (any state) the fake holds for a learner. */
  jobsFor(learnerRef: string): number {
    return [...this.#jobs.values()].filter((j) => j.learnerRef === learnerRef).length;
  }

  #maybeFail(): void {
    const failure = this.#failures.shift();
    if (failure) throw failure;
  }

  #submit(kind: CvJobKind, request: CvDraftRequest | CvTailorRequest, key: string): CvSubmitted {
    // The route and the canonical body (key order doesn't matter).
    const hash = sha256(`${kind}:${canonicalJson(request)}`);
    const seen = this.#keys.get(key);
    if (seen) {
      if (seen.hash !== hash) throw new CvEngineError('idempotency_conflict', 409, false);
      return { jobId: seen.jobId, status: 'queued' };
    }
    const job: StoredJob = {
      jobId: randomUUID(),
      kind,
      learnerRef: request.learnerRef,
      status: 'queued',
      request,
      result: null,
      pdf: null,
      problem: null,
      createdAt: this.#clock(),
      finishedAt: null,
    };
    this.#jobs.set(job.jobId, job);
    this.#keys.set(key, { hash, jobId: job.jobId });
    if (this.#options.autoComplete) {
      setTimeout(() => {
        void this.complete(job.jobId).catch(() => undefined);
      }, 0);
    }
    return { jobId: job.jobId, status: 'queued' };
  }

  async createDraft(request: CvDraftRequest, idempotencyKey: string): Promise<CvSubmitted> {
    this.#maybeFail();
    const key = checkIdempotencyKey(idempotencyKey);
    return this.#submit('cv-draft', checkDraftRequest(request), key);
  }

  async tailor(request: CvTailorRequest, idempotencyKey: string): Promise<CvSubmitted> {
    this.#maybeFail();
    const key = checkIdempotencyKey(idempotencyKey);
    return this.#submit('tailoring', checkTailorRequest(request), key);
  }

  #job(jobId: string, learnerRef?: string): StoredJob {
    const job = this.#jobs.get(jobId);
    // Another learner's job is simply not there (`X-Learner-Ref`).
    if (!job || (learnerRef !== undefined && job.learnerRef !== learnerRef)) {
      throw new CvEngineError('not_found', 404, false);
    }
    return job;
  }

  /** Finishes a queued job: the CV text, its PDF and, for a tailoring, its ATS score. */
  async complete(jobId: string): Promise<void> {
    const job = this.#job(jobId);
    if (job.status !== 'queued' && job.status !== 'running') return;
    const request = job.request as CvDraftRequest | CvTailorRequest;
    let markdown = renderCvMarkdown(request.profile);
    let ats: AtsResult | null = null;
    let gaps: string[] = [];
    if ('job' in request) {
      // The fake "tailors" by naming the role it was fitted to: no model, nothing invented.
      markdown = `${markdown}\nFitted to: ${request.job.title}\n`;
      ats = scoreAts(markdown, request.job);
      gaps = ats.missingMustHaves.map((w) => `The advert asks for ${w}; the profile has none.`);
    }
    const pdf = renderTinyPdf(markdown);
    const now = this.#clock();
    job.pdf = pdf;
    job.result = {
      markdown,
      gaps,
      ats,
      pdf: {
        url: `${PDF_HOST}${job.jobId}`,
        expiresAt: new Date(now.getTime() + FAKE_PDF_LINK_MS).toISOString(),
        sha256: sha256(pdf),
        bytes: pdf.byteLength,
      },
      promptVersion: job.kind === 'tailoring' ? 'tailor-cv@fake' : null,
      usage: {
        model: job.kind === 'tailoring' ? 'fake' : null,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: null,
      },
    };
    job.status = 'succeeded';
    job.finishedAt = now;
    await this.#send(job.kind === 'tailoring' ? 'tailor.ready' : 'cv.ready', {
      jobId,
      kind: job.kind,
      learnerRef: job.learnerRef,
      status: 'succeeded',
    });
  }

  /** Fails a queued job with a problem code. */
  async fail(
    jobId: string,
    problem: ProblemCode = 'render_failed',
    retryable = true,
  ): Promise<void> {
    const job = this.#job(jobId);
    job.status = 'failed';
    job.problem = { code: problem, retryable };
    job.request = null;
    job.finishedAt = this.#clock();
    await this.#send('job.failed', {
      jobId,
      kind: job.kind,
      learnerRef: job.learnerRef,
      status: 'failed',
      problemCode: problem,
      retryable,
    });
  }

  async #send(type: CvWebhookType, data: Record<string, unknown>): Promise<void> {
    const secret = this.#options.webhookSecret;
    if (!secret) return;
    const at = this.#clock();
    const id = randomUUID();
    const body = canonicalJson({ createdAt: at.toISOString(), data, id, type });
    const delivery = {
      headers: {
        'content-type': 'application/json',
        [MMEREKO_SIGNATURE_HEADER]: signCvWebhook(secret, body, at),
        [MMEREKO_EVENT_ID_HEADER]: id,
        [MMEREKO_EVENT_TYPE_HEADER]: type,
      },
      body,
    };
    this.#sent.push(delivery);
    await this.#options.deliver?.(delivery);
  }

  async getJob(jobId: string, learnerRef: string): Promise<CvJob> {
    this.#maybeFail();
    const job = this.#job(jobId, learnerRef);
    return {
      jobId: job.jobId,
      kind: job.kind,
      status: job.status,
      learnerRef: job.learnerRef,
      createdAt: job.createdAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
      result: job.status === 'succeeded' ? job.result : null,
      problem: job.status === 'failed' ? job.problem : null,
    };
  }

  async fetchPdf(url: string): Promise<Uint8Array> {
    this.#maybeFail();
    const jobId = url.startsWith(PDF_HOST) ? url.slice(PDF_HOST.length) : '';
    const job = this.#jobs.get(jobId);
    const expiresAt = job?.result ? Date.parse(job.result.pdf.expiresAt) : 0;
    if (!job?.pdf || job.status !== 'succeeded' || this.#clock().getTime() > expiresAt) {
      throw new CvEngineError('not_found', 404, false);
    }
    return new Uint8Array(job.pdf);
  }

  async ack(jobId: string, learnerRef: string): Promise<void> {
    this.#maybeFail();
    const job = this.#job(jobId, learnerRef);
    if (job.status === 'queued' || job.status === 'running') {
      throw new CvEngineError('job_not_finished', 409, true);
    }
    // Collected: the content goes now (§7.2); the record (ids, times) stays.
    job.status = job.status === 'failed' ? 'failed' : 'expired';
    job.request = null;
    job.result = null;
    job.pdf = null;
  }

  async atsScan(request: CvAtsScanRequest): Promise<AtsResult> {
    this.#maybeFail();
    const checked = checkAtsScanRequest(request);
    return scoreAts(checked.cvText, checked.job);
  }

  async deleteLearner(
    learnerRef: string,
  ): Promise<{ readonly deletionId: string; readonly status: string }> {
    this.#maybeFail();
    let jobs = 0;
    for (const [id, job] of this.#jobs) {
      if (job.learnerRef === learnerRef) {
        this.#jobs.delete(id);
        jobs += 1;
      }
    }
    for (const [key, { jobId }] of this.#keys) {
      if (!this.#jobs.has(jobId)) this.#keys.delete(key);
    }
    const deletionId = randomUUID();
    const at = this.#clock().toISOString();
    this.#deletions.set(deletionId, {
      deletionId,
      learnerRef,
      status: 'completed',
      counts: { jobs },
      requestedAt: at,
      completedAt: at,
    });
    await this.#send('learner.deleted', { deletionId, learnerRef, status: 'completed' });
    return { deletionId, status: 'completed' };
  }

  async getDeletion(deletionId: string): Promise<CvDeletion> {
    this.#maybeFail();
    const deletion = this.#deletions.get(deletionId);
    if (!deletion) throw new CvEngineError('not_found', 404, false);
    return deletion;
  }

  async exportLearner(learnerRef: string): Promise<CvLearnerExport> {
    this.#maybeFail();
    return {
      learnerRef,
      jobs: [...this.#jobs.values()]
        .filter((j) => j.learnerRef === learnerRef)
        .map((j) => ({
          jobId: j.jobId,
          kind: j.kind,
          status: j.status,
          createdAt: j.createdAt.toISOString(),
          finishedAt: j.finishedAt?.toISOString() ?? null,
        })),
      deletions: [...this.#deletions.values()]
        .filter((d) => d.learnerRef === learnerRef)
        .map((d) => ({ deletionId: d.deletionId, status: d.status, requestedAt: d.requestedAt })),
    };
  }

  verifyWebhook(headers: WebhookHeaders, body: string, now: Date): VerifiedCvWebhook | null {
    const secret = this.#options.webhookSecret;
    return secret ? verifyCvWebhook([secret], headers, body, now) : null;
  }
}
