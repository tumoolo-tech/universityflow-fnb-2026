import { timingSafeEqual } from 'node:crypto';
import { en } from '@universityflow/content';
import { DEMO_SWEEP_BATCH, type Store } from '@universityflow/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mintFakeIdToken } from '../lib/demo-signup';
import { Browser } from './harness';

/**
 * A11-61: the judge demo's SCHEDULED sweep (docs/deploy/demo.md "The scheduled sweep"). A Vercel
 * cron calls `GET /api/demo/sweep` with `Authorization: Bearer <CRON_SECRET>`; the route runs
 * every deletion the demo's words promise (copies after 24 hours, the judges' own sign-up
 * accounts after 30 days) and the retention sweeps nothing else runs on a demo, and reports counts
 * only. Through the route handler with a real embedded database, the fake sign-up verifier
 * standing in for Firebase.
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['UF_DEMO_SIGNUP'] = 'fake';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';
/** A test value, built here: never a real secret (hard rule 4; the no-secrets guard). */
const SECRET = `demo-cron-test-${'x'.repeat(28)}`;
process.env['CRON_SECRET'] = SECRET;

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);
// The comparison must be constant time, so the test watches the one function that is.
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

let n = 7_400_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `+2782${String(n++).padStart(7, '0')}`;

vi.mock('../lib/server/demo/personas', async () => {
  const { en: content } = await import('@universityflow/content');
  const { DEMO_PERSONA_IDS } = await import('../lib/server/demo/types');
  return {
    DEMO_PERSONAS: DEMO_PERSONA_IDS.map((id) => ({ id, ...content.demoPersonas.personas[id] })),
    cloneDemoPersona: async (store: Store) => {
      const number = phone();
      const challenge = await store.requestOtp(number);
      if (challenge.review) throw new Error('unexpected');
      const { studentId } = await store.verifyOtp(number, challenge.code);
      await store.setDateOfBirth(studentId, '2006-03-14');
      await store.consentAsAdult(studentId, en.adultConsent.version);
      return studentId;
    },
  };
});

const routes = {
  sweep: (await import('../app/api/demo/sweep/route')).GET,
  start: (await import('../app/api/demo/start/route')).POST,
  signUp: (await import('../app/api/demo/sign-up/route')).POST,
  sampleReport: (await import('../app/api/demo/sample-report/route')).POST,
  me: (await import('../app/api/me/route')).GET,
};
const { getServices } = await import('../lib/server/services');
const { SWEEP_MAX_ROUNDS } = await import('../lib/server/demo/sweep');

let ip = 1;
const fresh = () => ({ 'x-forwarded-for': `203.0.113.${ip++}` });
let who = 1;
const identity = () => {
  who += 1;
  return { uid: `fake-uid-${who}-${Date.now()}`, email: `judge-${who}@example.com` };
};

interface Counts {
  copies: number;
  signups: number;
  files: number;
  queuedFiles: number;
  moduleMarks: number;
  moduleOutlines: number;
  sessions: number;
  rounds: number;
  truncated: boolean;
}

/** The cron's call: a GET with the bearer, no cookie, no origin. */
function sweep(bearer?: string, headers: Record<string, string> = {}) {
  const browser = new Browser();
  return browser.call(routes.sweep, '/api/demo/sweep', {
    method: 'GET',
    origin: null,
    ...(bearer === undefined ? {} : { bearer }),
    headers,
  });
}

async function accountId(browser: Browser): Promise<string> {
  const me = await browser.json<{ account: { id: string } }>(routes.me, '/api/me');
  expect(me.status).toBe(200);
  return me.body.account.id;
}

async function startLearner(): Promise<{ browser: Browser; id: string }> {
  const browser = new Browser();
  const { status } = await browser.json(routes.start, '/api/demo/start', {
    json: { persona: 'demo-grade-11' },
    headers: fresh(),
  });
  expect(status).toBe(200);
  return { browser, id: await accountId(browser) };
}

async function signUpJudge(): Promise<{ browser: Browser; id: string }> {
  const browser = new Browser();
  const { status } = await browser.json(routes.signUp, '/api/demo/sign-up', {
    json: { idToken: mintFakeIdToken(identity()) },
    headers: fresh(),
  });
  expect(status).toBe(200);
  return { browser, id: await accountId(browser) };
}

/** A row's age is set outright (its created_at is the database's own time). Ids are the app's. */
async function age(table: 'students' | 'demo_signups', id: string, interval: string) {
  const { database } = await getServices();
  const column = table === 'students' ? 'id' : 'student_id';
  await database.db.execute(
    `update ${table} set created_at = now() - interval '${interval}' where ${column} = '${id}'::uuid`,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/demo/sweep: the secret', () => {
  it('refuses a missing, wrong or differently shaped secret with 401, in constant time, sweeping nothing', async () => {
    const { store } = await getServices();
    const copies = vi.spyOn(store, 'sweepDemoStudents');
    const compare = vi.mocked(timingSafeEqual);
    const attempts: Array<[string | undefined, Record<string, string>]> = [
      [undefined, {}],
      ['', {}],
      [`${SECRET.slice(0, -1)}y`, {}], // the same length, one character off
      ['short', {}], // a different length: compared all the same, never an early return
      [`${SECRET}-and-more`, {}],
      [undefined, { authorization: `Basic ${btoa(`cron:${SECRET}`)}` }],
      [undefined, { authorization: SECRET }], // the bare value, without Bearer
    ];
    for (const [bearer, headers] of attempts) {
      compare.mockClear();
      const response = await sweep(bearer, headers);
      expect(response.status, `${bearer ?? ''} ${JSON.stringify(headers)}`).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store');
      // One constant-time comparison of two digests of the same length, whatever was sent.
      expect(compare).toHaveBeenCalledTimes(1);
      const [a, b] = compare.mock.calls[0] as [Uint8Array, Uint8Array];
      expect(a.byteLength).toBe(b.byteLength);
      expect(a.byteLength).toBeGreaterThanOrEqual(32);
    }
    expect(copies).not.toHaveBeenCalled();
  });

  it('with CRON_SECRET unset, answers 503 "not set up" and logs the variable’s name, never a value', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { store } = await getServices();
    const copies = vi.spyOn(store, 'sweepDemoStudents');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await sweep(SECRET);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'not-set-up', detail: null });
    const lines = errors.mock.calls.map((c) => c.map(String).join(' '));
    expect(lines.some((l) => /^request failed: ConfigError: .*CRON_SECRET/.test(l))).toBe(true);
    expect(lines.join('\n')).not.toContain(SECRET);
    expect(copies).not.toHaveBeenCalled();
  });
});

describe('GET /api/demo/sweep: the sweeps', () => {
  it('deletes day-old copies with their files and month-old sign-up accounts, keeps the rest, and reports counts only', async () => {
    const old = await startLearner();
    // A file in the copy: the sample report.
    expect(
      (await old.browser.call(routes.sampleReport, '/api/demo/sample-report', { method: 'POST' }))
        .status,
    ).toBe(200);
    const young = await startLearner();
    const oldJudge = await signUpJudge();
    const newJudge = await signUpJudge();
    await age('students', old.id, '25 hours');
    await age('demo_signups', oldJudge.id, '31 days');
    // A judge's own account older than a day is NOT a copy: only its 30 days end it.
    await age('students', newJudge.id, '25 hours');

    const info = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const response = await sweep(SECRET);
    expect(response.status).toBe(200);
    const counts = (await response.json()) as Counts;
    expect(counts).toMatchObject({ copies: 1, signups: 1, truncated: false });
    expect(counts.files).toBeGreaterThanOrEqual(1);
    expect(counts.rounds).toBeGreaterThanOrEqual(1);
    for (const value of Object.values(counts))
      expect(['number', 'boolean']).toContain(typeof value);

    const { store } = await getServices();
    await expect(store.account(old.id)).rejects.toThrow();
    await expect(store.account(oldJudge.id)).rejects.toThrow();
    expect((await old.browser.call(routes.me, '/api/me')).status).toBe(401);
    expect((await oldJudge.browser.call(routes.me, '/api/me')).status).toBe(401);
    expect((await young.browser.call(routes.me, '/api/me')).status).toBe(200);
    expect((await newJudge.browser.call(routes.me, '/api/me')).status).toBe(200);

    // Hard rule 4: the log line is counts, nothing that identifies a person (not even an id).
    const lines = info.mock.calls.map((c) => c.map(String).join(' '));
    const line = lines.find((l) => l.startsWith('demo sweep:'));
    expect(line).toMatch(/^demo sweep: (?:[a-zA-Z]+=(?:\d+|true|false)(?: |$))+$/);
    expect(line).toContain('copies=1');
    expect(line).toContain('signups=1');
    for (const l of lines) {
      expect(l).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
      expect(l).not.toMatch(/@|\+27|judge-|0800/);
    }
  });

  it('a second run straight after finds nothing to do (idempotent)', async () => {
    const response = await sweep(SECRET);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      copies: 0,
      signups: 0,
      files: 0,
      queuedFiles: 0,
      truncated: false,
    });
  });

  it('runs the retention sweeps a demo has no job runner for: module marks, outlines, sessions, queued files', async () => {
    const { store, database } = await getServices();
    const marks = vi.spyOn(store, 'deleteExpiredModuleMarks');
    const outlines = vi.spyOn(store, 'deleteExpiredModuleOutlines');
    const sessions = vi.spyOn(store, 'sweepExpiredSessions');
    // A queued file whose storage delete failed in its request (A1-88): the queue row alone, as
    // the owner writes it; the key names nothing (and a key already gone is not an error).
    await database.db.execute(
      `insert into file_deletions (storage_key) values ('sweep-test-key-0001')`,
    );
    const response = await sweep(SECRET);
    expect(response.status).toBe(200);
    const counts = (await response.json()) as Counts;
    expect(counts.queuedFiles).toBe(1);
    expect(marks).toHaveBeenCalledTimes(1);
    expect(outlines).toHaveBeenCalledTimes(1);
    expect(sessions).toHaveBeenCalledTimes(1);
    const left = await database.db.execute(`select count(*)::int as n from file_deletions`);
    expect((left as unknown as { rows: Array<{ n: number }> }).rows[0]?.n).toBe(0);
  });

  it('is bounded: after SWEEP_MAX_ROUNDS full batches it stops and says so, and never fails the run', async () => {
    const { store } = await getServices();
    const copies = vi
      .spyOn(store, 'sweepDemoStudents')
      .mockResolvedValue({ students: DEMO_SWEEP_BATCH, fileKeys: [] });
    const response = await sweep(SECRET);
    expect(response.status).toBe(200);
    const counts = (await response.json()) as Counts;
    expect(counts.truncated).toBe(true);
    expect(counts.copies).toBe(DEMO_SWEEP_BATCH * SWEEP_MAX_ROUNDS);
    expect(copies).toHaveBeenCalledTimes(SWEEP_MAX_ROUNDS);
  });

  it('a sweep that fails is reported (503) with the error’s name only, after the others ran', async () => {
    const { store } = await getServices();
    vi.spyOn(store, 'sweepDemoSignups').mockRejectedValue(new Error('pretend the pooler is down'));
    const outlines = vi.spyOn(store, 'deleteExpiredModuleOutlines');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await sweep(SECRET);
    expect(response.status).toBe(503);
    expect(outlines).toHaveBeenCalledTimes(1);
    const lines = errors.mock.calls.map((c) => c.map(String).join(' '));
    expect(lines.some((l) => /^demo sweep: signups failed \(Error\)$/.test(l))).toBe(true);
    expect(lines.join('\n')).not.toContain('pooler');
  });
});
