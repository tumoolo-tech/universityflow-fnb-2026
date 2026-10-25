import { en } from '@universityflow/content';
import type { Store } from '@universityflow/db';
import { SAMPLE_PHOTO_IDS } from '@universityflow/documents';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigError, readConfig } from '../lib/server/config';
import { Browser } from './harness';

/**
 * A HACKATHON EXCEPTION (the owner's decision, 2026-10-23, late night): in the judge demo, a
 * visitor may upload their OWN photo for the profile, not only the drawn samples, behind the
 * demo-only switch `UF_DEMO_REAL_PHOTOS=1` (refused in production and on staging, like
 * NEXT_PUBLIC_UF_DEMO_LOGOS; docs/deploy/demo.md, docs/deploy/hackathon-undo-pr.md). The photo is
 * kept only in that visitor's private demo copy (its files service: the demo's Postgres when it
 * has one) and goes with the copy; never sent to the AI or anywhere else; the usual limits apply
 * (2 MB, JPEG or PNG, 16 MP, A5-13); a plain line says so beside the upload; the samples stay.
 * The consent-wording check (A11-31) stands aside for the demo's synthetic copies only.
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

let n = 7_370_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `+2782${String(n++).padStart(7, '0')}`;

/** The demo seed stands in here, as in api-demo-photos.test.ts: an adult made through the store. */
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
  start: (await import('../app/api/demo/start/route')).POST,
  switch: (await import('../app/api/demo/switch/route')).POST,
  me: (await import('../app/api/me/route')).GET,
  photo: await import('../app/api/me/photo/route'),
  chat: await import('../app/api/chat/route'),
};
const { getServices } = await import('../lib/server/services');
const { sweepOldCopies } = await import('../lib/server/demo/core');
const MePage = (await import('../app/(app)/me/page')).default;

/** The demo-only switch, as the services read it at start (readConfig). */
async function setSwitch(on: boolean) {
  const { config } = await getServices();
  Object.assign(config as object, { demoRealPhotos: on });
}
afterEach(() => setSwitch(false));

let ip = 1;
async function judge() {
  const browser = new Browser();
  const started = await browser.json(routes.start, '/api/demo/start', {
    json: { persona: 'demo-grade-11' },
    headers: { 'x-forwarded-for': `198.51.100.${ip++}` },
  });
  expect(started.status).toBe(200);
  return browser;
}

/** A synthetic photo with a camera's details and a place, drawn at runtime. */
async function ownPhoto(options: { format?: 'jpeg' | 'png'; width?: number } = {}) {
  const image = sharp({
    create: {
      width: options.width ?? 900,
      height: 700,
      channels: 3,
      background: { r: 40, g: 120, b: 80 },
    },
  }).withExif({
    IFD0: { Artist: 'Synthetic Judge', Model: 'TestCam' },
    IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '33/1 55/1 0/1' },
  });
  return new Uint8Array(
    options.format === 'png' ? await image.png().toBuffer() : await image.jpeg().toBuffer(),
  );
}

function fileForm(bytes: Uint8Array, type = 'image/jpeg') {
  const body = new FormData();
  body.set('crop', JSON.stringify({ x: 0, y: 0, size: 1 }));
  body.set('file', new Blob([new Uint8Array(bytes)], { type }), 'me.jpg');
  return body;
}

async function upload(browser: Browser, body: FormData) {
  return browser.json<{ error?: string; detail?: string; photo?: { version: string } }>(
    routes.photo.POST,
    '/api/me/photo',
    { method: 'POST', body },
  );
}

/** Uploads and returns the storage key the files service was given. */
async function uploaded(browser: Browser) {
  const { files } = await getServices();
  const put = vi.spyOn(files, 'put');
  const result = await upload(browser, fileForm(await ownPhoto()));
  expect(result.status).toBe(200);
  const key = put.mock.calls.at(-1)?.[0] as string;
  put.mockRestore();
  return key;
}

const DEMO = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  UF_DEPLOYMENT: 'demo',
  UF_DEMO_PROJECT: '1',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 'd'.repeat(48),
  // A demo's remote Postgres goes over TLS (the Supabase branch).
  DATABASE_URL: 'postgres://demo@demo-db.example/uf?sslmode=verify-full',
  UF_DEMO_DATABASE: 'synthetic',
};
const PRODUCTION = {
  VERCEL_ENV: 'production',
  UF_PROVIDERS: 'live',
  AUTH_SECRET: 'x'.repeat(48),
  DATABASE_URL: 'postgres://user@db.example/uf',
  UF_S3_BUCKET: 'uf-documents-test',
  UF_SMS_PROVIDER: 'test-sms',
  UF_JOBS_PROVIDER: 'test-jobs',
  ANTHROPIC_API_KEY: 'test-key-not-real',
};
const ADAPTERS = { sms: ['test-sms'], jobs: ['test-jobs'], inbound: { sms: ['test-sms'] } };
const STAGING = {
  NODE_ENV: 'production',
  RENDER: 'true',
  UF_DEPLOYMENT: 'staging',
  UF_PROVIDERS: 'local',
  AUTH_SECRET: 's'.repeat(44),
  UF_STAGING_PASSWORD: 'staging-test-password-0123',
};

describe('UF_DEMO_REAL_PHOTOS: a demo-only switch (hackathon exception)', () => {
  it('a demo reads it; off unless exactly 1', () => {
    expect(readConfig({ ...DEMO, UF_DEMO_REAL_PHOTOS: '1' }).demoRealPhotos).toBe(true);
    expect(readConfig({ ...DEMO, UF_DEMO_REAL_PHOTOS: 'true' }).demoRealPhotos).toBe(false);
    expect(readConfig(DEMO).demoRealPhotos).toBe(false);
    // It never turns on real uploads anywhere else, or the learners' switch.
    expect(readConfig({ ...DEMO, UF_DEMO_REAL_PHOTOS: '1' }).profilePhoto).toBe(false);
  });

  it('production and staging refuse it', () => {
    const now = new Date('2026-10-23T10:00:00Z');
    expect(() => readConfig({ ...PRODUCTION, UF_DEMO_REAL_PHOTOS: '1' }, ADAPTERS, now)).toThrow(
      ConfigError,
    );
    expect(() => readConfig({ ...PRODUCTION, UF_DEMO_REAL_PHOTOS: '1' }, ADAPTERS, now)).toThrow(
      /UF_DEMO_REAL_PHOTOS/,
    );
    expect(() => readConfig({ ...STAGING, UF_DEMO_REAL_PHOTOS: '1' })).toThrow(
      /UF_DEMO_REAL_PHOTOS/,
    );
    expect(() => readConfig({ UF_DEMO_REAL_PHOTOS: '1' })).toThrow(/UF_DEMO_REAL_PHOTOS/);
  });
});

describe('on: a visitor uploads their own photo, the samples stay', () => {
  it('/api/me and About me offer both, with the line for a 24-hour copy', async () => {
    await setSwitch(true);
    const browser = await judge();
    const me = await browser.json<{ photo: unknown }>(routes.me, '/api/me');
    expect(me.body.photo).toEqual({
      version: null,
      samples: [...SAMPLE_PHOTO_IDS],
      realUploads: 'copy',
    });
    browser.enter();
    const page = (await MePage()) as { props: { photo: unknown } };
    expect(page.props.photo).toMatchObject({ realUploads: 'copy' });
  });

  it('keeps it 512 × 512, black and white, with no camera details, served to that visitor alone', async () => {
    await setSwitch(true);
    const browser = await judge();
    expect((await uploaded(browser)).startsWith('photo-')).toBe(true);
    const served = await browser.call(routes.photo.GET, '/api/me/photo');
    expect(served.status).toBe(200);
    const bytes = new Uint8Array(await served.arrayBuffer());
    expect(await sharp(bytes).metadata()).toMatchObject({
      format: 'jpeg',
      width: 512,
      height: 512,
      channels: 1,
    });
    const text = Buffer.from(bytes).toString('latin1');
    for (const trace of ['Exif', 'Synthetic', 'TestCam']) expect(text).not.toContain(trace);
    // Another visitor's copy sees nothing of it.
    expect((await (await judge()).call(routes.photo.GET, '/api/me/photo')).status).toBe(404);
    // A sample still works beside it.
    const sample = new FormData();
    sample.set('crop', JSON.stringify({ x: 0, y: 0, size: 1 }));
    sample.set('sample', 'sample-2');
    expect((await upload(browser, sample)).status).toBe(200);
  });

  it('the usual limits apply: 2 MB, JPEG or PNG only', async () => {
    await setSwitch(true);
    const browser = await judge();
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(await upload(browser, fileForm(big))).toMatchObject({
      status: 400,
      body: { detail: 'too-large' },
    });
    const webp = new Uint8Array(
      await sharp(await ownPhoto())
        .webp()
        .toBuffer(),
    );
    expect(await upload(browser, fileForm(webp))).toMatchObject({
      status: 400,
      body: { detail: 'unsupported-type' },
    });
    expect((await upload(browser, fileForm(await ownPhoto({ format: 'png' })))).status).toBe(200);
  });

  it('off: a real photo is refused as before, samples only', async () => {
    const browser = await judge();
    expect(await upload(browser, fileForm(await ownPhoto()))).toMatchObject({
      status: 400,
      body: { detail: 'demo-sample-photo-only' },
    });
    const me = await browser.json<{ photo: Record<string, unknown> }>(routes.me, '/api/me');
    expect(me.body.photo).not.toHaveProperty('realUploads');
  });
});

describe('deleted with the visitor’s copy', () => {
  it('"Switch learner" deletes the photo’s file with the copy', async () => {
    await setSwitch(true);
    const browser = await judge();
    const key = await uploaded(browser);
    const { files } = await getServices();
    expect(await files.get(key)).not.toBeNull();
    const switched = await browser.call(routes.switch, '/api/demo/switch', {
      method: 'POST',
      body: '',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(switched.status).toBe(303);
    expect(await files.get(key)).toBeNull();
  });

  it('the 24-hour reset deletes it with the copy', async () => {
    await setSwitch(true);
    const browser = await judge();
    const key = await uploaded(browser);
    const services = await getServices();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000));
    try {
      for (let i = 0; i < 20 && (await services.files.get(key)); i++) {
        await sweepOldCopies(services);
      }
    } finally {
      vi.useRealTimers();
    }
    expect(await services.files.get(key)).toBeNull();
  });
});

describe('never sent to the AI', () => {
  it('is in nothing the model is given, and in no log', async () => {
    await setSwitch(true);
    const browser = await judge();
    const { files, model } = await getServices();
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    const key = await uploaded(browser);
    const bytes = (await files.get(key))?.bytes ?? new Uint8Array();
    const base64 = Buffer.from(bytes).toString('base64');
    const respond = vi.spyOn(model, 'respond');
    const response = await browser.call(routes.chat.POST, '/api/chat', {
      json: { message: 'Can you see my photo? What do I need for engineering?' },
    });
    await response.text();
    const sent = JSON.stringify(respond.mock.calls.map(([request]) => request));
    expect(sent).not.toContain(key);
    expect(sent).not.toContain(base64.slice(0, 64));
    expect(sent).not.toMatch(/photo-[0-9a-f]{32}|image\/jpeg|hasPhoto/);
    const logged = JSON.stringify([...log.mock.calls, ...error.mock.calls]);
    expect(logged).not.toContain(key);
    respond.mockRestore();
    log.mockRestore();
    error.mockRestore();
  });
});
