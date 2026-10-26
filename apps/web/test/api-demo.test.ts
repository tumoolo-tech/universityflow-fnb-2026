import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '@universityflow/content';
import type { Store } from '@universityflow/db';
import { SAMPLE_NOTICE, SAMPLE_PDF_PRODUCER } from '@universityflow/documents';
import { describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * Judge demo mode (UF_DEPLOYMENT=demo, docs/deploy/demo.md), through the route handlers with a
 * real embedded database. Phone sign-in is off; a judge starts as a made-up learner in one press
 * and gets a private copy with a session; "Switch learner" deletes it; copies older than a day
 * are swept; uploads take only the generator's SAMPLE PDFs.
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

let n = 7_100_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `+2782${String(n++).padStart(7, '0')}`;

/**
 * Agent D2's seed stands in here: an adult learner made through the store's own methods, as the
 * real seed does. `cloned` records each copy made.
 */
const cloned: string[] = [];
vi.mock('../lib/server/demo/personas', async () => {
  const { en: content } = await import('@universityflow/content');
  const { DEMO_PERSONA_IDS } = await import('../lib/server/demo/types');
  return {
    DEMO_PERSONAS: DEMO_PERSONA_IDS.map((id) => ({ id, ...content.demoPersonas.personas[id] })),
    cloneDemoPersona: async (store: Store, id: string) => {
      if (id === 'demo-final-year') throw new Error('seed failed');
      const number = phone();
      const challenge = await store.requestOtp(number);
      if (challenge.review) throw new Error('unexpected');
      const { studentId } = await store.verifyOtp(number, challenge.code);
      await store.setDateOfBirth(studentId, '2006-03-14');
      await store.consentAsAdult(studentId, en.adultConsent.version);
      cloned.push(studentId);
      return studentId;
    },
  };
});

const routes = {
  start: (await import('../app/api/demo/start/route')).POST,
  switch: (await import('../app/api/demo/switch/route')).POST,
  signOut: (await import('../app/api/auth/sign-out/route')).POST,
  sampleReport: (await import('../app/api/demo/sample-report/route')).POST,
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  guardian: (await import('../app/api/me/guardian/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET as unknown as (
    request: Request,
  ) => Promise<Response>,
  jobsRun: (await import('../app/api/dev/jobs/run/route')).POST,
  me: (await import('../app/api/me/route')).GET,
  documents: (await import('../app/api/documents/route')).POST,
};
const { getServices } = await import('../lib/server/services');
const { DEMO_STARTS_PER_IP_PER_HOUR } = await import('../lib/server/demo/core');

let ip = 1;
/** Each start from its own TEST-NET-3 address, so the per-address limit is tested on purpose. */
const fresh = () => ({ 'x-forwarded-for': `203.0.113.${ip++}` });

async function start(browser: Browser, persona = 'demo-grade-11', headers = fresh()) {
  return browser.json<{ ok?: boolean; error?: string }>(routes.start, '/api/demo/start', {
    json: { persona },
    headers,
  });
}

describe('phone sign-in is off in demo mode', () => {
  it('request-pin, verify-pin, the dev outbox and the jobs runner answer 404', async () => {
    const browser = new Browser();
    expect(
      (await browser.call(routes.requestPin, '/api/auth/request-pin', { json: { phone: phone() } }))
        .status,
    ).toBe(404);
    expect(
      (
        await browser.call(routes.verifyPin, '/api/auth/verify-pin', {
          json: { phone: phone(), pin: '123456' },
        })
      ).status,
    ).toBe(404);
    expect((await browser.call(routes.outbox, '/api/dev/outbox')).status).toBe(404);
    expect(
      (await browser.call(routes.jobsRun, '/api/dev/jobs/run', { method: 'POST' })).status,
    ).toBe(404);
  });

  it('a guardian consent SMS is never sent (404), even for a signed-in learner', async () => {
    const browser = new Browser();
    await start(browser);
    const response = await browser.call(routes.guardian, '/api/me/guardian', {
      json: { name: 'Demo Guardian', phone: phone(), relationship: 'parent' },
    });
    expect(response.status).toBe(404);
    const { outbox } = await getServices();
    expect(outbox).toBeNull();
  });

  it('the dev outbox page is shut in demo mode too', () => {
    const source = readFileSync(join(import.meta.dirname, '../app/dev/outbox/page.tsx'), 'utf8');
    expect(source).toMatch(/config\.demo/);
  });
});

describe('POST /api/demo/start', () => {
  it('makes a private copy of the learner and signs the browser in to it', async () => {
    const browser = new Browser();
    const { status, body } = await start(browser);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    const me = await browser.json<{ account: { consentStatus: string } }>(routes.me, '/api/me');
    expect(me.status).toBe(200);
  });

  it('two judges picking the same learner get two separate copies', async () => {
    const before = cloned.length;
    await start(new Browser(), 'demo-grade-10');
    await start(new Browser(), 'demo-grade-10');
    expect(cloned.length).toBe(before + 2);
    expect(cloned.at(-1)).not.toBe(cloned.at(-2));
  });

  it('a form post from the picker redirects to /home (no script needed)', async () => {
    const browser = new Browser();
    const form = new URLSearchParams({ persona: 'demo-grade-12' });
    const response = await browser.call(routes.start, '/api/demo/start', {
      body: form.toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded', ...fresh() },
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toMatch(/\/home$/);
    expect((await browser.call(routes.me, '/api/me')).status).toBe(200);
  });

  it('refuses another site (CSRF) and an unknown learner', async () => {
    const browser = new Browser();
    const forged = await browser.call(routes.start, '/api/demo/start', {
      json: { persona: 'demo-grade-11' },
      origin: 'https://evil.example',
      headers: fresh(),
    });
    expect(forged.status).toBe(403);
    expect((await start(browser, 'demo-teacher')).status).toBe(400);
  });

  it('a seed that fails says so, and signs nobody in', async () => {
    const browser = new Browser();
    const { status } = await start(browser, 'demo-final-year');
    expect(status).toBe(503);
    expect((await browser.call(routes.me, '/api/me')).status).toBe(401);
  });

  // A judging room shares one address behind its NAT: 120 an hour (the integrator's ask, 2026-10-23).
  it('allows 120 starts an hour from one address, then 429', async () => {
    expect(DEMO_STARTS_PER_IP_PER_HOUR).toBe(120);
    const headers = { 'x-forwarded-for': '198.51.100.77' };
    for (let i = 0; i < DEMO_STARTS_PER_IP_PER_HOUR; i++)
      expect((await start(new Browser(), 'demo-grade-11', headers)).status).toBe(200);
    expect((await start(new Browser(), 'demo-grade-11', headers)).status).toBe(429);
  }, 240_000);

  it('sweeps copies older than a day as it starts a new one', async () => {
    const { store } = await getServices();
    const spy = vi.spyOn(store, 'sweepDemoStudents');
    await start(new Browser());
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('sweeps while the copy is made, so a judge never waits for the sweep (the slow start, 2026-10-25)', async () => {
    const { store } = await getServices();
    let copyStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      copyStarted = resolve;
    });
    const requestOtp = store.requestOtp.bind(store);
    const otp = vi.spyOn(store, 'requestOtp').mockImplementation((...args) => {
      copyStarted();
      return requestOtp(...args);
    });
    // The sweep holds on until the copy has begun: done one after the other, it never would.
    const overlapped: boolean[] = [];
    const sweep = vi.spyOn(store, 'sweepDemoStudents').mockImplementation(async () => {
      overlapped.push(
        await Promise.race([
          started.then(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3_000)),
        ]),
      );
      return { students: 0, fileKeys: [] };
    });
    try {
      expect((await start(new Browser())).status).toBe(200);
    } finally {
      otp.mockRestore();
      sweep.mockRestore();
    }
    expect(overlapped).toEqual([true]);
  });
});

describe('POST /api/demo/switch', () => {
  it('deletes the copy, signs out and goes back to the picker', async () => {
    const browser = new Browser();
    await start(browser);
    const id = cloned.at(-1) as string;
    const response = await browser.call(routes.switch, '/api/demo/switch', {
      method: 'POST',
      body: '',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(response.status).toBe(303);
    // The picker lives at /demo: / is the real landing page (the owner, 2026-10-23).
    expect(response.headers.get('location')).toMatch(/\/demo$/);
    expect((await browser.call(routes.me, '/api/me')).status).toBe(401);
    const { store } = await getServices();
    await expect(store.account(id)).rejects.toThrow();
  });

  it('refuses another site (CSRF)', async () => {
    const browser = new Browser();
    await start(browser);
    const response = await browser.call(routes.switch, '/api/demo/switch', {
      method: 'POST',
      origin: 'https://evil.example',
    });
    expect(response.status).toBe(403);
  });
});

// The demo's ways in (the owner, 2026-10-23, late): the menu's "Sign out" on a made-up learner
// leaves as "Switch learner" does, and the page goes back to the picker.
describe('POST /api/auth/sign-out in demo mode', () => {
  it('deletes the made-up learner’s copy and says to go back to the picker', async () => {
    const browser = new Browser();
    await start(browser);
    const id = cloned.at(-1) as string;
    const out = await browser.json(routes.signOut, '/api/auth/sign-out', { method: 'POST' });
    expect(out).toEqual({ status: 200, body: { ok: true, next: '/demo' } });
    expect((await browser.call(routes.me, '/api/me')).status).toBe(401);
    const { store } = await getServices();
    await expect(store.account(id)).rejects.toThrow();
  });

  it('refuses another site (CSRF)', async () => {
    const browser = new Browser();
    await start(browser);
    const response = await browser.call(routes.signOut, '/api/auth/sign-out', {
      method: 'POST',
      origin: 'https://evil.example',
    });
    expect(response.status).toBe(403);
  });
});

/** A PDF shaped like the generator's, or not. */
function pdf(sample: boolean): Blob {
  const esc = (v: string) => v.replace(/[()\\]/g, (c) => `\\${c}`);
  const content = `BT /F2 13 Tf 1 0 0 1 100 800 Tm (${esc(sample ? SAMPLE_NOTICE : 'Report card')}) Tj ET`;
  const text =
    `%PDF-1.4\n3 0 obj\n<< /Producer (${esc(sample ? SAMPLE_PDF_PRODUCER : 'Word')}) >>\nendobj\n` +
    `7 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n%%EOF\n`;
  return new Blob([Uint8Array.from(text, (c) => c.charCodeAt(0))], { type: 'application/pdf' });
}

async function upload(browser: Browser, file: Blob, kind?: string) {
  const form = new FormData();
  form.append('file', file, 'report.pdf');
  if (kind) form.append('kind', kind);
  return browser.json<{ error?: string; detail?: string; draft?: unknown }>(
    routes.documents,
    '/api/documents',
    { body: form },
  );
}

describe('uploads in demo mode: SAMPLE PDFs only', () => {
  it('refuses any other PDF or a photo, before storing or reading it', async () => {
    const browser = new Browser();
    await start(browser);
    const other = await upload(browser, pdf(false));
    expect(other.status).toBe(400);
    expect(other.body).toMatchObject({ error: 'upload', detail: 'demo-sample-only' });
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], {
      type: 'image/png',
    });
    expect((await upload(browser, png)).body.detail).toBe('demo-sample-only');
  });

  it('accepts a generator SAMPLE statement as a report, and nothing else as a letter', async () => {
    const browser = new Browser();
    await start(browser);
    const ok = await upload(browser, pdf(true));
    expect(ok.status).toBe(200);
    expect(ok.body.draft).toBeTruthy();
    expect((await upload(browser, pdf(true), 'acceptance-letter')).body.detail).toBe(
      'demo-sample-only',
    );
  });

  it('"Use a sample report" reads one of the generator’s statements', async () => {
    const browser = new Browser();
    await start(browser);
    const { status, body } = await browser.json<{ documentId: string; draft: unknown }>(
      routes.sampleReport,
      '/api/demo/sample-report',
      { method: 'POST' },
    );
    expect(status).toBe(200);
    expect(body.documentId).toBeTruthy();
    expect(body.draft).toBeTruthy();
  });
});
