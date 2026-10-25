import { createHash, randomUUID } from 'node:crypto';
import { signWebhook } from '@universityflow/messaging';
import { expect, it } from 'vitest';
import {
  type CvDraftRequest,
  type CvEngine,
  CvEngineError,
  type CvTailorRequest,
  DEFAULT_RENDER,
} from './engine';
import { fixtures, withValue } from './fixtures';

/** The vendored shared contract's fixtures, for an engine's own tests. */
export { fixtures } from './fixtures';

import type { CvProfile } from './profile';
import {
  MMEREKO_EVENT_ID_HEADER,
  MMEREKO_EVENT_TYPE_HEADER,
  MMEREKO_SIGNATURE_HEADER,
  signCvWebhook,
} from './webhook';

/**
 * The contract every CV engine meets (docs/design/mmereko-api-proposal.md §6.3), held to
 * Mmereko's shared contract (packages/cv/contract/): its golden requests (cases.json) and its
 * README's rules. The fake runs it now; the Mmereko adapter runs it against Mmereko's sandbox at
 * integration (an opt-in switch, never in CI by default), and joins `CV_ADAPTERS` only once it
 * passes (D8). So the fake can't promise what Mmereko doesn't do.
 */
export interface CvEngineHarness {
  readonly engine: CvEngine;
  /** Finishes a job: the fake completes it; against the sandbox, waits until it is done. */
  finish(jobId: string, learnerRef: string): Promise<void>;
  /** The webhooks the engine sent, as they arrived; null where they can't be observed. */
  readonly webhooks:
    | (() => ReadonlyArray<{
        readonly headers: Readonly<Record<string, string>>;
        readonly body: string;
      }>)
    | null;
  /** The secret the engine signs its webhooks with. */
  readonly webhookSecret: string;
  now(): Date;
  /** Makes the next call answer 429 with Retry-After; null where it can't be arranged. */
  readonly simulateRateLimit: (() => void) | null;
}

const headersOf = (record: Readonly<Record<string, string>>) => ({
  get: (name: string) => record[name.toLowerCase()] ?? null,
});

function envelope(
  overrides: Omit<Partial<CvDraftRequest>, 'profile'> & { profile?: unknown } = {},
): CvDraftRequest {
  return {
    learnerRef: randomUUID(),
    consent: {
      ref: randomUUID(),
      version: 'v4',
      purposes: ['cv.draft', 'cv.tailor', 'cv.ats'],
      ageBand: 'under-18',
    },
    profile: fixtures.full() as CvProfile,
    render: DEFAULT_RENDER,
    ...overrides,
  } as CvDraftRequest;
}

async function refusal(promise: Promise<unknown>): Promise<CvEngineError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CvEngineError) return error;
    throw error;
  }
  throw new Error('Expected the engine to refuse');
}

function call(engine: CvEngine, path: string, body: Record<string, unknown>): Promise<unknown> {
  if (path === '/cv-drafts') return engine.createDraft(body as never, randomUUID());
  if (path === '/tailorings') return engine.tailor(body as never, randomUUID());
  return engine.atsScan(body as never);
}

export function cvEngineContract(make: () => Promise<CvEngineHarness>): void {
  for (const golden of fixtures.requestCases()) {
    it(`golden request ${golden.id}: ${golden.expect.status}${golden.expect.code ? ` ${golden.expect.code}` : ''}`, async () => {
      const { engine } = await make();
      // Each run gets its own learner: a golden body's fixed reference would collide.
      const body = { ...golden.body };
      if (body['learnerRef'] === '3f0c2a9e-6b7d-4e21-9a0f-1c2d3e4f5a6b') {
        body['learnerRef'] = randomUUID();
      }
      const { expect: want } = golden;
      if (want.status < 300) {
        const answer = (await call(engine, golden.path, body)) as Record<string, unknown>;
        for (const key of want.bodyKeys ?? []) expect(answer).toHaveProperty(key);
        return;
      }
      const error = await refusal(call(engine, golden.path, body));
      expect(error.status).toBe(want.status);
      if (want.code) expect(error.code).toBe(want.code);
      if (want.retryable !== undefined) expect(error.retryable).toBe(want.retryable);
      for (const problem of want.problems ?? []) expect(error.problems).toContainEqual(problem);
      const said = `${error.message} ${JSON.stringify(error.problems)}`;
      for (const value of want.mustNotEcho ?? []) expect(said).not.toContain(value);
    });
  }

  it('makes a base CV: a job, then a PDF with the hash it advertises', async () => {
    const { engine, finish } = await make();
    const request = envelope();
    const submitted = await engine.createDraft(request, randomUUID());
    expect(['queued', 'running']).toContain(submitted.status);
    await finish(submitted.jobId, request.learnerRef);
    const job = await engine.getJob(submitted.jobId, request.learnerRef);
    expect(job).toMatchObject({
      jobId: submitted.jobId,
      kind: 'cv-draft',
      status: 'succeeded',
      learnerRef: request.learnerRef,
      problem: null,
    });
    const result = job.result;
    expect(result?.markdown.length).toBeGreaterThan(0);
    expect(result?.ats).toBeNull();
    expect(Date.parse(result?.pdf.expiresAt ?? '') - Date.now()).toBeLessThanOrEqual(5 * 60_000);
    const pdf = await engine.fetchPdf(result?.pdf.url ?? '');
    expect(createHash('sha256').update(pdf).digest('hex')).toBe(result?.pdf.sha256);
    expect(pdf.byteLength).toBe(result?.pdf.bytes);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('answers a job only to its learner (X-Learner-Ref)', async () => {
    const { engine } = await make();
    const submitted = await engine.createDraft(envelope(), randomUUID());
    expect((await refusal(engine.getJob(submitted.jobId, randomUUID()))).code).toBe('not_found');
  });

  it('makes one job for one idempotency key, and refuses a changed body or route under it', async () => {
    const { engine } = await make();
    const key = randomUUID();
    const request = envelope();
    const first = await engine.createDraft(request, key);
    const again = await engine.createDraft(request, key);
    expect(again.jobId).toBe(first.jobId);
    const changed = withValue(request.profile as Record<string, unknown>, 'basics.name', 'Other');
    const error = await refusal(
      engine.createDraft({ ...request, profile: changed as CvProfile }, key),
    );
    expect(error).toMatchObject({ code: 'idempotency_conflict', status: 409, retryable: false });
    const route = await refusal(engine.tailor({ ...request, job: fixtures.advert() }, key));
    expect(route.code).toBe('idempotency_conflict');
  });

  it('needs a well-formed idempotency key on every write', async () => {
    const { engine } = await make();
    expect((await refusal(engine.createDraft(envelope(), ''))).code).toBe(
      'idempotency_key_required',
    );
    expect((await refusal(engine.createDraft(envelope(), 'short'))).code).toBe(
      'idempotency_key_invalid',
    );
  });

  it('tailors to an advert and scores it', async () => {
    const { engine, finish } = await make();
    const request: CvTailorRequest = { ...envelope(), job: fixtures.advert() };
    const submitted = await engine.tailor(request, randomUUID());
    await finish(submitted.jobId, request.learnerRef);
    const job = await engine.getJob(submitted.jobId, request.learnerRef);
    expect(job).toMatchObject({ kind: 'tailoring', status: 'succeeded' });
    expect(job.result?.ats?.coveragePct).toBeGreaterThanOrEqual(0);
    expect(job.result?.ats?.coveragePct).toBeLessThanOrEqual(100);
  });

  it('refuses an ack while the job runs, and deletes the content once acknowledged', async () => {
    const { engine, finish } = await make();
    const request = envelope();
    const submitted = await engine.createDraft(request, randomUUID());
    const early = await refusal(engine.ack(submitted.jobId, request.learnerRef));
    if (early.code !== 'not_found')
      expect(early).toMatchObject({ code: 'job_not_finished', status: 409 });
    await finish(submitted.jobId, request.learnerRef);
    const url = (await engine.getJob(submitted.jobId, request.learnerRef)).result?.pdf.url ?? '';
    await engine.ack(submitted.jobId, request.learnerRef);
    const job = await engine.getJob(submitted.jobId, request.learnerRef);
    expect(job).toMatchObject({ status: 'expired', result: null });
    expect((await refusal(engine.fetchPdf(url))).status).toBeGreaterThanOrEqual(400);
  });

  it('deletes everything held for a learner, and says so', async () => {
    const { engine, finish } = await make();
    const request = envelope();
    const one = await engine.createDraft(request, randomUUID());
    await finish(one.jobId, request.learnerRef);
    await engine.createDraft(request, randomUUID());
    const { deletionId } = await engine.deleteLearner(request.learnerRef);
    const deletion = await engine.getDeletion(deletionId);
    expect(deletion).toMatchObject({ status: 'completed', learnerRef: request.learnerRef });
    expect((await refusal(engine.getJob(one.jobId, request.learnerRef))).code).toBe('not_found');
    expect((await engine.exportLearner(request.learnerRef)).jobs).toEqual([]);
  });

  it('exports records only: ids, kinds, states and times', async () => {
    const { engine } = await make();
    const request = envelope();
    const submitted = await engine.createDraft(request, randomUUID());
    const exported = await engine.exportLearner(request.learnerRef);
    expect(exported.jobs).toEqual([
      expect.objectContaining({ jobId: submitted.jobId, kind: 'cv-draft' }),
    ]);
    expect(JSON.stringify(exported)).not.toContain(request.profile.basics.name);
  });

  it('signs its webhooks as the contract says, and they are refused when forged, stale, altered or for another channel', async () => {
    const { engine, finish, webhooks, webhookSecret, now } = await make();
    if (!webhooks) return;
    const request = envelope();
    const submitted = await engine.createDraft(request, randomUUID());
    await finish(submitted.jobId, request.learnerRef);
    const sent = webhooks().at(-1);
    expect(sent).toBeDefined();
    if (!sent) return;
    const body = JSON.parse(sent.body);
    expect(Object.keys(body)).toEqual(['createdAt', 'data', 'id', 'type']);
    expect(sent.headers[MMEREKO_EVENT_ID_HEADER]).toBe(body.id);
    expect(sent.headers[MMEREKO_EVENT_TYPE_HEADER]).toBe('cv.ready');
    const verified = engine.verifyWebhook(headersOf(sent.headers), sent.body, now());
    expect(verified?.event).toMatchObject({
      type: 'cv.ready',
      jobId: submitted.jobId,
      learnerRef: request.learnerRef,
    });
    // The same request gives the same replay key (the route refuses it the second time).
    expect(engine.verifyWebhook(headersOf(sent.headers), sent.body, now())?.replayKey).toBe(
      verified?.replayKey,
    );
    const altered = sent.body.replace('cv.ready', 'job.failed');
    expect(engine.verifyWebhook(headersOf(sent.headers), altered, now())).toBeNull();
    const forged = { [MMEREKO_SIGNATURE_HEADER]: signCvWebhook('x'.repeat(40), sent.body, now()) };
    expect(engine.verifyWebhook(headersOf(forged), sent.body, now())).toBeNull();
    const stale = new Date(now().getTime() + 6 * 60_000);
    expect(engine.verifyWebhook(headersOf(sent.headers), sent.body, stale)).toBeNull();
    expect(engine.verifyWebhook(headersOf({}), sent.body, now())).toBeNull();
    const otherChannel = {
      [MMEREKO_SIGNATURE_HEADER]: signWebhook(webhookSecret, 'sms', sent.body, now()),
    };
    expect(engine.verifyWebhook(headersOf(otherChannel), sent.body, now())).toBeNull();
  });

  it('answers 429 with Retry-After', async () => {
    const { engine, simulateRateLimit } = await make();
    if (!simulateRateLimit) return;
    simulateRateLimit();
    const error = await refusal(engine.createDraft(envelope(), randomUUID()));
    expect(error).toMatchObject({ code: 'rate_limited', status: 429, retryable: true });
    expect(error.retryAfterMs).toBeGreaterThan(0);
  });
}
