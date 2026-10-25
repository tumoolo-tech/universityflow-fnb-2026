import { en } from '@universityflow/content';
import type { Store } from '@universityflow/db';
import { SAMPLE_PHOTO_IDS } from '@universityflow/documents';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * The profile photo in the judge demo (owner's decision, 2026-10-23): made-up SAMPLE pictures
 * only. No real photo is ever taken, so no real person's picture is stored; a sample goes through
 * the same pipeline as an upload and is deleted with the judge's copy.
 */

process.env['UF_DEPLOYMENT'] = 'demo';
process.env['UF_DEMO_PROJECT'] = '1';
process.env['AUTH_SECRET'] = 'demo-test-secret-that-is-long-enough-0123456789';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

let n = 7_300_000;
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

const routes = {
  start: (await import('../app/api/demo/start/route')).POST,
  switch: (await import('../app/api/demo/switch/route')).POST,
  me: (await import('../app/api/me/route')).GET,
  photo: await import('../app/api/me/photo/route'),
  samplePhoto: (await import('../app/api/demo/sample-photos/[id]/route')).GET,
};
const { getServices } = await import('../lib/server/services');
const { photoAccess, photoMode } = await import('../lib/server/profile-photo');
const { sweepOldCopies } = await import('../lib/server/demo/core');
const MePage = (await import('../app/(app)/me/page')).default;

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

function sampleForm(sample: unknown, crop: unknown = { x: 0, y: 0, size: 1 }) {
  const body = new FormData();
  body.set('crop', JSON.stringify(crop));
  if (sample !== undefined) body.set('sample', String(sample));
  return body;
}

async function post(browser: Browser, body: FormData) {
  return browser.json<{ error?: string; detail?: string; photo?: { version: string } }>(
    routes.photo.POST,
    '/api/me/photo',
    { method: 'POST', body },
  );
}

/** A synthetic photo, drawn at runtime: what a judge might try to upload. */
async function realLookingPhoto() {
  return new Uint8Array(
    await sharp({ create: { width: 600, height: 600, channels: 3, background: '#884422' } })
      .jpeg()
      .toBuffer(),
  );
}

describe('the demo offers sample photos, with no switch to set', () => {
  it('UF_PROFILE_PHOTO stays refused on a demo (it means real uploads)', async () => {
    const { config } = await getServices();
    expect(config.demo).toBe(true);
    expect(config.profilePhoto).toBe(false);
  });

  it('GET /api/me offers the photo with the sample ids', async () => {
    const browser = await judge();
    const me = await browser.json<{ photo: unknown }>(routes.me, '/api/me');
    expect(me.body.photo).toEqual({ version: null, samples: [...SAMPLE_PHOTO_IDS] });
  });

  it('the About me page gives the card the sample picker', async () => {
    const browser = await judge();
    browser.enter();
    const page = (await MePage()) as { props: { photo: unknown } };
    expect(page.props.photo).toEqual({ version: null, samples: [...SAMPLE_PHOTO_IDS] });
  });

  it('every sample has words', () => {
    expect(Object.keys(en.demo.samplePhotos).sort()).toEqual([...SAMPLE_PHOTO_IDS].sort());
  });
});

describe('GET /api/demo/sample-photos/[id]', () => {
  it('serves each colour picture to the picker', async () => {
    for (const id of SAMPLE_PHOTO_IDS) {
      const response = await new Browser().call(
        routes.samplePhoto,
        `/api/demo/sample-photos/${id}`,
        {
          params: { id },
        },
      );
      expect(response.status, id).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/png');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      const meta = await sharp(new Uint8Array(await response.arrayBuffer())).metadata();
      expect(meta).toMatchObject({ width: 512, height: 512 });
    }
  });

  it('has nothing else', async () => {
    for (const id of ['sample-9', 'photo-1', '..%2Fsample-1']) {
      const response = await new Browser().call(
        routes.samplePhoto,
        `/api/demo/sample-photos/${id}`,
        {
          params: { id },
        },
      );
      expect(response.status, id).toBe(404);
    }
  });
});

describe('POST /api/me/photo in the demo: a sample id only', () => {
  it('keeps the chosen sample, cropped, through the photo pipeline', async () => {
    const browser = await judge();
    const { files } = await getServices();
    const put = vi.spyOn(files, 'put');
    const added = await post(browser, sampleForm('sample-3', { x: 0.25, y: 0.1, size: 0.5 }));
    expect(added.status).toBe(200);
    expect(added.body.photo?.version).toMatch(/^[0-9a-f]{16}$/);
    expect(put.mock.calls.at(-1)?.[0]).toMatch(/^photo-[0-9a-f]{32}$/);
    put.mockRestore();

    const served = await browser.call(routes.photo.GET, '/api/me/photo');
    expect(served.status).toBe(200);
    const meta = await sharp(new Uint8Array(await served.arrayBuffer())).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 512, height: 512, channels: 1 });
    const me = await browser.json<{ photo: unknown }>(routes.me, '/api/me');
    expect(me.body.photo).toEqual({
      version: added.body.photo?.version,
      samples: [...SAMPLE_PHOTO_IDS],
    });
  });

  it('refuses any uploaded file, with the demo’s own reason, and stores nothing', async () => {
    const browser = await judge();
    const { files } = await getServices();
    const put = vi.spyOn(files, 'put');
    const withFile = sampleForm(undefined);
    withFile.set('file', new Blob([await realLookingPhoto()], { type: 'image/jpeg' }), 'me.jpg');
    expect(await post(browser, withFile)).toMatchObject({
      status: 400,
      body: { error: 'upload', detail: 'demo-sample-photo-only' },
    });
    // A file alongside a sample id is refused too, however small.
    const both = sampleForm('sample-1');
    both.set(
      'file',
      new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
      'a.jpg',
    );
    expect((await post(browser, both)).body.detail).toBe('demo-sample-photo-only');
    expect(put).not.toHaveBeenCalled();
    put.mockRestore();
    expect((await browser.call(routes.photo.GET, '/api/me/photo')).status).toBe(404);
  });

  it('the wording stand-in (A11-31, 0037) never opens real uploads: still samples only', async () => {
    const { config } = await getServices();
    // The demo's SAMPLE pictures pass the database's consent-wording check by the preview's
    // stand-in; that stand-in never changes how a photo is chosen here.
    expect(photoAccess(config)).toEqual({ preview: true });
    expect(photoMode(config)).toBe('samples');
    expect(config.profilePhoto).toBe(false);
    const browser = await judge();
    const { files } = await getServices();
    const put = vi.spyOn(files, 'put');
    const real = new FormData();
    real.set('crop', JSON.stringify({ x: 0, y: 0, size: 1 }));
    real.set('file', new Blob([await realLookingPhoto()], { type: 'image/jpeg' }), 'me.jpg');
    expect((await post(browser, real)).body.detail).toBe('demo-sample-photo-only');
    expect(put).not.toHaveBeenCalled();
    put.mockRestore();
  });

  it('refuses a body the size of a photo before reading it', async () => {
    const browser = await judge();
    const big = sampleForm('sample-1');
    big.set('padding', 'x'.repeat(64 * 1024));
    expect(await post(browser, big)).toMatchObject({
      status: 400,
      body: { detail: 'demo-sample-photo-only' },
    });
  });

  it('refuses an unknown sample or a missing crop', async () => {
    const browser = await judge();
    for (const sample of ['sample-9', '../sample-1', '', undefined]) {
      expect((await post(browser, sampleForm(sample))).status, String(sample)).toBe(400);
    }
    expect((await post(browser, sampleForm('sample-1', { x: 0 }))).status).toBe(400);
  });

  it('refuses another site (CSRF)', async () => {
    const browser = await judge();
    const forged = await browser.json(routes.photo.POST, '/api/me/photo', {
      method: 'POST',
      body: sampleForm('sample-1'),
      origin: 'https://evil.example',
    });
    expect(forged.status).toBe(403);
  });

  it('"Remove photo" works as anywhere', async () => {
    const browser = await judge();
    await post(browser, sampleForm('sample-2'));
    const removed = await browser.json(routes.photo.DELETE, '/api/me/photo', { method: 'DELETE' });
    expect(removed).toMatchObject({ status: 200, body: { photo: null } });
    expect((await browser.call(routes.photo.GET, '/api/me/photo')).status).toBe(404);
  });
});

describe('deleted with the judge’s copy', () => {
  it('"Switch learner" deletes the sample photo’s file with the copy', async () => {
    const browser = await judge();
    const { files } = await getServices();
    const put = vi.spyOn(files, 'put');
    expect((await post(browser, sampleForm('sample-4'))).status).toBe(200);
    const key = put.mock.calls.at(-1)?.[0] as string;
    put.mockRestore();
    const switched = await browser.call(routes.switch, '/api/demo/switch', {
      method: 'POST',
      body: '',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(switched.status).toBe(303);
    expect(await files.get(key)).toBeNull();
  });

  it('the 24-hour sweep deletes the sample photo’s file with the copy', async () => {
    const browser = await judge();
    const services = await getServices();
    const put = vi.spyOn(services.files, 'put');
    expect((await post(browser, sampleForm('sample-5'))).status).toBe(200);
    const key = put.mock.calls.at(-1)?.[0] as string;
    put.mockRestore();
    expect(await services.files.get(key)).not.toBeNull();

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 25 * 60 * 60 * 1000));
    try {
      // The sweep takes a batch at a time: run it until this copy's turn has come.
      for (let i = 0; i < 20 && (await services.files.get(key)); i++) {
        await sweepOldCopies(services);
      }
    } finally {
      vi.useRealTimers();
    }
    expect(await services.files.get(key)).toBeNull();
  });
});
