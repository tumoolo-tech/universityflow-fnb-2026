import { z } from 'zod';
import { AGE_BANDS, type AgeBand, CV_LIMITS, CV_PURPOSES, type CvPurpose } from './limits';
import { type CvProfile, problemsOf, validateCvProfile } from './profile';
import { holdsIdNumber, holdsStudentNumber } from './text';

/**
 * The CV engine behind an interface (D8; docs/design/mmereko-api-proposal.md §2, §10.1), held to
 * Mmereko's shared contract (packages/cv/contract/: README, cases.json, openapi.json): Mmereko's
 * partner API in production, `MemoryCvEngine` in development and tests, and every implementation
 * passes `cvEngineContract`. UniversityFlow keeps the CV of record (D2): an engine holds a
 * request's content only until it is collected (acknowledged), at most a day.
 *
 * Nothing here logs. An error carries a status, a stable problem code, whether to retry and, for a
 * refused field, JSON-pointer paths with codes: never a value that was sent.
 */

/** Mmereko's stable problem codes (RFC 9457 `code`), and the ones a transport adds. */
export const PROBLEM_CODES = [
  'invalid_json',
  'invalid_request',
  'validation_failed',
  'schema_version',
  'consent_required',
  'share_not_allowed',
  'idempotency_key_required',
  'idempotency_key_invalid',
  'idempotency_conflict',
  'invalid_client',
  'invalid_scope',
  'unsupported_grant_type',
  'invalid_token',
  'insufficient_scope',
  'not_found',
  'job_not_finished',
  'payload_too_large',
  'rate_limited',
  'render_failed',
  'engine_failed',
  'storage_failed',
  'attempts_exhausted',
  'server_error',
  'unavailable',
  // Ours, for what never reached an answer.
  'timeout',
  'network',
  'bad_response',
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

export function isProblemCode(value: unknown): value is ProblemCode {
  return typeof value === 'string' && (PROBLEM_CODES as ReadonlyArray<string>).includes(value);
}

/** A refused field: its JSON-pointer path and a code, never its value. */
export interface ProblemPath {
  readonly path: string;
  readonly code: string;
}

/** What went wrong with a call. Its message names the status and the code only. */
export class CvEngineError extends Error {
  override readonly name = 'CvEngineError';
  readonly retryAfterMs: number | null;
  readonly problems: ReadonlyArray<ProblemPath>;

  constructor(
    readonly code: ProblemCode,
    readonly status: number,
    readonly retryable: boolean,
    options: {
      readonly retryAfterMs?: number | null;
      readonly problems?: ReadonlyArray<ProblemPath>;
    } = {},
  ) {
    super(`The CV engine answered ${status} ${code}`);
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.problems = options.problems ?? [];
  }
}

/** The consent this request rests on (§4.2): UniversityFlow's record, never its content. */
export interface CvConsent {
  /** The id of the learner's CV opt-in record (`cv_links.id`). */
  readonly ref: string;
  /** The wording version the learner (or guardian) agreed to. */
  readonly version: string;
  readonly purposes: ReadonlyArray<CvPurpose>;
  /** No date of birth is ever sent (§2). */
  readonly ageBand: AgeBand;
}

export interface CvRender {
  readonly template: 'ats-classic';
  readonly paper: 'A4';
  readonly locale: 'en-ZA';
  readonly maxPages: 1 | 2;
}

export const DEFAULT_RENDER: CvRender = {
  template: 'ats-classic',
  paper: 'A4',
  locale: 'en-ZA',
  maxPages: 1,
};

/** Every write's envelope (§2). `render` is optional. */
export interface CvDraftRequest {
  /** UniversityFlow's per-learner reference for Mmereko only (`cv_links.learner_ref`). */
  readonly learnerRef: string;
  readonly consent: CvConsent;
  readonly profile: CvProfile;
  readonly render?: CvRender;
}

export interface JobAdvert {
  readonly title: string;
  readonly company?: string | null | undefined;
  readonly description: string;
}

export interface CvTailorRequest extends CvDraftRequest {
  readonly job: JobAdvert;
}

export interface CvAtsScanRequest {
  readonly learnerRef: string;
  readonly consent: CvConsent;
  /** The CV's text, as stored (a tailored or base CV's markdown); at most 60,000 characters. */
  readonly cvText: string;
  readonly job: JobAdvert;
}

export type CvJobKind = 'cv-draft' | 'tailoring';
export type CvJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'expired';

export interface AtsResult {
  readonly coveragePct: number;
  readonly matched: ReadonlyArray<string>;
  readonly missing: ReadonlyArray<string>;
  readonly missingMustHaves: ReadonlyArray<string>;
  readonly flags: ReadonlyArray<string>;
}

export interface CvJobResult {
  readonly markdown: string;
  readonly gaps: ReadonlyArray<string>;
  readonly ats: AtsResult | null;
  /** A short-lived link (at most 5 minutes) to the PDF, with its hash and size. */
  readonly pdf: {
    readonly url: string;
    readonly expiresAt: string;
    readonly sha256: string;
    readonly bytes: number;
  };
  readonly promptVersion: string | null;
  readonly usage: {
    readonly model: string | null;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly costUsd: number | null;
  } | null;
}

export interface CvJob {
  readonly jobId: string;
  readonly kind: CvJobKind;
  readonly status: CvJobStatus;
  readonly learnerRef: string;
  readonly createdAt: string;
  readonly finishedAt: string | null;
  /** Only when `succeeded` and not yet collected. */
  readonly result: CvJobResult | null;
  /** Only when `failed`: a code only. */
  readonly problem: { readonly code: ProblemCode; readonly retryable: boolean } | null;
}

export interface CvSubmitted {
  readonly jobId: string;
  readonly status: CvJobStatus;
}

export interface CvDeletion {
  readonly deletionId: string;
  readonly learnerRef: string;
  readonly status: 'pending' | 'completed';
  /** How many of each kind of record went: counts only. */
  readonly counts: Readonly<Record<string, number>>;
  readonly requestedAt: string;
  readonly completedAt: string | null;
}

/** What an engine still holds for a learner (POPIA s23): records with ids and times only. */
export interface CvLearnerExport {
  readonly learnerRef: string;
  readonly jobs: ReadonlyArray<{
    readonly jobId: string;
    readonly kind: CvJobKind;
    readonly status: CvJobStatus;
    readonly createdAt: string;
    readonly finishedAt: string | null;
  }>;
  readonly deletions: ReadonlyArray<{
    readonly deletionId: string;
    readonly status: 'pending' | 'completed';
    readonly requestedAt: string;
  }>;
}

export const WEBHOOK_TYPES = ['cv.ready', 'tailor.ready', 'job.failed', 'learner.deleted'] as const;
export type CvWebhookType = (typeof WEBHOOK_TYPES)[number];

/** A webhook's event: ids and states only (§7.6). */
export interface CvWebhookEvent {
  /** The event's own id: the same on every retry of it. */
  readonly id: string;
  readonly type: CvWebhookType;
  readonly jobId: string | null;
  readonly deletionId: string | null;
  readonly learnerRef: string | null;
  readonly status: string | null;
  readonly createdAt: string;
}

export interface VerifiedCvWebhook {
  readonly event: CvWebhookEvent;
  /** The same for a replay of this request, different for any other (A5-06). Not personal. */
  readonly replayKey: string;
  /** How long a verified request stays accepted: remember the replay key this long. */
  readonly replayWindowMs: number;
}

export interface WebhookHeaders {
  get(name: string): string | null;
}

export interface CvEngine {
  /** A base CV from the profile, no job advert and no model (D7). `202 { jobId }`. */
  createDraft(request: CvDraftRequest, idempotencyKey: string): Promise<CvSubmitted>;
  /** A CV fitted to one job advert (Anthropic only, D4). */
  tailor(request: CvTailorRequest, idempotencyKey: string): Promise<CvSubmitted>;
  /** A job, asked about as its learner (`X-Learner-Ref`): another learner's is `not_found`. */
  getJob(jobId: string, learnerRef: string): Promise<CvJob>;
  /** The PDF behind a job's short link. */
  fetchPdf(url: string): Promise<Uint8Array>;
  /** "Collected": the engine deletes the job's content now. `job_not_finished` while it runs. */
  ack(jobId: string, learnerRef: string): Promise<void>;
  /** A deterministic ATS score of a CV's text against an advert (no model). */
  atsScan(request: CvAtsScanRequest): Promise<AtsResult>;
  /** Everything held for this learner goes; in-flight jobs are cancelled. */
  deleteLearner(
    learnerRef: string,
  ): Promise<{ readonly deletionId: string; readonly status: string }>;
  getDeletion(deletionId: string): Promise<CvDeletion>;
  exportLearner(learnerRef: string): Promise<CvLearnerExport>;
  /** Null for anything the engine didn't send just now. Never throws. */
  verifyWebhook(headers: WebhookHeaders, body: string, now: Date): VerifiedCvWebhook | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A job, deletion or event id an engine hands back. */
export const ENGINE_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** An idempotency key (Mmereko's contract): 8 to 255 of `A-Z a-z 0-9 - _ : .`. */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9\-_:.]{8,255}$/;

const failure = (code: ProblemCode, status: number, problems?: ReadonlyArray<ProblemPath>) =>
  new CvEngineError(code, status, false, problems ? { problems } : {});

const uuid = z.string({ message: 'wrong_type' }).regex(UUID, { message: 'invalid_format' });

const consentSchema = z.strictObject({
  ref: uuid,
  version: z.string({ message: 'wrong_type' }).min(1).max(40, { message: 'too_long' }),
  purposes: z
    .array(z.enum(CV_PURPOSES, { message: 'invalid_value' }), { message: 'wrong_type' })
    .min(1, { message: 'too_few' })
    .max(CV_PURPOSES.length, { message: 'too_many' }),
  ageBand: z.enum(AGE_BANDS, { message: 'invalid_value' }),
});

const renderSchema = z.strictObject({
  template: z.literal('ats-classic', { message: 'invalid_value' }),
  paper: z.literal('A4', { message: 'invalid_value' }),
  locale: z.literal('en-ZA', { message: 'invalid_value' }),
  maxPages: z.union([z.literal(1), z.literal(2)], { message: 'invalid_value' }),
});

const advertText = (max: number) =>
  z
    .string({ message: 'wrong_type' })
    .max(max, { message: 'too_long' })
    .superRefine((value, ctx) => {
      if (holdsIdNumber(value)) ctx.addIssue({ code: 'custom', message: 'id_number' });
      else if (holdsStudentNumber(value)) {
        ctx.addIssue({ code: 'custom', message: 'student_number' });
      }
    });

/** A job advert (`job` on `/tailorings` and `/ats-scans`): someone else's text, kept until the job ends (D13). */
export const jobAdvertSchema = z.strictObject(
  {
    title: advertText(CV_LIMITS.title).min(1, { message: 'too_short' }),
    company: advertText(CV_LIMITS.title).nullable().optional(),
    description: advertText(CV_LIMITS.advert).min(1, { message: 'too_short' }),
  },
  { message: 'wrong_type' },
);

/** Mmereko's first check: a consent with a ref, or `403 consent_required`. */
function requireConsentRef(consent: unknown): void {
  if (typeof consent !== 'object' || consent === null || !('ref' in consent) || !consent.ref) {
    throw failure('consent_required', 403);
  }
}

/** The envelope's shape (no profile, no job), as `422 validation_failed` with paths. */
function checkShape<T extends z.ZodRawShape>(request: Record<string, unknown>, shape: T) {
  const parsed = z.strictObject(shape).safeParse(request);
  if (!parsed.success) throw failure('validation_failed', 422, problemsOf(parsed.error.issues));
  return parsed.data;
}

/** The purpose (any of `purposes`), then nothing share-related for an under-18 (§9.3). */
function checkPurpose(consent: CvConsent, purposes: ReadonlyArray<CvPurpose>): void {
  if (!purposes.some((p) => consent.purposes.includes(p))) throw failure('consent_required', 403);
  if (consent.ageBand === 'under-18' && consent.purposes.includes('cv.share')) {
    throw failure('share_not_allowed', 403);
  }
}

function checkProfile(profile: unknown): CvProfile {
  const check = validateCvProfile(profile);
  if (check.ok) return check.profile;
  const problems = check.issues.map((i) => ({ path: `/profile${i.path}`, code: i.code }));
  const major = check.issues.some((i) => i.code === 'schema_version');
  throw failure(major ? 'schema_version' : 'validation_failed', 422, problems);
}

function checkAdvert(job: unknown): JobAdvert {
  const parsed = jobAdvertSchema.safeParse(job);
  if (!parsed.success) {
    throw failure('validation_failed', 422, problemsOf(parsed.error.issues, ['job']));
  }
  return parsed.data;
}

function asRecord(request: unknown): Record<string, unknown> {
  if (typeof request !== 'object' || request === null || Array.isArray(request)) {
    throw failure('invalid_json', 400);
  }
  return request as Record<string, unknown>;
}

/**
 * The checks every engine makes on a write, in Mmereko's order (contract README, "Write
 * envelopes"): a consent with a ref (`403 consent_required`); the envelope's shape
 * (`422 validation_failed`); the purpose (`403 consent_required`); nothing share-related for an
 * under-18 (`403 share_not_allowed`); the profile (`422`, paths under `/profile`); the advert
 * (paths under `/job`). The live adapter runs them too, before anything leaves, so a request we
 * know to be wrong is never sent.
 */
export function checkDraftRequest(
  request: unknown,
  purposes: ReadonlyArray<CvPurpose> = ['cv.draft'],
  withJob = false,
): CvDraftRequest & { readonly job?: JobAdvert } {
  const r = asRecord(request);
  requireConsentRef(r['consent']);
  const shape = checkShape(r, {
    learnerRef: uuid,
    consent: consentSchema,
    profile: z.unknown(),
    render: renderSchema.optional(),
    ...(withJob ? { job: z.unknown() } : {}),
  });
  const consent = shape.consent as CvConsent;
  checkPurpose(consent, purposes);
  const profile = checkProfile(shape.profile);
  const job = withJob ? checkAdvert((shape as { job?: unknown }).job) : undefined;
  return {
    learnerRef: shape.learnerRef,
    consent,
    profile,
    ...(shape.render ? { render: shape.render as CvRender } : {}),
    ...(job ? { job } : {}),
  };
}

export function checkTailorRequest(request: unknown): CvTailorRequest {
  return checkDraftRequest(request, ['cv.tailor'], true) as CvTailorRequest;
}

export function checkAtsScanRequest(request: unknown): CvAtsScanRequest {
  const r = asRecord(request);
  requireConsentRef(r['consent']);
  const shape = checkShape(r, {
    learnerRef: uuid,
    consent: consentSchema,
    cvText: z
      .string({ message: 'wrong_type' })
      .min(1, { message: 'too_short' })
      .max(60_000, { message: 'too_long' }),
    job: z.unknown(),
  });
  const consent = shape.consent as CvConsent;
  checkPurpose(consent, ['cv.ats', 'cv.tailor']);
  return {
    learnerRef: shape.learnerRef,
    consent,
    cvText: shape.cvText,
    job: checkAdvert(shape.job),
  };
}

/** `Idempotency-Key` is required on every POST (§5.1): we send the `cv_documents` row id. */
export function checkIdempotencyKey(key: unknown): string {
  if (key === undefined || key === null || key === '')
    throw failure('idempotency_key_required', 400);
  if (typeof key !== 'string' || !IDEMPOTENCY_KEY.test(key)) {
    throw failure('idempotency_key_invalid', 400);
  }
  return key;
}
