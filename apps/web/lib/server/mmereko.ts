import 'server-only';
import { createHash } from 'node:crypto';
import {
  type AtsResult,
  type CvAtsScanRequest,
  type CvDeletion,
  type CvDraftRequest,
  type CvEngine,
  CvEngineError,
  type CvJob,
  type CvLearnerExport,
  type CvSubmitted,
  type CvTailorRequest,
  checkAtsScanRequest,
  checkDraftRequest,
  checkIdempotencyKey,
  checkTailorRequest,
  ENGINE_ID,
  isProblemCode,
  type ProblemCode,
  type ProblemPath,
  safeLinkProblem,
  type VerifiedCvWebhook,
  verifyCvWebhook,
  type WebhookHeaders,
} from '@universityflow/cv';
import { z } from 'zod';
import { BodyTooLargeError, readCapped } from './capped-body';

/**
 * Mmereko's partner API as a `CvEngine` (docs/design/mmereko-api-proposal.md §2, §4, §5), held to
 * Mmereko's shared contract (packages/cv/contract/README.md, openapi.json, cases.json). Tested
 * against a local fake of that contract (test/fake-mmereko.ts); it joins `CV_ADAPTERS` only after
 * it passes `cvEngineContract` against Mmereko's sandbox (D8).
 *
 * - **Auth (§4.1, D12).** OAuth 2.0 client credentials (RFC 6749 §4.4, HTTP Basic,
 *   `grant_type=client_credentials`), a 10-minute ES256 token (audience `mmereko-partner`) cached
 *   in memory and refreshed a minute before it expires; a `401 invalid_token` drops it and tries
 *   once more. During a rotation the next secret is tried when the current one is refused.
 * - **Envelope.** Every write is checked here first, in Mmereko's order (`checkDraftRequest`), so a
 *   request we know to be wrong never leaves; every POST carries an `Idempotency-Key` (a replay
 *   answers `Idempotent-Replayed: true` with the first answer); `GET /jobs/{id}` and its ack carry
 *   `X-Learner-Ref`.
 * - **Problems (RFC 9457).** A refusal becomes a `CvEngineError` with Mmereko's stable code, its
 *   `retryable` flag (or the status's), `Retry-After` and `problems` (JSON-pointer paths and codes):
 *   never a body, never a value.
 * - **Timeouts (§5.3).** 10 s for a call, 30 s for a PDF. Our token goes only to Mmereko's own
 *   origin: a PDF link elsewhere (a storage bucket's signed URL) is fetched without it, and only
 *   from a public host. No redirect is followed (CV-A5 A5-15).
 * - **Bounded answers (CV-A5 A5-16, A5-17).** Every body is read up to a cap (2 MB of JSON, 10 MB
 *   of PDF), a PDF must start `%PDF`, and a job's answer must name the job and learner asked about.
 *   An ATS scan's word lists, returned to the learner unstored, are capped as stored ones are
 *   (CV-A10 A10-60).
 * - **Webhooks.** `x-mmereko-signature` over `<t>.mmereko.<body>`, packages/messaging's scheme,
 *   either of two secrets (`verifyCvWebhook`); re-signed on every retry, so the route dedupes by the
 *   event's id.
 * - **Nothing personal is logged** (hard rule 4): a deprecation notice names the route's kind only.
 */

export interface MmerekoOptions {
  /** `https://<partner host>/partner/v1`. */
  readonly apiUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  /** The next secret during a rotation (§4.1), tried when the current one is refused. */
  readonly clientSecretNext?: string | null;
  /** Every webhook secret live now: one, or two during a rotation. */
  readonly webhookSecrets: ReadonlyArray<string>;
  readonly fetch?: typeof fetch;
  readonly clock?: () => Date;
  readonly timeouts?: { readonly requestMs?: number; readonly pdfMs?: number };
  /** Hears a deprecation or sunset notice (§5.4). Default: one log line, no ids. */
  readonly onDeprecation?: (notice: {
    readonly route: string;
    readonly sunset: string | null;
  }) => void;
}

/** Calls and PDFs (§5.3). */
export const MMEREKO_TIMEOUTS = { requestMs: 10_000, pdfMs: 30_000 } as const;
/** Refresh a token this long before it expires (§4.1). */
const TOKEN_MARGIN_MS = 60_000;
/** The largest PDF we take. */
export const MAX_CV_PDF_BYTES = 10 * 1024 * 1024;
/**
 * The largest JSON answer we read (CV-A5 A5-16): a finished job's CV text is at most 200,000
 * characters, so this is room to spare, never a stream read to the end.
 */
export const MAX_MMEREKO_ANSWER_BYTES = 2 * 1024 * 1024;
/** A problem document is short; a longer one is read as no body at all. */
const MAX_PROBLEM_BYTES = 64 * 1024;
const SCOPES = 'cv:write cv:read ats:scan learner:read learner:delete';

/**
 * The most words an ATS scan's lists hand the learner (CV-A10 A10-60): as many as a stored CV
 * keeps (packages/db `storeCvResult`), since the scan's answer is returned at once, unstored.
 */
export const ATS_WORDS_MAX = 200;
/** The most flags an ATS scan's answer hands the learner. */
export const ATS_FLAGS_MAX = 20;

/** A JSON answer read up to its cap, or null when it is too long or not JSON. */
async function readJson(response: Response, max: number): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(await readCapped(response, max)));
  } catch {
    return null;
  }
}

/**
 * Whether a link off Mmereko's own host names a public host (CV-A5 A5-15): never an IP address,
 * this machine or a private network name, by the same rule a learner's own links are held to.
 */
function isPublicHost(target: URL): boolean {
  return safeLinkProblem(`https://${target.host}/`) === null;
}

/** The first bytes of every PDF (CV-A5 A5-16): what we keep and serve as one is one. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] as const; // %PDF

/** A UUID derived from text, for a POST's idempotency key that names one logical call. */
function uuidFrom(text: string): string {
  const h = createHash('sha256').update(text).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function retryAfterMs(header: string | null, now: Date): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - now.getTime());
}

/** Mmereko's problem document (contract README, "Problems"). Unknown members are ignored. */
const problemSchema = z.object({
  code: z.string().max(60).optional(),
  retryable: z.boolean().optional(),
  problems: z
    .array(z.object({ path: z.string().max(300), code: z.string().max(40) }))
    .max(200)
    .optional(),
});

const id = z.string().regex(ENGINE_ID);
const status = z.enum(['queued', 'running', 'succeeded', 'failed', 'expired']);
const kind = z.enum(['cv-draft', 'tailoring']);
const submittedSchema = z.object({ jobId: id, status });
const atsSchema = z.object({
  coveragePct: z.number().min(0).max(100),
  matched: z.array(z.string().max(80)).max(500),
  missing: z.array(z.string().max(80)).max(500),
  missingMustHaves: z.array(z.string().max(80)).max(500),
  flags: z.array(z.string().max(200)).max(100),
});
const jobSchema = z.object({
  jobId: id,
  kind,
  status,
  learnerRef: z.string().max(64),
  createdAt: z.string().max(40),
  finishedAt: z.string().max(40).nullable().optional(),
  result: z
    .object({
      markdown: z.string().max(200_000),
      gaps: z.array(z.string().max(500)).max(50),
      ats: atsSchema.nullable(),
      pdf: z.object({
        url: z.string().max(4000),
        expiresAt: z.string().max(40),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        bytes: z.number().int().min(1).max(MAX_CV_PDF_BYTES),
      }),
      promptVersion: z.string().max(100).nullable(),
      usage: z
        .object({
          model: z.string().max(100).nullable(),
          inputTokens: z.number().min(0),
          outputTokens: z.number().min(0),
          costUsd: z.number().min(0).nullable(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  problem: z
    .object({ code: z.string().max(60), retryable: z.boolean() })
    .nullable()
    .optional(),
});
const deletionSchema = z.object({
  deletionId: id,
  learnerRef: z.string().max(64),
  status: z.enum(['pending', 'completed']),
  counts: z.record(z.string().max(40), z.number().int().min(0)).optional(),
  requestedAt: z.string().max(40),
  completedAt: z.string().max(40).nullable().optional(),
});
const exportSchema = z.object({
  learnerRef: z.string().max(64),
  jobs: z.array(
    z.object({
      jobId: id,
      kind,
      status,
      createdAt: z.string().max(40),
      finishedAt: z.string().max(40).nullable().optional(),
    }),
  ),
  deletions: z
    .array(
      z.object({
        deletionId: id,
        status: z.enum(['pending', 'completed']),
        requestedAt: z.string().max(40),
      }),
    )
    .optional(),
});

function defaultCode(status: number): ProblemCode {
  if (status === 401) return 'invalid_token';
  if (status === 403) return 'insufficient_scope';
  if (status === 404) return 'not_found';
  if (status === 409) return 'idempotency_conflict';
  if (status === 413) return 'payload_too_large';
  if (status === 422) return 'validation_failed';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'unavailable';
  if (status >= 500) return 'server_error';
  return 'invalid_request';
}

const retryableStatus = (code: number) => code >= 500 || code === 429 || code === 408;

export class MmerekoCvEngine implements CvEngine {
  readonly #options: MmerekoOptions;
  readonly #fetch: typeof fetch;
  readonly #clock: () => Date;
  readonly #origin: string;
  #token: { readonly value: string; readonly refreshAt: number } | null = null;
  #useNext = false;

  constructor(options: MmerekoOptions) {
    this.#options = { ...options, apiUrl: options.apiUrl.replace(/\/$/, '') };
    this.#fetch = options.fetch ?? fetch;
    this.#clock = options.clock ?? (() => new Date());
    this.#origin = new URL(this.#options.apiUrl).origin;
  }

  async #send(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    try {
      // Never a redirect (CV-A5 A5-15): one would re-send a learner's profile, or our
      // credentials, to wherever it pointed. Mmereko answers from its own host or not at all.
      return await this.#fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const name = (error as Error)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new CvEngineError('timeout', 0, true);
      }
      throw new CvEngineError('network', 0, true);
    }
  }

  async #problem(response: Response): Promise<CvEngineError> {
    let body: z.infer<typeof problemSchema> = {};
    // Not problem JSON, or too long to be one: the status says enough.
    const parsed = problemSchema.safeParse(await readJson(response, MAX_PROBLEM_BYTES));
    if (parsed.success) body = parsed.data;
    const code = isProblemCode(body.code) ? body.code : defaultCode(response.status);
    const problems: ProblemPath[] = (body.problems ?? []).map((p) => ({
      path: p.path,
      code: p.code,
    }));
    return new CvEngineError(
      code,
      response.status,
      body.retryable ?? retryableStatus(response.status),
      { retryAfterMs: retryAfterMs(response.headers.get('retry-after'), this.#clock()), problems },
    );
  }

  async #requestToken(secret: string): Promise<Response> {
    const basic = Buffer.from(
      `${encodeURIComponent(this.#options.clientId)}:${encodeURIComponent(secret)}`,
    ).toString('base64');
    return this.#send(
      `${this.#options.apiUrl}/oauth/token`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: SCOPES }).toString(),
      },
      this.#options.timeouts?.requestMs ?? MMEREKO_TIMEOUTS.requestMs,
    );
  }

  async #accessToken(): Promise<string> {
    const now = this.#clock().getTime();
    if (this.#token && now < this.#token.refreshAt) return this.#token.value;
    const next = this.#options.clientSecretNext;
    let response = await this.#requestToken(
      this.#useNext && next ? next : this.#options.clientSecret,
    );
    // A rotation in progress: the other live secret.
    if (response.status === 401 && next) {
      this.#useNext = !this.#useNext;
      response = await this.#requestToken(this.#useNext ? next : this.#options.clientSecret);
    }
    if (!response.ok) throw await this.#problem(response);
    const parsed = z
      .object({
        access_token: z.string().min(1).max(8192),
        token_type: z.string(),
        expires_in: z.number().int().min(1).max(86_400),
      })
      .safeParse(await readJson(response, MAX_PROBLEM_BYTES));
    if (!parsed.success || parsed.data.token_type.toLowerCase() !== 'bearer') {
      throw new CvEngineError('bad_response', response.status, true);
    }
    this.#token = {
      value: parsed.data.access_token,
      refreshAt: now + parsed.data.expires_in * 1000 - TOKEN_MARGIN_MS,
    };
    return this.#token.value;
  }

  #noteDeprecation(route: string, response: Response): void {
    const deprecation = response.headers.get('deprecation');
    const sunset = response.headers.get('sunset');
    if (!deprecation && !sunset) return;
    const notice = { route, sunset: sunset ? sunset.slice(0, 60) : null };
    if (this.#options.onDeprecation) this.#options.onDeprecation(notice);
    else
      console.warn(
        `mmereko: ${route} is deprecated${notice.sunset ? `, sunset ${notice.sunset}` : ''}`,
      );
  }

  /** One call to the partner API, with the token, retried once on a 401. */
  async #call(
    route: string,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options: {
      readonly body?: unknown;
      readonly idempotencyKey?: string;
      readonly learnerRef?: string;
    } = {},
  ): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.#accessToken();
      const headers: Record<string, string> = {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
      };
      if (options.body !== undefined) headers['content-type'] = 'application/json';
      if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
      if (options.learnerRef) headers['x-learner-ref'] = options.learnerRef;
      const response = await this.#send(
        `${this.#options.apiUrl}${path}`,
        {
          method,
          headers,
          ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        },
        this.#options.timeouts?.requestMs ?? MMEREKO_TIMEOUTS.requestMs,
      );
      if (response.status === 401 && attempt === 0) {
        this.#token = null;
        continue;
      }
      this.#noteDeprecation(route, response);
      if (!response.ok) throw await this.#problem(response);
      return response;
    }
    throw new CvEngineError('invalid_token', 401, false);
  }

  async #json<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    const parsed = schema.safeParse(await readJson(response, MAX_MMEREKO_ANSWER_BYTES));
    if (!parsed.success) throw new CvEngineError('bad_response', response.status, true);
    return parsed.data;
  }

  async createDraft(request: CvDraftRequest, idempotencyKey: string): Promise<CvSubmitted> {
    const key = checkIdempotencyKey(idempotencyKey);
    const body = checkDraftRequest(request);
    const response = await this.#call('cv-drafts', 'POST', '/cv-drafts', {
      body,
      idempotencyKey: key,
    });
    return this.#json(response, submittedSchema);
  }

  async tailor(request: CvTailorRequest, idempotencyKey: string): Promise<CvSubmitted> {
    const key = checkIdempotencyKey(idempotencyKey);
    const body = checkTailorRequest(request);
    const response = await this.#call('tailorings', 'POST', '/tailorings', {
      body,
      idempotencyKey: key,
    });
    return this.#json(response, submittedSchema);
  }

  #path(value: string): string {
    if (!ENGINE_ID.test(value) && !/^[0-9a-f-]{36}$/i.test(value)) {
      throw new CvEngineError('invalid_request', 400, false);
    }
    return encodeURIComponent(value);
  }

  async getJob(jobId: string, learnerRef: string): Promise<CvJob> {
    const response = await this.#call('jobs', 'GET', `/jobs/${this.#path(jobId)}`, {
      learnerRef: this.#path(learnerRef),
    });
    const job = await this.#json(response, jobSchema);
    // The answer is about the job and the learner asked about (CV-A5 A5-17), or none is taken: a
    // mix-up on the operator's side must never put one learner's CV in another's record.
    if (job.jobId !== jobId || job.learnerRef.toLowerCase() !== learnerRef.toLowerCase()) {
      throw new CvEngineError('bad_response', response.status, true);
    }
    const problem = job.problem
      ? {
          code: isProblemCode(job.problem.code) ? job.problem.code : ('engine_failed' as const),
          retryable: job.problem.retryable,
        }
      : null;
    return {
      jobId: job.jobId,
      kind: job.kind,
      status: job.status,
      learnerRef: job.learnerRef,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt ?? null,
      result:
        job.status === 'succeeded' && job.result
          ? { ...job.result, usage: job.result.usage ?? null }
          : null,
      problem: job.status === 'failed' ? problem : null,
    };
  }

  async fetchPdf(url: string): Promise<Uint8Array> {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      throw new CvEngineError('bad_response', 0, false);
    }
    const sameOrigin = target.origin === this.#origin;
    if (target.username || target.password) throw new CvEngineError('bad_response', 0, false);
    // Off Mmereko's own host: https to a public name only (CV-A5 A5-15), so a link can't point
    // our server at this machine, a cloud metadata address or a private network.
    if (!sameOrigin && (target.protocol !== 'https:' || !isPublicHost(target))) {
      throw new CvEngineError('bad_response', 0, false);
    }
    const headers: Record<string, string> = { accept: 'application/pdf' };
    // Our token goes to Mmereko alone: a storage bucket's signed link is fetched without it.
    if (sameOrigin) headers['authorization'] = `Bearer ${await this.#accessToken()}`;
    const response = await this.#send(
      target.toString(),
      { method: 'GET', headers, redirect: 'error' },
      this.#options.timeouts?.pdfMs ?? MMEREKO_TIMEOUTS.pdfMs,
    );
    if (!response.ok) throw await this.#problem(response);
    let bytes: Uint8Array;
    try {
      bytes = await readCapped(response, MAX_CV_PDF_BYTES);
    } catch (error) {
      if (error instanceof BodyTooLargeError)
        throw new CvEngineError('payload_too_large', 413, false);
      const name = (error as Error)?.name;
      throw new CvEngineError(
        name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network',
        0,
        true,
      );
    }
    if (!PDF_MAGIC.every((b, i) => bytes[i] === b)) {
      throw new CvEngineError('bad_response', response.status, false);
    }
    return bytes;
  }

  async ack(jobId: string, learnerRef: string): Promise<void> {
    await this.#call('ack', 'POST', `/jobs/${this.#path(jobId)}/ack`, {
      idempotencyKey: uuidFrom(`ack:${jobId}`),
      learnerRef: this.#path(learnerRef),
    });
  }

  async atsScan(request: CvAtsScanRequest): Promise<AtsResult> {
    const body = checkAtsScanRequest(request);
    const response = await this.#call('ats-scans', 'POST', '/ats-scans', {
      body,
      idempotencyKey: uuidFrom(`ats:${JSON.stringify(body)}`),
    });
    const ats = await this.#json(response, atsSchema);
    // Returned to the learner as it comes, so capped here as a stored CV's lists are (A10-60).
    return {
      coveragePct: ats.coveragePct,
      matched: ats.matched.slice(0, ATS_WORDS_MAX),
      missing: ats.missing.slice(0, ATS_WORDS_MAX),
      missingMustHaves: ats.missingMustHaves.slice(0, ATS_WORDS_MAX),
      flags: ats.flags.slice(0, ATS_FLAGS_MAX),
    };
  }

  async deleteLearner(
    learnerRef: string,
  ): Promise<{ readonly deletionId: string; readonly status: string }> {
    const response = await this.#call('learners', 'DELETE', `/learners/${this.#path(learnerRef)}`);
    return this.#json(response, z.object({ deletionId: id, status: z.string().max(40) }));
  }

  async getDeletion(deletionId: string): Promise<CvDeletion> {
    const response = await this.#call('deletions', 'GET', `/deletions/${this.#path(deletionId)}`);
    const deletion = await this.#json(response, deletionSchema);
    return {
      ...deletion,
      counts: deletion.counts ?? {},
      completedAt: deletion.completedAt ?? null,
    };
  }

  async exportLearner(learnerRef: string): Promise<CvLearnerExport> {
    const response = await this.#call(
      'export',
      'GET',
      `/learners/${this.#path(learnerRef)}/export`,
    );
    const exported = await this.#json(response, exportSchema);
    return {
      learnerRef: exported.learnerRef,
      jobs: exported.jobs.map((j) => ({ ...j, finishedAt: j.finishedAt ?? null })),
      deletions: exported.deletions ?? [],
    };
  }

  verifyWebhook(headers: WebhookHeaders, body: string, now: Date): VerifiedCvWebhook | null {
    return verifyCvWebhook(this.#options.webhookSecrets, headers, body, now);
  }
}

/** The adapter from the environment (cv-providers.ts lists it once the sandbox passes). */
export function mmerekoFromEnv(env: Record<string, string | undefined>): MmerekoCvEngine {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Mmereko needs ${name}`);
    return value;
  };
  const next = env['MMEREKO_WEBHOOK_SECRET_NEXT']?.trim();
  return new MmerekoCvEngine({
    apiUrl: required('MMEREKO_API_URL'),
    clientId: required('MMEREKO_CLIENT_ID'),
    clientSecret: required('MMEREKO_CLIENT_SECRET'),
    clientSecretNext: env['MMEREKO_CLIENT_SECRET_NEXT']?.trim() || null,
    webhookSecrets: [required('MMEREKO_WEBHOOK_SECRET'), ...(next ? [next] : [])],
  });
}
