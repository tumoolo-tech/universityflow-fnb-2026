import 'server-only';
import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  type CatalogueView,
  curriculumFor,
  isPublishable,
  isSubjectId,
  normaliseModuleCode,
  type Provenance,
  programmeById,
  subject,
  type UniversityId,
  universityById,
} from '@universityflow/catalogue';
import {
  buildCvProfile,
  type CatalogueName,
  type CvDraftRequest,
  type CvEngine,
  CvEngineError,
  type CvSources,
  DEFAULT_RENDER,
  MAX_CV_WEBHOOK_BYTES,
} from '@universityflow/cv';
import {
  ConsentRequiredError,
  type CvAccess,
  CvConsentError,
  NotFoundError,
  type Store,
  type StudentStore,
} from '@universityflow/db';
import type { FileStore } from '@universityflow/documents';
import {
  defineJobKind,
  entityId,
  handle,
  type JobHandler,
  type JobScheduler,
} from '@universityflow/jobs';

/**
 * My CV's server side (docs/design/mmereko-api-proposal.md §5.3, §7.3, §10.2): the job kinds and
 * their handlers, the webhook's reception, the sources a profile is built from, and the
 * 60-second signed PDF links.
 *
 * Every call to the engine runs in a job, never in a learner's request (§5.3), except the ATS
 * scan, which Mmereko answers at once. Payloads are ids only (hard rule 4): `{ cvDocumentId }` or
 * `{ cvDeletionId }`. Each job re-reads the row and the learner's consent when it runs, so a
 * learner deleted, withdrawn or past consent yields nothing to send. Nothing personal is logged:
 * an error's name or a problem code at most.
 */

export const CV_SUBMIT = defineJobKind('cv.submit', ['cvDocumentId']);
export const CV_POLL = defineJobKind('cv.poll', ['cvDocumentId']);
export const CV_COLLECT = defineJobKind('cv.collect', ['cvDocumentId']);
/** The last look, a day on: a CV the engine never finished is closed (its content is gone). */
export const CV_EXPIRE = defineJobKind('cv.expire', ['cvDocumentId']);
export const CV_DELETE_LEARNER = defineJobKind('cv.delete-learner', ['cvDeletionId']);

/** Attempts before a call is given up (§5.3: `maxAttempts` 6, backoff 1, 2, 4 … minutes). */
export const CV_JOB_ATTEMPTS = 6;
/** Polls behind the webhook (§5.3: +2 and +10 minutes; and +60, before the day's last look). */
export const CV_POLL_DELAYS_MS = [2 * 60_000, 10 * 60_000, 60 * 60_000] as const;
/** Mmereko deletes a job's content after 24 hours (§7.2): the last look comes just after. */
export const CV_EXPIRE_AFTER_MS = 24 * 60 * 60_000 + 5 * 60_000;
/** A deletion the engine hasn't confirmed is asked about again this often. */
const DELETION_RECHECK_MS = 10 * 60_000;

/** What the CV jobs need. */
export interface CvJobParts {
  readonly store: Store;
  readonly engine: CvEngine;
  readonly files: FileStore;
  readonly scheduler: JobScheduler;
  readonly catalogue: (today?: Date) => CatalogueView;
  /** The owner's preview standing in for the wording (`Config.cvPreview`). */
  readonly access: CvAccess;
  readonly clock?: () => Date;
}

/** Queues `cv.submit` for a CV row just written: one job per row. */
export async function scheduleCvDocument(scheduler: JobScheduler, documentId: string) {
  await scheduler.schedule({
    kind: CV_SUBMIT,
    payload: { cvDocumentId: entityId(documentId) },
    delayMs: 0,
    idempotencyKey: `cv-submit:${documentId}`,
    maxAttempts: CV_JOB_ATTEMPTS,
  });
}

/**
 * Schedules `cv.delete-learner` for every tombstone no job has yet (after an account deletion, a
 * withdrawal, a guardian's withdrawal, and at server start). Returns how many.
 */
export async function scheduleCvDeletions(parts: {
  readonly store: Store;
  readonly scheduler: JobScheduler;
}): Promise<number> {
  const ids = await parts.store.cvJobs().deletionsToSchedule();
  for (const id of ids) {
    await parts.scheduler.schedule({
      kind: CV_DELETE_LEARNER,
      payload: { cvDeletionId: entityId(id) },
      delayMs: 0,
      idempotencyKey: `cv-delete:${id}`,
      maxAttempts: CV_JOB_ATTEMPTS,
    });
  }
  return ids.length;
}

// ── Sources (§3.3): the learner's own confirmed rows, catalogue names with their verification ──

function catalogueName(
  record: (Provenance & { readonly name: string }) | undefined,
  today: Date,
): CatalogueName | null {
  if (!record) return null;
  return { name: record.name, verified: isPublishable(record, today) };
}

/**
 * What a CV is built from, read as the learner (under their consent): their first name and school
 * from the profile, their latest confirmed report, their accepted offer, their confirmed modules
 * and their own entries. A catalogue name comes with whether its record is verified, so
 * `buildCvProfile` can leave an unverified one off (hard rule 3).
 */
export async function cvSources(
  student: StudentStore,
  view: CatalogueView,
  today: Date,
): Promise<CvSources> {
  const [profile, report, offers, registration, entries] = await Promise.all([
    student.profile(),
    student.latestReport(),
    student.offers(),
    student.registration(),
    student.cvEntries(),
  ]);
  const accepted = offers.find((o) => o.status === 'accepted') ?? null;
  const year = Number(today.toISOString().slice(0, 4));
  const grade = profile?.grade ?? null;
  const curriculum = registration
    ? curriculumFor(view, registration.programmeId, registration.academicYear)
    : undefined;
  const curriculumVerified = curriculum ? isPublishable(curriculum, today) : false;
  return {
    firstName: profile?.displayName ?? null,
    schoolName: profile?.schoolName ?? null,
    schoolEndYear: grade && !profile?.schoolFinished ? year + (12 - grade) : null,
    report: report
      ? {
          id: report.id,
          confirmed: true,
          marks: report.marks.flatMap((m) =>
            isSubjectId(m.subject)
              ? [{ subjectId: m.subject, subjectName: subject(m.subject).name, percent: m.percent }]
              : [],
          ),
        }
      : null,
    acceptedOffer: accepted
      ? {
          id: accepted.id,
          confirmed: true,
          universityId: accepted.universityId,
          programmeId: accepted.programmeId,
          institution: catalogueName(
            universityById(view, accepted.universityId as UniversityId),
            today,
          ),
          programme: catalogueName(programmeById(view, accepted.programmeId), today),
          startYear: null,
        }
      : null,
    registrations: registration
      ? [
          {
            id: registration.id,
            confirmed: true,
            universityId: registration.universityId,
            programmeId: registration.programmeId,
            academicYear: registration.academicYear,
            institution: catalogueName(
              universityById(view, registration.universityId as UniversityId),
              today,
            ),
            programme: catalogueName(programmeById(view, registration.programmeId), today),
            modules: registration.modules.map((m) => {
              const listed = curriculum?.modules.find(
                (c) => normaliseModuleCode(c.code) === normaliseModuleCode(m.code),
              );
              return {
                code: m.code,
                name: m.name,
                catalogueName: listed ? { name: listed.name, verified: curriculumVerified } : null,
                term: m.term,
                credits: m.credits,
              };
            }),
          },
        ]
      : [],
    entries,
  };
}

// ── The jobs ────────────────────────────────────────────────────────────────────────────────────

/** A learner whose consent no longer covers the CV: the row is closed, nothing is sent. */
function isConsentGone(error: unknown): boolean {
  return error instanceof ConsentRequiredError || error instanceof CvConsentError;
}

export function cvJobHandlers(parts: CvJobParts): JobHandler[] {
  const clock = parts.clock ?? (() => new Date());
  const jobs = parts.store.cvJobs();

  /** The learner a CV belongs to, as their own store, or null when they're gone. */
  const learnerOf = async (documentId: string) => {
    const studentId = await jobs.ownerOfDocument(documentId);
    return studentId ? parts.store.forStudent(studentId) : null;
  };

  /** After the last attempt, or on a refusal that won't change, the CV couldn't be made. */
  const giveUp = async (documentId: string, error: CvEngineError, attempt: number) => {
    if (error.retryable && attempt < CV_JOB_ATTEMPTS) throw error;
    await jobs.closeDocument(documentId, error.code);
  };

  /**
   * A 429 with Retry-After is a fresh attempt at that time, not a spent one (§5.3). True when it
   * was rescheduled.
   */
  const later = async (
    kind: typeof CV_SUBMIT | typeof CV_COLLECT,
    documentId: string,
    error: unknown,
  ): Promise<boolean> => {
    if (!(error instanceof CvEngineError) || error.status !== 429 || !error.retryAfterMs) {
      return false;
    }
    const runAt = new Date(clock().getTime() + error.retryAfterMs);
    await parts.scheduler.schedule({
      kind,
      payload: { cvDocumentId: entityId(documentId) },
      runAt,
      idempotencyKey: `${kind.name}:${documentId}:${runAt.toISOString().toLowerCase()}`,
      maxAttempts: CV_JOB_ATTEMPTS,
    });
    return true;
  };

  const submit = handle(CV_SUBMIT, async ({ cvDocumentId }, { attempt }) => {
    const student = await learnerOf(cvDocumentId);
    if (!student) return;
    let submission: Awaited<ReturnType<StudentStore['cvSubmission']>>;
    let sources: CvSources;
    let selection: Awaited<ReturnType<StudentStore['cvSelection']>>;
    try {
      submission = await student.cvSubmission(cvDocumentId, parts.access);
      if (!submission || submission.document.status !== 'queued') return;
      sources = await cvSources(student, parts.catalogue(clock()), clock());
      selection = await student.cvSelection();
    } catch (error) {
      if (isConsentGone(error)) {
        await jobs.closeDocument(cvDocumentId, 'consent_required');
        return;
      }
      throw error;
    }
    // Rebuilt from the rows now (§11): what was ticked when the job runs.
    const built = buildCvProfile(sources, selection);
    if (!built.ready) {
      await jobs.closeDocument(cvDocumentId, 'validation_failed');
      return;
    }
    const request: CvDraftRequest = {
      learnerRef: submission.link.learnerRef,
      consent: {
        ref: submission.link.id,
        version: submission.link.consentVersion,
        purposes: submission.link.purposes,
        ageBand: submission.ageBand,
      },
      profile: built.profile,
      render: DEFAULT_RENDER,
    };
    let jobId: string;
    try {
      const answer =
        submission.advert && submission.document.kind === 'tailored'
          ? await parts.engine.tailor({ ...request, job: submission.advert }, cvDocumentId)
          : await parts.engine.createDraft(request, cvDocumentId);
      jobId = answer.jobId;
    } catch (error) {
      if (await later(CV_SUBMIT, cvDocumentId, error)) return;
      if (error instanceof CvEngineError) return giveUp(cvDocumentId, error, attempt);
      throw error;
    }
    await student.markCvSubmitted(cvDocumentId, jobId, parts.access);
    // Webhook first, polling as a backstop (§5.3), and the day's last look.
    const now = clock().getTime();
    for (const delay of CV_POLL_DELAYS_MS) {
      await parts.scheduler.schedule({
        kind: CV_POLL,
        payload: { cvDocumentId },
        runAt: new Date(now + delay),
        idempotencyKey: `cv-poll:${cvDocumentId}:m${delay / 60_000}`,
        maxAttempts: 3,
      });
    }
    await parts.scheduler.schedule({
      kind: CV_EXPIRE,
      payload: { cvDocumentId },
      runAt: new Date(now + CV_EXPIRE_AFTER_MS),
      idempotencyKey: `cv-expire:${cvDocumentId}`,
      maxAttempts: 3,
    });
  });

  /**
   * Collects a finished CV: idempotent (a webhook and a poll may both come). The PDF is fetched from
   * the engine's short link, its hash checked, kept in our own files (S3 in af-south-1), the result
   * stored with the advert's text let go (D13), and the engine told to delete its copy (ack).
   */
  const collect = async (cvDocumentId: string, attempt: number) => {
    const state = await jobs.stateOf(cvDocumentId);
    if (!state || state.status !== 'submitted' || !state.engineJobId) return;
    const student = await learnerOf(cvDocumentId);
    if (!student) return;
    let learnerRef: string;
    try {
      // Under the learner's consent as it is now: gone, and nothing is collected.
      const submission = await student.cvSubmission(cvDocumentId, parts.access);
      if (!submission) return;
      learnerRef = submission.link.learnerRef;
    } catch (error) {
      if (isConsentGone(error)) {
        await jobs.closeDocument(cvDocumentId, 'consent_required');
        return;
      }
      throw error;
    }
    let job: Awaited<ReturnType<CvEngine['getJob']>>;
    try {
      job = await parts.engine.getJob(state.engineJobId, learnerRef);
    } catch (error) {
      if (await later(CV_COLLECT, cvDocumentId, error)) return;
      if (error instanceof CvEngineError) return giveUp(cvDocumentId, error, attempt);
      throw error;
    }
    if (job.status === 'queued' || job.status === 'running') return;
    if (job.status !== 'succeeded' || !job.result) {
      await jobs.closeDocument(
        cvDocumentId,
        job.problem?.code ?? (job.status === 'expired' ? 'expired' : 'server_error'),
      );
      return;
    }
    const result = job.result;
    const bytes = await parts.engine.fetchPdf(result.pdf.url);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    // A PDF that isn't the one advertised is never kept: the next try gets a fresh link.
    if (sha256 !== result.pdf.sha256 || bytes.byteLength !== result.pdf.bytes) {
      throw new CvEngineError('bad_response', 0, true);
    }
    const fileKey = `cv-${randomBytes(16).toString('hex')}`;
    await parts.files.put(fileKey, { bytes, mimeType: 'application/pdf' });
    let kept: boolean;
    try {
      kept = await student.storeCvResult(
        cvDocumentId,
        {
          markdown: result.markdown,
          gaps: result.gaps,
          ats: result.ats,
          fileKey,
          sha256,
          bytes: bytes.byteLength,
        },
        parts.access,
      );
    } catch (error) {
      await parts.files.delete(fileKey);
      throw error;
    }
    if (!kept) {
      await parts.files.delete(fileKey);
      return;
    }
    try {
      await parts.engine.ack(state.engineJobId, learnerRef);
    } catch (error) {
      // The engine deletes it within the day anyway (§5.3). The code only.
      console.error(`cv.collect: ack not sent (${(error as CvEngineError)?.code ?? 'error'})`);
    }
  };

  const poll = handle(CV_POLL, async ({ cvDocumentId }, { attempt }) =>
    collect(cvDocumentId, attempt),
  );
  const collected = handle(CV_COLLECT, async ({ cvDocumentId }, { attempt }) =>
    collect(cvDocumentId, attempt),
  );

  const expire = handle(CV_EXPIRE, async ({ cvDocumentId }, { attempt }) => {
    await collect(cvDocumentId, attempt);
    const state = await jobs.stateOf(cvDocumentId);
    if (state?.status === 'submitted' || state?.status === 'queued') {
      await jobs.closeDocument(cvDocumentId, 'timeout');
    }
  });

  /** Carries a tombstone to the engine until it confirms (§7.3). */
  const deleteLearner = handle(CV_DELETE_LEARNER, async ({ cvDeletionId }, { attempt }) => {
    const deletion = await jobs.deletion(cvDeletionId);
    if (!deletion || deletion.confirmedAt) return;
    const askAgain = async () => {
      const runAt = new Date(clock().getTime() + DELETION_RECHECK_MS);
      await parts.scheduler.schedule({
        kind: CV_DELETE_LEARNER,
        payload: { cvDeletionId },
        runAt,
        idempotencyKey: `cv-delete:${cvDeletionId}:${runAt.toISOString().toLowerCase()}`,
        maxAttempts: CV_JOB_ATTEMPTS,
      });
    };
    try {
      let engineId = deletion.engineDeletionId;
      if (!engineId) {
        engineId = (await parts.engine.deleteLearner(deletion.learnerRef)).deletionId;
        await jobs.noteDeletionRequested(cvDeletionId, engineId);
      }
      const status = await parts.engine.getDeletion(engineId);
      if (status.status === 'completed') await jobs.confirmDeletion(cvDeletionId);
      else await askAgain();
    } catch (error) {
      // Retried until the engine confirms: with backoff, then a fresh job (never given up).
      if (error instanceof CvEngineError && error.retryable && attempt < CV_JOB_ATTEMPTS)
        throw error;
      if (
        error instanceof CvEngineError &&
        error.code === 'not_found' &&
        !deletion.engineDeletionId
      ) {
        // Nothing held for this reference: nothing to delete.
        await jobs.confirmDeletion(cvDeletionId);
        return;
      }
      await askAgain();
    }
  });

  return [submit, poll, collected, expire, deleteLearner];
}

// ── The webhook (§5.3, §11) ─────────────────────────────────────────────────────────────────────

export interface CvWebhookParts {
  readonly store: Store;
  readonly engine: CvEngine;
  readonly scheduler: JobScheduler;
  readonly clock?: () => Date;
}

/**
 * A webhook from the engine: signed for `mmereko` (forged, stale, altered or other-channel ones
 * refused), seen once only inside its window (A5-06), ids only. A job's news schedules
 * `cv.collect` for its CV; an unknown job is answered 200 and ignored (it may come before our row
 * is written; the poll finds it). A deletion's news needs nothing: `cv.delete-learner` asks.
 */
export async function receiveCvWebhook(
  parts: CvWebhookParts,
  request: { readonly headers: { get(name: string): string | null }; readonly body: string },
): Promise<{ readonly ok: true } | { readonly ok: false; readonly status: 400 | 401 }> {
  if (Buffer.byteLength(request.body) > MAX_CV_WEBHOOK_BYTES) return { ok: false, status: 400 };
  const now = (parts.clock ?? (() => new Date()))();
  const verified = parts.engine.verifyWebhook(request.headers, request.body, now);
  if (!verified) return { ok: false, status: 401 };
  // Counted as it is checked, under one lock, so two copies racing in can't both pass.
  if (
    !(await parts.store.allow('cv-webhook-seen', verified.replayKey, 1, verified.replayWindowMs))
  ) {
    return { ok: false, status: 401 };
  }
  const { event } = verified;
  if (event.jobId) {
    const documentId = await parts.store.cvJobs().documentForEngineJob(event.jobId);
    if (documentId) {
      await parts.scheduler.schedule({
        kind: CV_COLLECT,
        payload: { cvDocumentId: entityId(documentId) },
        delayMs: 0,
        idempotencyKey: `cv-collect:${documentId}:${event.id.toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
        maxAttempts: CV_JOB_ATTEMPTS,
      });
    }
  }
  return { ok: true };
}

// ── 60-second signed PDF links (§9.3, §10.3) ────────────────────────────────────────────────────

/** How long a signed PDF link works. */
export const CV_PDF_LINK_SECONDS = 60;

/**
 * The PDF links' own key (CV-A5 A5-22): HKDF-SHA256 of AUTH_SECRET with a `cv-pdf` label, so the
 * links and the session secret's other uses never share a key. Changing it voids live links, which
 * last 60 seconds. Derived once per secret.
 */
const pdfKeys = new Map<string, Buffer>();
function pdfKey(secret: string): Buffer {
  let key = pdfKeys.get(secret);
  if (!key) {
    key = Buffer.from(hkdfSync('sha256', secret, '', 'universityflow:cv-pdf-link:v1', 32));
    pdfKeys.clear();
    pdfKeys.set(secret, key);
  }
  return key;
}

function pdfSignature(secret: string, documentId: string, expires: number): string {
  return createHmac('sha256', pdfKey(secret))
    .update(`cv-pdf:${documentId}:${expires}`)
    .digest('hex');
}

/** A link to a ready CV's PDF that works for 60 seconds, for its owner or a share link. */
export function signedPdfLink(
  publicUrl: string,
  secret: string,
  documentId: string,
  now: Date,
): { readonly url: string; readonly expiresAt: string } {
  const expires = Math.floor(now.getTime() / 1000) + CV_PDF_LINK_SECONDS;
  const sig = pdfSignature(secret, documentId, expires);
  return {
    url: `${publicUrl}/api/cv/pdf/${documentId}?exp=${expires}&sig=${sig}`,
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}

/** Whether a signed PDF link is genuine and still live. Constant-time compare. */
export function verifyPdfLink(
  secret: string,
  documentId: string,
  exp: string | null,
  sig: string | null,
  now: Date,
): boolean {
  if (!exp || !sig || !/^\d{1,12}$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const expires = Number(exp);
  const seconds = now.getTime() / 1000;
  if (expires < seconds || expires > seconds + CV_PDF_LINK_SECONDS + 5) return false;
  const expected = Buffer.from(pdfSignature(secret, documentId, expires), 'hex');
  return timingSafeEqual(expected, Buffer.from(sig, 'hex'));
}

/** How many times a CV's PDF delete is tried, and the pause before each retry. */
export const CV_FILE_DELETE_DELAYS_MS = [100, 400] as const;

/**
 * Deletes a CV's PDF after its row is gone (CV5-02), trying again on a failure: S3 deletes are
 * idempotent, so a retry is safe, and a moment's storage blip no longer leaves an unreferenced
 * file. A failure on the last try is thrown (the learner sees an error; the file's key is not
 * logged). A sweep of unreferenced `cv-*` keys would also cover a lasting outage, but needs a
 * listing on every file store and the bucket's list permission: recorded, not built.
 */
export async function deleteWithRetry(
  files: Pick<FileStore, 'delete'>,
  key: string,
  delays: ReadonlyArray<number> = CV_FILE_DELETE_DELAYS_MS,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await files.delete(key);
      return;
    } catch (error) {
      const delay = delays[attempt];
      if (delay === undefined) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** The learner's own CV, or 404: another learner's is simply not there. */
export async function ownCv(student: StudentStore, id: string) {
  const doc = await student.cvDocument(id);
  if (!doc) throw new NotFoundError('No such CV');
  return doc;
}
