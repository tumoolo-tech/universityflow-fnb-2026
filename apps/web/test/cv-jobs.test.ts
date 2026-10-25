import { createHash } from 'node:crypto';
import { catalogueView } from '@universityflow/catalogue';
import { MemoryCvEngine, MMEREKO_SIGNATURE_HEADER, signCvWebhook } from '@universityflow/cv';
import {
  type Database,
  migrate,
  openDatabase,
  PostgresJobScheduler,
  Store,
} from '@universityflow/db';
import { MemoryFileStore } from '@universityflow/documents';
import type { JobKind, JobScheduler, ScheduleOptions } from '@universityflow/jobs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  CV_EXPIRE_AFTER_MS,
  CV_POLL_DELAYS_MS,
  cvJobHandlers,
  receiveCvWebhook,
  scheduleCvDeletions,
  scheduleCvDocument,
} from '../lib/server/cv';

/**
 * My CV's jobs (docs/design/mmereko-api-proposal.md §5.3, §7.3): `cv.submit` re-reads the CV and
 * the learner's consent when it runs and sends the envelope; `cv.poll` (+2, +10, +60 minutes) and
 * the webhook both lead to `cv.collect`, which checks the PDF's hash, keeps it in our own files,
 * stores the result and acknowledges; `cv.expire` closes a CV the engine never finished;
 * `cv.delete-learner` carries a tombstone to the engine until it confirms. Retries with backoff,
 * `Retry-After` honoured without spending an attempt, a 4xx closes the CV. Payloads are ids only
 * (hard rule 4). Synthetic learners only.
 */

vi.mock('server-only', () => ({}));

const WEBHOOK = 'cv-jobs-test-webhook-secret-of-32-chars-plus';
const PREVIEW = { preview: true } as const;
const START = new Date('2026-10-23T08:00:00Z');
let n = 6_200_000;
const phone = () => `+2782${String(n++).padStart(7, '0')}`;

let now = START;
const clock = () => now;
let database: Database;
let store: Store;
beforeAll(async () => {
  database = openDatabase('pglite:memory');
  await migrate(database);
  store = new Store(database, { secret: 'x'.repeat(48), clock });
});
afterAll(async () => {
  await database.close();
});
afterEach(async () => {
  now = START;
  // Each test starts with an empty queue and no tombstones: runDue runs every due job.
  await database.exec('delete from jobs; delete from cv_deletions;');
});

interface Scheduled {
  readonly kind: string;
  readonly payload: object;
  readonly runAt: Date;
}

function setUp(engine = new MemoryCvEngine({ webhookSecret: WEBHOOK, clock })) {
  const inner = new PostgresJobScheduler(database, { clock });
  const scheduled: Scheduled[] = [];
  const scheduler: JobScheduler = {
    async schedule<K extends JobKind>(options: ScheduleOptions<K>) {
      const job = await inner.schedule(options);
      if (job.created)
        scheduled.push({ kind: options.kind.name, payload: options.payload, runAt: job.runAt });
      return job;
    },
    cancel: (id) => inner.cancel(id),
    get: (id) => inner.get(id),
  };
  const files = new MemoryFileStore();
  const handlers = cvJobHandlers({
    store,
    engine,
    files,
    scheduler,
    catalogue: () => catalogueView(now, { includeDrafts: true }),
    access: PREVIEW,
    clock,
  });
  const run = () => inner.runDue(handlers);
  const parts = { store, engine, scheduler, clock };
  return { engine, scheduler, scheduled, files, run, parts };
}

async function signedIn(dateOfBirth: string) {
  const number = phone();
  const challenge = await store.requestOtp(number);
  if (challenge.review) throw new Error('unexpected');
  const { studentId } = await store.verifyOtp(number, challenge.code);
  await store.setDateOfBirth(studentId, dateOfBirth);
  return studentId;
}

async function ready(studentId: string) {
  const student = store.forStudent(studentId);
  await student.updateProfile({
    displayName: 'Thandi',
    schoolName: 'Example High School',
    grade: 12,
  });
  await student.cvOptIn(
    { version: 'cv-optin-v1', purposes: ['cv.draft', 'cv.tailor', 'cv.ats'] },
    PREVIEW,
  );
  await student.saveCvSelection(
    {
      surname: 'Example',
      label: null,
      summary: null,
      email: null,
      phone: null,
      city: null,
      region: null,
      includeSchool: true,
      subjectIds: [],
      includeOffer: false,
      moduleCodes: [],
      entryIds: [],
    },
    PREVIEW,
  );
  return { studentId, student };
}

async function adult() {
  const studentId = await signedIn('2000-01-15');
  await store.consentAsAdult(studentId, 'adult-v2-test');
  return ready(studentId);
}

async function minor() {
  const studentId = await signedIn('2010-03-03');
  const { token } = await store.requestGuardianConsent(
    studentId,
    { name: 'Test Guardian', phone: phone(), relationship: 'parent' },
    'v3-test',
  );
  await store.grantConsent(token);
  return { ...(await ready(studentId)), token };
}

const advance = (ms: number) => {
  now = new Date(now.getTime() + ms);
};

/** The engine's job id from the first call a spy saw. */
async function jobIdOf(spy: { mock: { results: ReadonlyArray<{ value: unknown }> } }) {
  const first = spy.mock.results[0];
  if (!first) throw new Error('The CV was not sent');
  return ((await first.value) as { jobId: string }).jobId;
}

describe('cv.submit (§5.3)', () => {
  it('sends the envelope the CV and the opt-in make, and waits for the webhook with polls behind it', async () => {
    const { engine, scheduler, scheduled, run } = setUp();
    const { studentId, student } = await adult();
    const doc = await student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await scheduleCvDocument(scheduler, doc.id);
    const sent = vi.spyOn(engine, 'createDraft');
    await run();
    expect(sent).toHaveBeenCalledTimes(1);
    const [request, key] = sent.mock.calls[0] ?? [];
    expect(key).toBe(doc.id);
    expect(request?.learnerRef).toMatch(/^[0-9a-f-]{36}$/);
    expect(request?.learnerRef).not.toBe(studentId);
    expect(request?.consent).toMatchObject({ version: 'cv-optin-v1', ageBand: '18-plus' });
    expect(request?.profile.basics).toMatchObject({
      name: 'Thandi Example',
      email: null,
      phone: null,
    });
    expect(JSON.stringify(request)).not.toContain(studentId);
    expect((await student.cvDocument(doc.id))?.status).toBe('submitted');
    expect(
      scheduled.filter((j) => j.kind === 'cv.poll').map((j) => j.runAt.getTime() - START.getTime()),
    ).toEqual([...CV_POLL_DELAYS_MS]);
    expect(scheduled.filter((j) => j.kind === 'cv.expire')).toHaveLength(1);
    for (const job of scheduled) expect(Object.keys(job.payload)).toEqual(['cvDocumentId']);
  });

  it('gives nothing to send once the learner’s consent is gone, and closes the CV', async () => {
    const { engine, scheduler, run } = setUp();
    const { student, token } = await minor();
    const doc = await student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await scheduleCvDocument(scheduler, doc.id);
    await store.withdrawConsent(token);
    const sent = vi.spyOn(engine, 'createDraft');
    await run();
    expect(sent).not.toHaveBeenCalled();
    expect(await store.cvJobs().stateOf(doc.id)).toMatchObject({
      status: 'failed',
      problem: 'consent_required',
    });
  });

  it('honours Retry-After on a 429 without spending an attempt', async () => {
    const { engine, scheduler, scheduled, run } = setUp();
    const { student } = await adult();
    const doc = await student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await scheduleCvDocument(scheduler, doc.id);
    engine.failNext('rate_limited', 429, 90_000);
    await run();
    expect((await student.cvDocument(doc.id))?.status).toBe('queued');
    const submits = scheduled.filter((j) => j.kind === 'cv.submit');
    expect(submits.map((j) => j.runAt.getTime() - START.getTime())).toEqual([0, 90_000]);
    advance(90_000);
    await run();
    expect((await student.cvDocument(doc.id))?.status).toBe('submitted');
  });

  it('retries a 5xx with backoff, and closes the CV after the last attempt', async () => {
    const { engine, scheduler, run } = setUp();
    const { student } = await adult();
    const doc = await student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await scheduleCvDocument(scheduler, doc.id);
    for (let i = 0; i < 6; i++) engine.failNext('server_error', 500);
    for (let i = 0; i < 6; i++) {
      await run();
      expect((await store.cvJobs().stateOf(doc.id))?.status).toBe(i < 5 ? 'queued' : 'failed');
      advance(61 * 60_000);
    }
    expect(await store.cvJobs().stateOf(doc.id)).toMatchObject({ problem: 'server_error' });
  });

  it('sends only what the learner ticked: no other entry, mark, profile field, guardian or id (A10, §7.1)', async () => {
    const { engine, scheduler, run } = setUp();
    // A minor with everything else UniversityFlow holds about them: a guardian, a goal in their
    // words, a province, marks, and an entry they did not tick. Each carries a marker.
    const studentId = await signedIn('2010-04-04');
    const guardianPhone = phone();
    const { token } = await store.requestGuardianConsent(
      studentId,
      { name: 'Guardianmarker Sentinel', phone: guardianPhone, relationship: 'parent' },
      'v3-test',
    );
    await store.grantConsent(token);
    const { student } = await ready(studentId);
    await student.updateProfile({ goal: 'Goalmarker in my own words', province: 'gauteng' });
    await student.saveConfirmedReport({
      kind: 'grade-11-final',
      marks: [
        { subject: 'mathematics', percent: 78 },
        { subject: 'english-hl', percent: 66 },
      ],
    });
    const entry = (title: string) => ({
      kind: 'project' as const,
      title,
      organisation: null,
      role: null,
      startDate: null,
      endDate: null,
      description: `${title} description`,
      highlights: [],
      keywords: [],
      evidence: [],
      linkedModules: [],
    });
    const ticked = await student.addCvEntry(entry('Tickedmarker tracker'), PREVIEW);
    await student.addCvEntry(entry('Untickedmarker diary'), PREVIEW);
    await student.saveCvSelection(
      {
        surname: 'Example',
        label: null,
        summary: null,
        email: null,
        phone: null,
        city: null,
        region: null,
        includeSchool: true,
        subjectIds: ['mathematics'],
        includeOffer: false,
        moduleCodes: [],
        entryIds: [ticked.id],
      },
      PREVIEW,
    );
    const doc = await student.requestCvDocument(
      {
        kind: 'tailored',
        advert: { title: 'Junior developer', company: null, text: 'Python and Git.' },
      },
      PREVIEW,
    );
    await scheduleCvDocument(scheduler, doc.id);
    const sent = vi.spyOn(engine, 'tailor');
    await run();
    expect(sent).toHaveBeenCalledTimes(1);
    const [request] = sent.mock.calls[0] ?? [];
    if (!request) throw new Error('The CV was not sent');
    // The envelope and nothing else: the pseudonymous reference, the consent's record, the
    // profile from the ticks, the render options and the advert the learner pasted.
    expect(Object.keys(request).sort()).toEqual([
      'consent',
      'job',
      'learnerRef',
      'profile',
      'render',
    ]);
    expect(request.job).toEqual({
      title: 'Junior developer',
      company: null,
      description: 'Python and Git.',
    });
    expect(request.consent.ageBand).toBe('under-18');
    expect(Object.keys(request.profile).sort()).toEqual([
      'basics',
      'education',
      'projects',
      'schemaVersion',
    ]);
    expect(request.profile.basics).toEqual({ name: 'Thandi Example', email: null, phone: null });
    expect(request.profile.projects?.map((p) => p.name)).toEqual(['Tickedmarker tracker']);
    const text = JSON.stringify(request);
    expect(text).toContain('78%');
    for (const never of [
      studentId,
      ticked.id,
      doc.id,
      'Untickedmarker',
      '66%',
      'Guardianmarker',
      guardianPhone.slice(-7),
      'Goalmarker',
      'gauteng',
      '2010-04-04',
    ]) {
      expect(text).not.toContain(never);
    }
  });

  it('closes the CV at once on a refusal that won’t change (a 4xx)', async () => {
    const { engine, scheduler, run } = setUp();
    const { student } = await adult();
    const doc = await student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await scheduleCvDocument(scheduler, doc.id);
    engine.failNext('consent_required', 403);
    await run();
    expect(await student.cvDocument(doc.id)).toMatchObject({
      status: 'failed',
      problem: 'consent_required',
    });
  });
});

describe('the webhook and cv.collect (§5.3)', () => {
  it('collects on a signed webhook: the PDF checked and kept, the result stored, the job acknowledged', async () => {
    const { engine, scheduler, scheduled, files, run, parts } = setUp();
    const { student } = await adult();
    const doc = await student.requestCvDocument(
      {
        kind: 'tailored',
        advert: { title: 'Junior developer', company: 'Example', text: 'Python and Git.' },
      },
      PREVIEW,
    );
    await scheduleCvDocument(scheduler, doc.id);
    const sent = vi.spyOn(engine, 'tailor');
    await run();
    const jobId = await jobIdOf(sent);
    await engine.complete(jobId);
    const delivery = engine.webhooks.at(-1);
    const request = { headers: new Headers(delivery?.headers), body: delivery?.body ?? '' };
    expect(await receiveCvWebhook(parts, request)).toEqual({ ok: true });
    await run();
    const kept = await student.cvDocument(doc.id);
    expect(kept).toMatchObject({ status: 'ready', hasPdf: true, advertTitle: 'Junior developer' });
    expect(kept?.atsCoverage).toBeGreaterThanOrEqual(0);
    const file = await student.cvFile(doc.id);
    const stored = await files.get(file?.fileKey ?? '');
    expect(
      createHash('sha256')
        .update(stored?.bytes ?? new Uint8Array())
        .digest('hex'),
    ).toBe(file?.sha256);
    expect(stored?.mimeType).toBe('application/pdf');
    const learnerRef = sent.mock.calls[0]?.[0].learnerRef ?? '';
    expect((await engine.getJob(jobId, learnerRef)).status).toBe('expired');
    // The same webhook again is a replay: refused (A5-06).
    expect(await receiveCvWebhook(parts, request)).toEqual({ ok: false, status: 401 });
    // Mmereko re-signs each retry of an event: accepted, and deduplicated by the event's id.
    advance(30_000);
    const retried = {
      headers: new Headers({
        ...delivery?.headers,
        [MMEREKO_SIGNATURE_HEADER]: signCvWebhook(WEBHOOK, delivery?.body ?? '', now),
      }),
      body: delivery?.body ?? '',
    };
    const before = scheduled.length;
    expect(await receiveCvWebhook(parts, retried)).toEqual({ ok: true });
    expect(scheduled.length).toBe(before);
  });

  it('collects by the poll when no webhook comes, once only', async () => {
    const { engine, scheduler, files, run } = setUp(new MemoryCvEngine({ clock }));
    const { student } = await adult();
    const doc = await student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await scheduleCvDocument(scheduler, doc.id);
    const sent = vi.spyOn(engine, 'createDraft');
    await run();
    const jobId = await jobIdOf(sent);
    await engine.complete(jobId);
    const put = vi.spyOn(files, 'put');
    advance(CV_POLL_DELAYS_MS[0] as number);
    await run();
    advance(CV_EXPIRE_AFTER_MS);
    await run();
    expect((await student.cvDocument(doc.id))?.status).toBe('ready');
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('keeps nothing whose hash doesn’t match, and tries again', async () => {
    const { engine, scheduler, run } = setUp(new MemoryCvEngine({ clock }));
    const { student } = await adult();
    const doc = await student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await scheduleCvDocument(scheduler, doc.id);
    const sent = vi.spyOn(engine, 'createDraft');
    await run();
    const jobId = await jobIdOf(sent);
    await engine.complete(jobId);
    vi.spyOn(engine, 'fetchPdf').mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    advance(CV_POLL_DELAYS_MS[0] as number);
    await run();
    expect((await student.cvDocument(doc.id))?.status).toBe('submitted');
    advance(2 * 60_000);
    await run();
    expect((await student.cvDocument(doc.id))?.status).toBe('ready');
  });

  it('closes a CV the engine never finished, a day on', async () => {
    const { scheduler, run } = setUp(new MemoryCvEngine({ clock }));
    const { student } = await adult();
    const doc = await student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await scheduleCvDocument(scheduler, doc.id);
    await run();
    for (const delay of CV_POLL_DELAYS_MS) {
      now = new Date(START.getTime() + delay);
      await run();
    }
    expect((await student.cvDocument(doc.id))?.status).toBe('submitted');
    now = new Date(START.getTime() + CV_EXPIRE_AFTER_MS);
    await run();
    expect(await student.cvDocument(doc.id)).toMatchObject({
      status: 'failed',
      problem: 'timeout',
    });
  });

  it('answers a webhook for an unknown job with 200 and does nothing; refuses an unsigned or other-channel one', async () => {
    const { parts } = setUp();
    const body = JSON.stringify({
      createdAt: now.toISOString(),
      data: { jobId: 'no-such-job', kind: 'cv-draft', learnerRef: 'x', status: 'succeeded' },
      id: 'evt-x',
      type: 'cv.ready',
    });
    const headers = new Headers({ [MMEREKO_SIGNATURE_HEADER]: signCvWebhook(WEBHOOK, body, now) });
    expect(await receiveCvWebhook(parts, { headers, body })).toEqual({ ok: true });
    expect(await receiveCvWebhook(parts, { headers: new Headers(), body })).toEqual({
      ok: false,
      status: 401,
    });
  });
});

describe('cv.delete-learner (§7.3)', () => {
  it('carries a tombstone to the engine until it confirms, with no link to the student', async () => {
    const { engine, scheduler, run } = setUp();
    const { student } = await adult();
    const doc = await student.requestCvDocument({ kind: 'draft' }, PREVIEW);
    await scheduleCvDocument(scheduler, doc.id);
    await run();
    const { deletionIds } = await student.cvWithdraw();
    const remove = vi.spyOn(engine, 'deleteLearner');
    engine.failNext('unavailable', 503);
    expect(await scheduleCvDeletions({ store, scheduler })).toBe(1);
    await run();
    expect(await store.cvJobs().deletion(deletionIds[0] as string)).toMatchObject({
      confirmedAt: null,
    });
    advance(2 * 60_000);
    await run();
    expect(remove).toHaveBeenCalledTimes(2);
    const deletion = await store.cvJobs().deletion(deletionIds[0] as string);
    expect(deletion?.confirmedAt).not.toBeNull();
    expect(engine.jobsFor(remove.mock.calls[0]?.[0] ?? '')).toBe(0);
    expect(await scheduleCvDeletions({ store, scheduler })).toBe(0);
  });
});
