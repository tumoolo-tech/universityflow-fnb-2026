import { readdirSync } from 'node:fs';
import { en } from '@universityflow/content';
import { PostgresFileStore, type Store } from '@universityflow/db';
import { describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * A judge demo on Postgres keeps its files in that database (docs/deploy/demo.md): on Vercel each
 * function instance has its own /tmp, so a sample report or sample photo kept on one instance's
 * disk was missing on the next request. Here, through the route handlers: the files land in the
 * database and never in the folder, and go with the judge's copy ("Switch learner", the 24-hour
 * sweep) and with account deletion.
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

let n = 7_500_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `+2782${String(n++).padStart(7, '0')}`;

/** The demo seed stands in here, as in api-demo.test.ts: an adult made through the store. */
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

const { readConfig } = await import('../lib/server/config');
const { createServices } = await import('../lib/server/services');
// readConfig chooses the database for a demo whose DATABASE_URL is Postgres (demo-config tests);
// the embedded database stands in for that Postgres, and these services are the app's.
const GLOBAL = globalThis as typeof globalThis & { __ufServices?: unknown };
GLOBAL.__ufServices = createServices({ ...readConfig(), filesInDatabase: true });

const routes = {
  start: (await import('../app/api/demo/start/route')).POST,
  switch: (await import('../app/api/demo/switch/route')).POST,
  sampleReport: (await import('../app/api/demo/sample-report/route')).POST,
  photo: await import('../app/api/me/photo/route'),
  me: await import('../app/api/me/route'),
};
const { getServices } = await import('../lib/server/services');
const { sweepOldCopies } = await import('../lib/server/demo/core');

let ip = 1;
async function judge() {
  const browser = new Browser();
  const started = await browser.json(routes.start, '/api/demo/start', {
    json: { persona: 'demo-grade-11' },
    headers: { 'x-forwarded-for': `203.0.113.${ip++}` },
  });
  expect(started.status).toBe(200);
  return browser;
}

/** A sample report and a sample photo for this judge; the keys they were stored under. */
async function withFiles(browser: Browser): Promise<string[]> {
  const { files } = await getServices();
  const put = vi.spyOn(files, 'put');
  try {
    const report = await browser.json(routes.sampleReport, '/api/demo/sample-report', {
      method: 'POST',
    });
    expect(report.status).toBe(200);
    const body = new FormData();
    body.set('crop', JSON.stringify({ x: 0, y: 0, size: 1 }));
    body.set('sample', 'sample-2');
    const photo = await browser.call(routes.photo.POST, '/api/me/photo', { method: 'POST', body });
    expect(photo.status).toBe(200);
    const keys = put.mock.calls.map(([key]) => key);
    expect(keys).toHaveLength(2);
    return keys;
  } finally {
    put.mockRestore();
  }
}

describe('a demo on Postgres keeps its files in the database', () => {
  it('the sample report and photo are stored there, typed, and never in the folder', async () => {
    const services = await getServices();
    expect(services.files).toBeInstanceOf(PostgresFileStore);
    const browser = await judge();
    const [reportKey, photoKey] = await withFiles(browser);
    expect((await services.files.get(reportKey as string))?.mimeType).toBe('application/pdf');
    expect((await services.files.get(photoKey as string))?.mimeType).toBe('image/jpeg');
    expect(readdirSync(process.env['UF_FILE_STORE_DIR'] ?? '')).toEqual([]);
    // Served back from the database.
    const served = await browser.call(routes.photo.GET, '/api/me/photo');
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/jpeg');
  });

  it('"Switch learner" deletes them with the copy', async () => {
    const browser = await judge();
    const keys = await withFiles(browser);
    const switched = await browser.call(routes.switch, '/api/demo/switch', {
      method: 'POST',
      body: '',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(switched.status).toBe(303);
    const { files } = await getServices();
    for (const key of keys) expect(await files.get(key), key).toBeNull();
  });

  it('the 24-hour sweep deletes them with the copy', async () => {
    const browser = await judge();
    const keys = await withFiles(browser);
    const services = await getServices();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000));
    try {
      // The sweep takes a batch at a time: run it until this copy's turn has come.
      for (let i = 0; i < 20 && (await services.files.get(keys[0] as string)); i++) {
        await sweepOldCopies(services);
      }
    } finally {
      vi.useRealTimers();
    }
    for (const key of keys) expect(await services.files.get(key), key).toBeNull();
  });

  it('deleting the account deletes them', async () => {
    const browser = await judge();
    const keys = await withFiles(browser);
    const deleted = await browser.call(routes.me.DELETE, '/api/me', { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    const { files } = await getServices();
    for (const key of keys) expect(await files.get(key), key).toBeNull();
  });
});

describe('a visitor’s own photo (UF_DEMO_REAL_PHOTOS, a hackathon exception)', () => {
  it('is kept in the demo’s database, never the folder, and goes with the copy', async () => {
    const services = await getServices();
    Object.assign(services.config as object, { demoRealPhotos: true });
    try {
      const sharp = (await import('sharp')).default;
      const bytes = await sharp({
        create: { width: 640, height: 480, channels: 3, background: '#225588' },
      })
        .jpeg()
        .toBuffer();
      const browser = await judge();
      const put = vi.spyOn(services.files, 'put');
      const body = new FormData();
      body.set('crop', JSON.stringify({ x: 0, y: 0, size: 1 }));
      body.set('file', new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), 'me.jpg');
      const photo = await browser.call(routes.photo.POST, '/api/me/photo', {
        method: 'POST',
        body,
      });
      expect(photo.status).toBe(200);
      const key = put.mock.calls.at(-1)?.[0] as string;
      put.mockRestore();
      expect((await services.files.get(key))?.mimeType).toBe('image/jpeg');
      expect(readdirSync(process.env['UF_FILE_STORE_DIR'] ?? '')).toEqual([]);
      const switched = await browser.call(routes.switch, '/api/demo/switch', {
        method: 'POST',
        body: '',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      expect(switched.status).toBe(303);
      expect(await services.files.get(key)).toBeNull();
    } finally {
      Object.assign(services.config as object, { demoRealPhotos: false });
    }
  });
});
