import { randomUUID } from 'node:crypto';
import {
  type CvDraftRequest,
  CvEngineError,
  DEFAULT_RENDER,
  MMEREKO_SIGNATURE_HEADER,
  signCvWebhook,
} from '@universityflow/cv';
import { cvEngineContract, fixtures } from '@universityflow/cv/contract';
import { signWebhook } from '@universityflow/messaging';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ATS_FLAGS_MAX,
  ATS_WORDS_MAX,
  MAX_CV_PDF_BYTES,
  MmerekoCvEngine,
} from '../lib/server/mmereko';
import { FakeMmereko } from './fake-mmereko';

/**
 * The Mmereko adapter (docs/design/mmereko-api-proposal.md §2, §4, §5) against a local fake that
 * implements §2 exactly (test/fake-mmereko.ts): it passes the CV engine contract, caches its
 * token, rotates secrets, sends an idempotency key on every POST, maps problems (codes, retryable,
 * Retry-After, paths, never values), times out, keeps our token to Mmereko's own origin, and
 * verifies webhooks for the `mmereko` channel with either live secret. Synthetic data only.
 */

vi.mock('server-only', () => ({}));

const CLIENT = 'uf-test';
const SECRET = 'client-secret-for-the-fake-at-least-32-chars';
const NEXT_SECRET = 'next-client-secret-for-the-fake-at-least-32';
const WEBHOOK = 'webhook-secret-for-the-fake-at-least-32-chars';
const WEBHOOK_NEXT = 'next-webhook-secret-for-the-fake-at-least-32';

let fake: FakeMmereko;
beforeAll(async () => {
  fake = await new FakeMmereko({
    clientId: CLIENT,
    secrets: [SECRET],
    webhookSecret: WEBHOOK,
  }).start();
});
afterAll(async () => {
  await fake.stop();
});
afterEach(() => {
  fake.setSecrets([SECRET]);
  fake.answerWith({});
});

function adapter(overrides: Partial<ConstructorParameters<typeof MmerekoCvEngine>[0]> = {}) {
  return new MmerekoCvEngine({
    apiUrl: fake.url,
    clientId: CLIENT,
    clientSecret: SECRET,
    webhookSecrets: [WEBHOOK],
    ...overrides,
  });
}

function draft(): CvDraftRequest {
  return {
    learnerRef: randomUUID(),
    consent: {
      ref: randomUUID(),
      version: 'cv-optin-v1',
      purposes: ['cv.draft', 'cv.tailor', 'cv.ats'],
      ageBand: '18-plus',
    },
    profile: {
      schemaVersion: 'uf-cv-profile/1.0',
      basics: { name: 'Thandi Example', email: null, phone: null },
      education: [{ institution: 'Example High School', xSource: 'learner' }],
    },
    render: DEFAULT_RENDER,
  };
}

async function refusal(promise: Promise<unknown>): Promise<CvEngineError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CvEngineError) return error;
    throw error;
  }
  throw new Error('Expected a refusal');
}

describe('the Mmereko adapter meets the CV engine contract (against the local fake)', () => {
  cvEngineContract(async () => {
    const engine = adapter();
    return {
      engine,
      finish: (jobId) => fake.complete(jobId),
      webhooks: () => fake.engine.webhooks,
      webhookSecret: WEBHOOK,
      now: () => new Date(),
      simulateRateLimit: () => fake.failNext(429, 'rate_limited', '30'),
    };
  });
});

describe('auth (§4.1, D12)', () => {
  it('caches its token, and asks again a minute before it expires', async () => {
    let now = new Date('2026-10-23T08:00:00Z');
    const engine = adapter({ clock: () => now });
    const before = fake.tokenRequests;
    await engine.createDraft(draft(), randomUUID());
    await engine.createDraft(draft(), randomUUID());
    expect(fake.tokenRequests - before).toBe(1);
    now = new Date(now.getTime() + 9 * 60_000 + 1);
    await engine.createDraft(draft(), randomUUID());
    expect(fake.tokenRequests - before).toBe(2);
  });

  it('asks for a new token once when Mmereko refuses the cached one', async () => {
    const engine = adapter();
    await engine.createDraft(draft(), randomUUID());
    fake.revokeTokens();
    const before = fake.tokenRequests;
    await engine.createDraft(draft(), randomUUID());
    expect(fake.tokenRequests - before).toBe(1);
  });

  it('carries a secret rotation: the next secret when the current one is refused', async () => {
    fake.setSecrets([NEXT_SECRET]);
    const engine = adapter({ clientSecretNext: NEXT_SECRET });
    await expect(engine.createDraft(draft(), randomUUID())).resolves.toMatchObject({
      status: 'queued',
    });
    const without = adapter();
    expect((await refusal(without.createDraft(draft(), randomUUID()))).code).toBe('invalid_client');
  });
});

describe('the envelope (§2, §5.1)', () => {
  it('sends the checked envelope as JSON with an idempotency key on every POST', async () => {
    const engine = adapter();
    const key = randomUUID();
    const request = draft();
    const from = fake.requests.length;
    const { jobId } = await engine.createDraft(request, key);
    await fake.complete(jobId);
    await engine.getJob(jobId, request.learnerRef);
    await engine.ack(jobId, request.learnerRef);
    const sent = fake.requests.slice(from).filter((r) => r.path !== '/oauth/token');
    const post = sent.find((r) => r.path === '/cv-drafts');
    expect(post?.headers['idempotency-key']).toBe(key);
    expect(post?.headers['content-type']).toBe('application/json');
    expect(JSON.parse(post?.body ?? '{}')).toEqual(request);
    for (const r of sent.filter((s) => s.method === 'POST')) {
      expect(r.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    }
    // A job and its ack are asked about as its learner.
    for (const r of sent.filter((s) => s.path.startsWith('/jobs/'))) {
      expect(r.headers['x-learner-ref']).toBe(request.learnerRef);
    }
    // A bearer token, never the client secret, on the API.
    expect(sent.every((r) => r.headers['authorization']?.startsWith('Bearer '))).toBe(true);
  });

  it('refuses an ID number before anything leaves (the same check Mmereko makes)', async () => {
    const engine = adapter();
    const request = draft();
    const id = ['8', '0', '0', '1', '0', '1', '5', '0', '0', '9', '0', '8', '7'].join('');
    const from = fake.requests.length;
    const error = await refusal(
      engine.createDraft(
        {
          ...request,
          profile: {
            ...request.profile,
            basics: { ...request.profile.basics, summary: `ID ${id}` },
          },
        },
        randomUUID(),
      ),
    );
    expect(error.code).toBe('validation_failed');
    expect(fake.requests.slice(from).filter((r) => r.path === '/cv-drafts')).toEqual([]);
  });
});

describe('problems (RFC 9457) and retries (§5.3)', () => {
  it('reads the code, retryable and Retry-After (seconds or a date), never a body', async () => {
    const engine = adapter();
    fake.failNext(429, 'rate_limited', '30');
    expect(await refusal(engine.createDraft(draft(), randomUUID()))).toMatchObject({
      code: 'rate_limited',
      status: 429,
      retryable: true,
      retryAfterMs: 30_000,
    });
    const at = new Date(Date.now() + 120_000).toUTCString();
    fake.failNext(503, 'unavailable', at);
    const later = await refusal(engine.createDraft(draft(), randomUUID()));
    expect(later).toMatchObject({ code: 'unavailable', retryable: true });
    expect(later.retryAfterMs).toBeGreaterThan(100_000);
    fake.failNext(500, 'server_error');
    expect(await refusal(engine.getJob('job-1', randomUUID()))).toMatchObject({
      status: 500,
      retryable: true,
    });
    fake.failNext(404, 'not_found');
    expect(await refusal(engine.getJob('job-1', randomUUID()))).toMatchObject({
      code: 'not_found',
      retryable: false,
    });
  });

  it('times out a call that takes too long, as retryable', async () => {
    const engine = adapter({ timeouts: { requestMs: 200 } });
    await engine.exportLearner(randomUUID());
    fake.failNext(0, 'timeout', undefined, 1000);
    expect(await refusal(engine.exportLearner(randomUUID()))).toMatchObject({
      code: 'timeout',
      retryable: true,
    });
  });

  it('turns an unreachable Mmereko into a retryable network problem', async () => {
    const engine = adapter({ apiUrl: 'http://127.0.0.1:9/partner/v1' });
    expect(await refusal(engine.getJob('job-1', randomUUID()))).toMatchObject({
      code: 'network',
      retryable: true,
    });
  });

  it('logs a deprecation notice with the route only (§5.4)', async () => {
    const notices: unknown[] = [];
    const engine = adapter({ onDeprecation: (n) => notices.push(n) });
    fake.answerWith({ deprecation: '@1767225600', sunset: 'Fri, 01 Jan 2027 00:00:00 GMT' });
    await engine.exportLearner(randomUUID());
    expect(notices).toEqual([{ route: 'export', sunset: 'Fri, 01 Jan 2027 00:00:00 GMT' }]);
  });
});

describe('PDF links (§5.3)', () => {
  it('never sends our token to another origin, and refuses a plain-http one', async () => {
    const calls: Array<{ url: string; auth: string | null }> = [];
    const spy: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(input), auth: headers.get('authorization') });
      if (String(input).includes('/oauth/token')) {
        return Response.json({ access_token: 't', token_type: 'Bearer', expires_in: 600 });
      }
      return new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 });
    };
    const engine = adapter({ apiUrl: 'https://partner.mmereko.example/partner/v1', fetch: spy });
    await engine.fetchPdf('https://bucket.storage.example/cv.pdf?sig=x');
    expect(calls.find((c) => c.url.startsWith('https://bucket'))?.auth).toBeNull();
    await engine.fetchPdf('https://partner.mmereko.example/partner/v1/pdf/abc');
    expect(calls.find((c) => c.url.includes('/pdf/abc'))?.auth).toBe('Bearer t');
    expect((await refusal(engine.fetchPdf('http://bucket.storage.example/cv.pdf'))).code).toBe(
      'bad_response',
    );
  });
});

describe('webhooks (§4.1, §12 item 6)', () => {
  it('verifies Mmereko’s golden vector, and reads its job', () => {
    const vector = fixtures.vector();
    const engine = adapter({ webhookSecrets: [vector.secret] });
    const verified = engine.verifyWebhook(
      { get: (n: string) => (n === MMEREKO_SIGNATURE_HEADER ? vector.header : null) },
      vector.body,
      new Date(vector.timestamp * 1000 + 30_000),
    );
    expect(verified?.event).toMatchObject({
      type: 'cv.ready',
      jobId: '6a1d9c0e-3b4f-4a5e-8c7d-9e0f1a2b3c4d',
    });
  });

  // Mmereko's event body: compact JSON, keys sorted (contract README, "Webhooks").
  const body = JSON.stringify({
    createdAt: '2026-10-23T08:00:00Z',
    data: { jobId: 'job-1', kind: 'cv-draft', learnerRef: randomUUID(), status: 'succeeded' },
    id: 'evt-1',
    type: 'cv.ready',
  });
  const at = new Date('2026-10-23T08:00:00Z');
  const headers = (header: string) => ({
    get: (n: string) => (n === MMEREKO_SIGNATURE_HEADER ? header : null),
  });

  it('takes either live secret during a rotation', () => {
    const engine = adapter({ webhookSecrets: [WEBHOOK, WEBHOOK_NEXT] });
    expect(
      engine.verifyWebhook(headers(signCvWebhook(WEBHOOK, body, at)), body, at)?.event.jobId,
    ).toBe('job-1');
    expect(
      engine.verifyWebhook(headers(signCvWebhook(WEBHOOK_NEXT, body, at)), body, at),
    ).not.toBeNull();
  });

  it('refuses forged, stale, altered, other-channel and unsigned ones', () => {
    const engine = adapter();
    const good = signCvWebhook(WEBHOOK, body, at);
    expect(
      engine.verifyWebhook(headers(signCvWebhook('f'.repeat(40), body, at)), body, at),
    ).toBeNull();
    expect(
      engine.verifyWebhook(headers(good), body, new Date(at.getTime() + 6 * 60_000)),
    ).toBeNull();
    expect(engine.verifyWebhook(headers(good), body.replace('job-1', 'job-2'), at)).toBeNull();
    expect(
      engine.verifyWebhook(headers(signWebhook(WEBHOOK, 'sms', body, at)), body, at),
    ).toBeNull();
    expect(engine.verifyWebhook({ get: () => null }, body, at)).toBeNull();
  });
});

/**
 * CV-A5 (docs/audits/results/CV-A5.md): what Mmereko answers is held to Mmereko's own host, to a
 * size, to a PDF, and to the job and learner asked about, so a fault or a compromise on the
 * operator's side can't steer our server elsewhere, exhaust it, or put one learner's CV in
 * another's record.
 */
describe('CV-A5: what Mmereko answers is bounded and checked', () => {
  const API = 'https://partner.mmereko.example/partner/v1';
  type Answer = (url: string, init: RequestInit | undefined) => Response;
  function spied(answer: Answer) {
    const calls: string[] = [];
    const spy: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/oauth/token')) {
        return Response.json({ access_token: 't', token_type: 'Bearer', expires_in: 600 });
      }
      return answer(url, init);
    };
    return { calls, engine: adapter({ apiUrl: API, fetch: spy }) };
  }
  const PDF = new TextEncoder().encode('%PDF-1.4\n%synthetic\n');

  /** A body of `total` bytes in 64 KB chunks, no content-length, counting what was read. */
  function counted(total: number) {
    const chunk = new Uint8Array(64 * 1024).fill(32);
    const read = { bytes: 0 };
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (read.bytes >= total) {
          controller.close();
          return;
        }
        read.bytes += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    return { stream, read };
  }

  // CV-A10 A10-60: the ATS scan's answer goes straight to the learner, so its word lists are
  // capped as a stored CV's are (200 words), and its flags to 20.
  it('caps the word lists an ATS scan returns', async () => {
    const list = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => `${prefix}${i}`);
    const { engine } = spied(() =>
      Response.json({
        coveragePct: 40,
        matched: list('m', 500),
        missing: list('x', 500),
        missingMustHaves: list('must', 500),
        flags: list('flag', 100),
      }),
    );
    const request = draft();
    const ats = await engine.atsScan({
      learnerRef: request.learnerRef,
      consent: request.consent,
      cvText: '# Thandi Example\n\nPython',
      job: { title: 'Junior developer', company: null, description: 'Python and Git.' },
    });
    expect(ats.coveragePct).toBe(40);
    expect(ats.matched).toEqual(list('m', ATS_WORDS_MAX));
    expect(ats.missing).toEqual(list('x', ATS_WORDS_MAX));
    expect(ats.missingMustHaves).toEqual(list('must', ATS_WORDS_MAX));
    expect(ats.flags).toEqual(list('flag', ATS_FLAGS_MAX));
    expect(ATS_WORDS_MAX).toBe(200);
  });

  // A5-15: a PDF link off Mmereko's own host must name a public host.
  it.each([
    'https://169.254.169.254/latest/meta-data/',
    'https://10.0.0.5/cv.pdf',
    'https://[::1]/cv.pdf',
    'https://2130706433/cv.pdf',
    'https://localhost/cv.pdf',
    'https://localhost./cv.pdf',
    'https://metadata.internal/cv.pdf',
    'https://intranet/cv.pdf',
  ])('never fetches a PDF link to a private or IP host (%s)', async (url) => {
    const { calls, engine } = spied(() => new Response(PDF));
    expect((await refusal(engine.fetchPdf(url))).code).toBe('bad_response');
    expect(calls).toEqual([]);
  });

  // A5-15: a redirect would re-send a learner's profile (or our token) somewhere else.
  it('never follows a redirect away from Mmereko, and never re-sends the profile', async () => {
    const { createServer } = await import('node:http');
    const elsewhere: string[] = [];
    const thief = createServer((req, res) => {
      elsewhere.push(req.url ?? '');
      res.end('{}');
    });
    await new Promise<void>((r) => thief.listen(0, '127.0.0.1', r));
    const thiefPort = (thief.address() as { port: number }).port;
    const partner = createServer((req, res) => {
      if (req.url?.endsWith('/oauth/token')) {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ access_token: 't', token_type: 'Bearer', expires_in: 600 }));
        return;
      }
      res.statusCode = 307;
      res.setHeader('location', `http://127.0.0.1:${thiefPort}/steal`);
      res.end();
    });
    await new Promise<void>((r) => partner.listen(0, '127.0.0.1', r));
    const port = (partner.address() as { port: number }).port;
    try {
      const engine = adapter({ apiUrl: `http://127.0.0.1:${port}/partner/v1` });
      await refusal(engine.createDraft(draft(), randomUUID()));
      expect(elsewhere).toEqual([]);
    } finally {
      await new Promise((r) => partner.close(r));
      await new Promise((r) => thief.close(r));
    }
  });

  // A5-16: a body is read only up to its cap, whatever content-length says (or doesn't).
  it('stops reading a PDF at the cap when no length is given', async () => {
    const { stream, read } = counted(3 * MAX_CV_PDF_BYTES);
    const { engine } = spied(() => new Response(stream, { status: 200 }));
    expect((await refusal(engine.fetchPdf(`${API}/pdf/abc`))).code).toBe('payload_too_large');
    expect(read.bytes).toBeLessThanOrEqual(MAX_CV_PDF_BYTES + 128 * 1024);
  });

  it('stops reading an API answer at the cap', async () => {
    const { stream, read } = counted(12 * 1024 * 1024);
    const { engine } = spied(
      () => new Response(stream, { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    expect((await refusal(engine.getJob('job-1', randomUUID()))).code).toBe('bad_response');
    expect(read.bytes).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  // A5-16: the bytes kept and served as application/pdf are a PDF.
  it('refuses a "PDF" that isn’t one', async () => {
    const { engine } = spied(
      () => new Response('<html><script>alert(1)</script></html>', { status: 200 }),
    );
    expect((await refusal(engine.fetchPdf(`${API}/pdf/abc`))).code).toBe('bad_response');
    const ok = spied(() => new Response(PDF, { status: 200 }));
    expect(await ok.engine.fetchPdf(`${API}/pdf/abc`)).toEqual(PDF);
  });

  // A5-17: a job answer is for the job and the learner asked about.
  it('refuses a job answer for another job or another learner', async () => {
    const learnerRef = randomUUID();
    const job = (over: Record<string, unknown>) => ({
      jobId: 'job-1',
      kind: 'cv-draft',
      status: 'running',
      learnerRef,
      createdAt: '2026-10-23T08:00:00Z',
      ...over,
    });
    const other = spied(() => Response.json(job({ jobId: 'job-2' })));
    expect((await refusal(other.engine.getJob('job-1', learnerRef))).code).toBe('bad_response');
    const someoneElse = spied(() => Response.json(job({ learnerRef: randomUUID() })));
    expect((await refusal(someoneElse.engine.getJob('job-1', learnerRef))).code).toBe(
      'bad_response',
    );
    const right = spied(() => Response.json(job({})));
    expect((await right.engine.getJob('job-1', learnerRef)).status).toBe('running');
  });
});
