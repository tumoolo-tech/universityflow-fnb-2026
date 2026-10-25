import { en } from '@universityflow/content';
import type { StudentStore } from '@universityflow/db';
import { type PhotoRefusal, MAX_PHOTO_BYTES as SERVER_MAX } from '@universityflow/documents';
import { MAX_PHOTO_BYTES as CLIENT_MAX } from '@universityflow/ui';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentContext } from '../lib/server/agent-context';
import { readConfig } from '../lib/server/config';
import { homeData } from '../lib/server/home';
import { currentStudent } from '../lib/server/session';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

/**
 * The profile photo end to end (docs/design/profile-look-proposal.md §5.3), over the real
 * handlers: behind the server switch `UF_PROFILE_PHOTO`, consent first (hard rule 5), CSRF on
 * writes, 2 MB and JPEG/PNG in, 512 × 512 black and white with no metadata out, served only to
 * its owner, never to the AI, replaced and removed cleanly, deleted with the account and in the
 * export. Every photo is drawn at runtime (hard rule 4).
 */

const { getServices } = await import('../lib/server/services');
const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  me: await import('../app/api/me/route'),
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  exportData: (await import('../app/api/me/export/route')).GET,
  photo: await import('../app/api/me/photo/route'),
  chat: await import('../app/api/chat/route'),
  outbox: (await import('../app/api/dev/outbox/route')).GET,
  guardian: (await import('../app/api/me/guardian/route')).POST,
  consent: (await import('../app/api/consent/[token]/route')).POST,
  offers: await import('../app/api/offers/route'),
  offer: await import('../app/api/offers/[id]/route'),
  samplePhoto: (await import('../app/api/demo/sample-photos/[id]/route')).GET,
};
const { photoMode } = await import('../lib/server/profile-photo');
const MePage = (await import('../app/(app)/me/page')).default;

let n = 4_000_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function signedIn(number = phone()) {
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const { body } = await browser.json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  // The outbox lists the newest first: the PIN just sent.
  const pin = body.messages
    .find((m) => m.to === `+27${number.slice(1)}` && /\b\d{6}\b/.test(m.body))
    ?.body.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return browser;
}

async function adult() {
  const browser = await signedIn();
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  return browser;
}

/**
 * The server switch, as the services read it at start (readConfig): on, it is the owner's preview,
 * standing in for the wording that names the photo (no live wording does yet, A11-31).
 * api-photo-consent.test.ts covers the switch with the wording deciding.
 */
async function setSwitch(on: boolean) {
  const { config } = await getServices();
  Object.assign(config as object, { profilePhoto: on, profilePhotoPreview: on });
}
afterEach(() => setSwitch(true));

/** A synthetic photo with a camera's metadata, location included. */
async function photo(options: { format?: 'jpeg' | 'png'; width?: number } = {}) {
  const image = sharp({
    create: {
      width: options.width ?? 900,
      height: 600,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  }).withExif({
    IFD0: { Artist: 'Synthetic Artist', Model: 'TestCam' },
    IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '26/1 11/1 0/1' },
  });
  return new Uint8Array(
    options.format === 'png' ? await image.png().toBuffer() : await image.jpeg().toBuffer(),
  );
}

function form(bytes: Uint8Array, crop: unknown = { x: 0, y: 0, size: 1 }, type = 'image/jpeg') {
  const body = new FormData();
  body.set('crop', JSON.stringify(crop));
  body.set('file', new Blob([new Uint8Array(bytes)], { type }), 'photo.jpg');
  return body;
}

async function upload(browser: Browser, bytes: Uint8Array, crop?: unknown) {
  return browser.json<{ error?: string; detail?: string; photo?: { version: string } }>(
    routes.photo.POST,
    '/api/me/photo',
    { method: 'POST', body: form(bytes, crop) },
  );
}

async function fetchPhoto(browser: Browser) {
  return browser.call(routes.photo.GET, '/api/me/photo');
}

await setSwitch(true);

describe('the switch (UF_PROFILE_PHOTO)', () => {
  it('is off unless set, and production refuses it', () => {
    expect(readConfig({}).profilePhoto).toBe(false);
    expect(readConfig({ UF_PROFILE_PHOTO: '1' }).profilePhoto).toBe(true);
    expect(() =>
      readConfig({ NODE_ENV: 'production', UF_PROFILE_PHOTO: '1', UF_PROVIDERS: 'live' }),
    ).toThrow(/consent v4/);
  });

  it('a staging site refuses it too (a production build on a host outside South Africa)', () => {
    const staging = {
      NODE_ENV: 'production',
      RENDER: 'true',
      UF_DEPLOYMENT: 'staging',
      UF_PROVIDERS: 'local',
      AUTH_SECRET: 's'.repeat(44),
      UF_STAGING_PASSWORD: 'staging-test-password-0123',
    };
    expect(readConfig(staging)).toMatchObject({ staging: true, profilePhoto: false });
    expect(() => readConfig({ ...staging, UF_PROFILE_PHOTO: '1' })).toThrow(/staging site/);
  });

  it('off: the photo route answers 404 to everything but removal, and /api/me offers no photo', async () => {
    const browser = await adult();
    await setSwitch(false);
    expect((await upload(browser, await photo())).status).toBe(404);
    expect((await fetchPhoto(browser)).status).toBe(404);
    const me = await browser.json<{ photo: unknown }>(routes.me.GET, '/api/me');
    expect(me.body.photo).toBeNull();
    // Removing is always allowed: a learner can always take their data back.
    const removed = await browser.json(routes.photo.DELETE, '/api/me/photo', { method: 'DELETE' });
    expect(removed.status).toBe(200);
  });

  it('on: /api/me says a photo can be added, and none is there yet', async () => {
    const browser = await adult();
    const me = await browser.json<{ photo: unknown }>(routes.me.GET, '/api/me');
    expect(me.body.photo).toEqual({ version: null });
  });

  it('outside the judge demo, no sample pictures: an upload is needed, and a sample id is none', async () => {
    expect(photoMode({ demo: false, profilePhoto: true })).toBe('upload');
    expect(photoMode({ demo: false, profilePhoto: false })).toBeNull();
    expect(photoMode({ demo: true, profilePhoto: false })).toBe('samples');
    const browser = await adult();
    const body = new FormData();
    body.set('crop', JSON.stringify({ x: 0, y: 0, size: 1 }));
    body.set('sample', 'sample-1');
    const sampled = await browser.json(routes.photo.POST, '/api/me/photo', {
      method: 'POST',
      body,
    });
    expect(sampled.status).toBe(400);
    expect((await fetchPhoto(browser)).status).toBe(404);
    const picture = await browser.call(routes.samplePhoto, '/api/demo/sample-photos/sample-1', {
      params: { id: 'sample-1' },
    });
    expect(picture.status).toBe(404);
  });
});

describe('adding a photo', () => {
  it('keeps it 512 × 512, black and white, with no metadata, and serves it to its owner alone', async () => {
    const browser = await adult();
    const added = await upload(browser, await photo());
    expect(added.status).toBe(200);
    expect(added.body.photo?.version).toEqual(expect.any(String));

    const served = await fetchPhoto(browser);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/jpeg');
    expect(served.headers.get('cache-control')).toBe('private, no-store');
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');
    expect(served.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    const bytes = new Uint8Array(await served.arrayBuffer());
    const meta = await sharp(bytes).metadata();
    expect(meta).toMatchObject({ format: 'jpeg', width: 512, height: 512, channels: 1 });
    expect(meta.exif).toBeUndefined();
    const text = Buffer.from(bytes).toString('latin1');
    for (const trace of ['Exif', 'Synthetic', 'TestCam']) expect(text).not.toContain(trace);

    // GET /api/me says there is one (a version that changes when it does), never its key.
    const me = await browser.json<{ photo: { version: string }; profile: { hasPhoto: boolean } }>(
      routes.me.GET,
      '/api/me',
    );
    expect(me.body.photo.version).toBe(added.body.photo?.version);
    expect(me.body.profile.hasPhoto).toBe(true);
    expect(JSON.stringify(me.body)).not.toMatch(/photo-[0-9a-f]{32}/);
  });

  it('takes a PNG too', async () => {
    const browser = await adult();
    expect((await upload(browser, await photo({ format: 'png' }))).status).toBe(200);
  });

  it('refuses a file over 2 MB, before reading it, and one that isn’t a JPEG or PNG', async () => {
    expect(SERVER_MAX).toBe(CLIENT_MAX);
    const browser = await adult();
    const big = new Uint8Array(SERVER_MAX + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(await upload(browser, big)).toMatchObject({
      status: 400,
      body: { error: 'upload', detail: 'too-large' },
    });
    const webp = new Uint8Array(
      await sharp(await photo())
        .webp()
        .toBuffer(),
    );
    expect(await upload(browser, webp)).toMatchObject({
      status: 400,
      body: { error: 'upload', detail: 'unsupported-type' },
    });
    // Called .jpg, sent as image/jpeg, but a PDF inside.
    const pdf = new Uint8Array(Buffer.from('%PDF-1.7 synthetic'));
    expect(await upload(browser, pdf)).toMatchObject({
      status: 400,
      body: { detail: 'unsupported-type' },
    });
    const heic = new Uint8Array([0, 0, 0, 0x18, ...Buffer.from('ftypheic'), 0, 0, 0, 0]);
    expect(await upload(browser, heic)).toMatchObject({
      status: 400,
      body: { detail: 'heic-unsupported' },
    });
    expect((await fetchPhoto(browser)).status).toBe(404);
  });

  it('refuses a crop that is missing or off the photo', async () => {
    const browser = await adult();
    const good = await photo();
    for (const crop of [{ x: 0, y: 0 }, { x: 2, y: 0, size: 1 }, 'all of it', null]) {
      const result = await upload(browser, good, crop);
      expect(result.status, JSON.stringify(crop)).toBe(400);
    }
  });

  it('has a body length, and refuses a request without one', async () => {
    const browser = await adult();
    const result = await browser.json(routes.photo.POST, '/api/me/photo', {
      method: 'POST',
      body: 'x',
      headers: { 'content-type': 'multipart/form-data; boundary=x' },
    });
    expect(result.status).toBe(411);
  });

  it('refuses a cookie write from another site (CSRF)', async () => {
    const browser = await adult();
    const forged = await browser.json(routes.photo.POST, '/api/me/photo', {
      method: 'POST',
      body: form(await photo()),
      origin: 'https://evil.example',
    });
    expect(forged.status).toBe(403);
    const removed = await browser.json(routes.photo.DELETE, '/api/me/photo', {
      method: 'DELETE',
      origin: 'https://evil.example',
    });
    expect(removed.status).toBe(403);
  });

  it('touches nothing before a guardian consents (hard rule 5)', async () => {
    const browser = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-03-03' },
    });
    expect(await upload(browser, await photo())).toMatchObject({
      status: 403,
      body: { error: 'consent' },
    });
    expect((await fetchPhoto(browser)).status).toBe(403);
    const me = await browser.json<{ photo: unknown }>(routes.me.GET, '/api/me');
    expect(me.body.photo).toBeNull();
  });

  it('is never served to another learner', async () => {
    const owner = await adult();
    await upload(owner, await photo());
    const other = await adult();
    expect((await fetchPhoto(other)).status).toBe(404);
    expect((await fetchPhoto(new Browser())).status).toBe(401);
  });
});

describe('a learner past school, at university (the owner’s report, 2026-10-23)', () => {
  /**
   * A first-year: an adult on their own agreement who gave "Grade 12" last year, so school is
   * finished (A10-38), with an accepted offer, so the home's stage is "university". Outside the
   * judge demo (which refuses the switch on purpose), nothing about the stage hides the photo.
   */
  async function firstYear() {
    const number = phone();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2025-06-02T10:00:00Z'));
    try {
      const before = await signedIn(number);
      await before.json(routes.dob, '/api/me/date-of-birth', {
        json: { dateOfBirth: '2006-02-02' },
      });
      await agreeAsAdult(before);
      await before.json(routes.me.PATCH, '/api/me', {
        method: 'PATCH',
        json: { displayName: 'Synthetic', grade: 12 },
      });
    } finally {
      vi.useRealTimers();
    }
    // Today: signed in afresh, matric behind them, an offer accepted.
    const browser = await signedIn(number);
    const added = await browser.json<{ id: string }>(routes.offers.POST, '/api/offers', {
      json: { programmeId: 'uj-beng-civil', kind: 'final', replyBy: null, conditions: [] },
    });
    expect(added.status).toBe(201);
    const accepted = await browser.json(routes.offer.PATCH, `/api/offers/${added.body.id}`, {
      method: 'PATCH',
      json: { action: 'accept' },
      params: { id: added.body.id },
    });
    expect(accepted.status).toBe(200);
    return browser;
  }

  it('is a university-stage adult: ready, school finished, no grade on the card', async () => {
    const browser = await firstYear();
    const me = await browser.json<{
      ready: boolean;
      account: { needsAdultConsent: boolean };
      profile: { grade: number; schoolFinished: boolean };
    }>(routes.me.GET, '/api/me');
    expect(me.body).toMatchObject({
      ready: true,
      account: { needsAdultConsent: false },
      profile: { grade: 12, schoolFinished: true },
    });
    browser.enter();
    const signed = await currentStudent();
    const { catalogue } = await getServices();
    const home = await homeData(signed?.student as StudentStore, catalogue());
    expect(home.stage).toBe('university');
  });

  it('GET /api/me offers the photo, and the upload works on the web and from the app', async () => {
    const browser = await firstYear();
    const me = await browser.json<{ photo: unknown }>(routes.me.GET, '/api/me');
    expect(me.body.photo).toEqual({ version: null });

    const added = await upload(browser, await photo());
    expect(added.status).toBe(200);
    expect((await fetchPhoto(browser)).status).toBe(200);
    const after = await browser.json<{ photo: { version: string } }>(routes.me.GET, '/api/me');
    expect(after.body.photo.version).toBe(added.body.photo?.version);
  });

  it('the About me page gives the card the photo control, with no grade sticker', async () => {
    const browser = await firstYear();
    browser.enter();
    const page = (await MePage()) as { props: { photo: unknown; lookGrade: unknown } };
    expect(page.props.photo).toEqual({ version: null });
    expect(page.props.lookGrade).toBeNull();
  });
});

describe('removing it after consent ends (A11-32)', () => {
  it('a learner whose guardian withdrew consent can still remove the photo, and only that', async () => {
    const number = phone();
    let browser = await signedIn(number);
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    const guardianPhone = phone();
    // In the day: at night the consent SMS waits for 07:00.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));
    try {
      await browser.json(routes.guardian, '/api/me/guardian', {
        json: { name: 'Test Guardian', phone: guardianPhone, relationship: 'parent' },
      });
    } finally {
      vi.useRealTimers();
    }
    const { body } = await browser.json<{ messages: Array<{ to: string; body: string }> }>(
      routes.outbox,
      '/api/dev/outbox',
    );
    const link =
      body.messages
        .filter((m) => m.to === `+27${guardianPhone.slice(1)}`)
        .at(-1)
        ?.body.match(/\/consent\/([\w-]+)/)?.[1] ?? '';
    const guardian = new Browser();
    const decide = (action: 'grant' | 'withdraw') =>
      guardian.json(routes.consent, `/api/consent/${link}`, {
        json: { action },
        params: { token: link },
      });
    expect((await decide('grant')).status).toBe(200);

    const { files } = await getServices();
    const put = vi.spyOn(files, 'put');
    expect((await upload(browser, await photo())).status).toBe(200);
    const key = put.mock.calls.at(-1)?.[0] as string;
    put.mockRestore();
    expect((await decide('withdraw')).status).toBe(200);
    // A withdrawal signs the learner out; signing in again needs no consent (a new PIN, once
    // the one-a-minute limit has passed).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 5 * 60_000));
    try {
      browser = await signedIn(number);
    } finally {
      vi.useRealTimers();
    }

    // The withdrawal itself deleted the photo and its file (A11-31: used for nothing else).
    expect(await files.get(key)).toBeNull();
    // Nothing else: no photo can be seen or added now.
    expect((await fetchPhoto(browser)).status).toBe(403);
    expect((await upload(browser, await photo())).status).toBe(403);
    // A write from another site is still refused (CSRF).
    const forged = await browser.json(routes.photo.DELETE, '/api/me/photo', {
      method: 'DELETE',
      origin: 'https://evil.example',
    });
    expect(forged.status).toBe(403);
    // "Remove photo" is never refused, with nothing left to remove.
    const removed = await browser.json(routes.photo.DELETE, '/api/me/photo', { method: 'DELETE' });
    expect(removed).toMatchObject({ status: 200, body: { photo: null } });
    // Signed out: nobody's photo.
    const anonymous = await new Browser().json(routes.photo.DELETE, '/api/me/photo', {
      method: 'DELETE',
    });
    expect(anonymous.status).toBe(401);
  });

  it('a learner who has never had consent removes nothing and is not refused', async () => {
    const browser = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    const removed = await browser.json(routes.photo.DELETE, '/api/me/photo', { method: 'DELETE' });
    expect(removed).toMatchObject({ status: 200, body: { photo: null } });
  });
});

describe('replacing and removing it', () => {
  it('deletes the old file when a new photo replaces it', async () => {
    const browser = await adult();
    const { files } = await getServices();
    const put = vi.spyOn(files, 'put');
    const del = vi.spyOn(files, 'delete');
    await upload(browser, await photo());
    const first = put.mock.calls.at(-1)?.[0] as string;
    expect(first).toMatch(/^photo-[0-9a-f]{32}$/);
    const replaced = await upload(browser, await photo({ width: 1200 }));
    const second = put.mock.calls.at(-1)?.[0] as string;
    expect(second).not.toBe(first);
    expect(del).toHaveBeenCalledWith(first);
    expect(await files.get(first)).toBeNull();
    expect(await files.get(second)).not.toBeNull();
    expect(replaced.body.photo?.version).toMatch(/^[0-9a-f]{16}$/);
    put.mockRestore();
    del.mockRestore();
  });

  it('removes it in one call: the file goes, and the card falls back to the avatar', async () => {
    const browser = await adult();
    const { files } = await getServices();
    const put = vi.spyOn(files, 'put');
    await upload(browser, await photo());
    const key = put.mock.calls.at(-1)?.[0] as string;
    put.mockRestore();
    const removed = await browser.json(routes.photo.DELETE, '/api/me/photo', { method: 'DELETE' });
    expect(removed).toMatchObject({ status: 200, body: { photo: null } });
    expect(await files.get(key)).toBeNull();
    expect((await fetchPhoto(browser)).status).toBe(404);
    const me = await browser.json<{ photo: unknown; profile: { hasPhoto: boolean } }>(
      routes.me.GET,
      '/api/me',
    );
    expect(me.body).toMatchObject({ photo: { version: null }, profile: { hasPhoto: false } });
  });
});

describe('the learner’s rights', () => {
  it('puts the photo itself in the export, without its key', async () => {
    const browser = await adult();
    await upload(browser, await photo());
    const exported = await browser.call(routes.exportData, '/api/me/export');
    const raw = await exported.text();
    expect(raw).not.toMatch(/photo-[0-9a-f]{32}/);
    const data = JSON.parse(raw) as {
      personal: {
        profile: { hasPhoto: boolean };
        profilePhoto: { mimeType: string; base64: string };
      };
    };
    expect(data.personal.profile.hasPhoto).toBe(true);
    expect(data.personal.profilePhoto.mimeType).toBe('image/jpeg');
    const meta = await sharp(Buffer.from(data.personal.profilePhoto.base64, 'base64')).metadata();
    expect(meta).toMatchObject({ width: 512, height: 512 });
  });

  it('exports no photo when there is none', async () => {
    const browser = await adult();
    const exported = await browser.call(routes.exportData, '/api/me/export');
    const data = (await exported.json()) as { personal: { profilePhoto: unknown } };
    expect(data.personal.profilePhoto).toBeNull();
  });

  it('deletes the photo’s file with the account', async () => {
    const browser = await adult();
    const { files } = await getServices();
    const put = vi.spyOn(files, 'put');
    await upload(browser, await photo());
    const key = put.mock.calls.at(-1)?.[0] as string;
    put.mockRestore();
    const deleted = await browser.json(routes.me.DELETE, '/api/me', { method: 'DELETE' });
    expect(deleted.status).toBe(200);
    expect(await files.get(key)).toBeNull();
  });
});

describe('never sent to the AI', () => {
  it('is in no prompt, context, history or tool the model is given, and in no log', async () => {
    const browser = await adult();
    await browser.json(routes.me.PATCH, '/api/me', {
      method: 'PATCH',
      json: { displayName: 'Synthetic', grade: 11 },
    });
    const { files, model } = await getServices();
    const put = vi.spyOn(files, 'put');
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    await upload(browser, await photo());
    const key = put.mock.calls.at(-1)?.[0] as string;
    const bytes = (await files.get(key))?.bytes ?? new Uint8Array();
    const base64 = Buffer.from(bytes).toString('base64');
    put.mockRestore();

    const respond = vi.spyOn(model, 'respond');
    const response = await browser.call(routes.chat.POST, '/api/chat', {
      json: { message: 'What do I need for engineering? Can you see my photo?' },
    });
    await response.text();
    expect(respond).toHaveBeenCalled();
    const sent = JSON.stringify(respond.mock.calls.map(([request]) => request));
    expect(sent).toContain('Synthetic'); // the profile did reach the model…
    expect(sent).not.toContain(key); // …but not the photo
    expect(sent).not.toContain(base64.slice(0, 64));
    expect(sent).not.toMatch(/hasPhoto|photo-[0-9a-f]{32}|image\/jpeg/);
    const logged = JSON.stringify([...log.mock.calls, ...error.mock.calls]);
    expect(logged).not.toContain(key);

    // The agent's whole view of the learner (what its tools read): the profile, without the photo.
    browser.enter();
    const signed = await currentStudent();
    const { catalogue } = await getServices();
    const context = await agentContext(signed?.student as StudentStore, catalogue());
    const seen = JSON.stringify(await context.profile());
    expect(seen).toContain('Synthetic');
    expect(seen).not.toMatch(/photo|hasPhoto/i);
    respond.mockRestore();
    log.mockRestore();
    error.mockRestore();
  });
});

describe('the words for every refusal', () => {
  it('has a sentence for every reason the server gives', () => {
    const reasons: PhotoRefusal[] = [
      'empty',
      'too-large',
      'unsupported-type',
      'heic-unsupported',
      'unreadable',
      'bad-crop',
    ];
    expect(Object.keys(en.profilePhoto.errors).sort()).toEqual([...reasons].sort());
  });
});
