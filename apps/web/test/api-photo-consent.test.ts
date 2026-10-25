import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentStudent } from '../lib/server/session';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

/**
 * A11-31 over the real handlers: the photo as it will run once consent v4 is live
 * (`UF_PROFILE_PHOTO=1`, no preview standing in for the wording; docs/deploy/profile-photo.md).
 * A learner whose consent names the photo (here adult-v3, a test version) adds, sees and removes
 * it. One under older wording (adult-v2, live today) is offered no photo, an upload is refused
 * with its own reason and nothing is kept, and a photo kept earlier in the preview is not served,
 * but is in their export and can be removed. A guardian's withdrawal deletes the photo and its
 * file. Every photo is drawn at runtime (hard rule 4).
 */

const { getServices } = await import('../lib/server/services');
const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  me: await import('../app/api/me/route'),
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  exportData: (await import('../app/api/me/export/route')).GET,
  photo: await import('../app/api/me/photo/route'),
  outbox: (await import('../app/api/dev/outbox/route')).GET,
  guardian: (await import('../app/api/me/guardian/route')).POST,
  consent: (await import('../app/api/consent/[token]/route')).POST,
};

let n = 4_370_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function signedIn(number = phone()) {
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const { body } = await browser.json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const pin = body.messages
    .find((m) => m.to === `+27${number.slice(1)}` && /\b\d{6}\b/.test(m.body))
    ?.body.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return browser;
}

async function studentOf(browser: Browser) {
  browser.enter();
  const signed = await currentStudent();
  if (!signed) throw new Error('not signed in');
  return signed;
}

/** An adult on the live agreement (adult-v2), which doesn't name the photo. */
async function adultV2() {
  const browser = await signedIn();
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  return browser;
}

/** An adult who agreed to wording that names the photo (adult-v3; a test version). */
async function adultV3() {
  const browser = await signedIn();
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  const { studentId } = await studentOf(browser);
  await (await getServices()).store.consentAsAdult(studentId, 'adult-v3-test');
  return browser;
}

/** The switch on, and whether the preview stands in for the wording (as config.ts decides). */
async function setSwitch(preview: boolean) {
  const { config } = await getServices();
  Object.assign(config as object, { profilePhoto: true, profilePhotoPreview: preview });
}
afterEach(() => setSwitch(true));

async function photo() {
  return new Uint8Array(
    await sharp({
      create: { width: 640, height: 480, channels: 3, background: { r: 30, g: 90, b: 160 } },
    })
      .jpeg()
      .toBuffer(),
  );
}

function upload(browser: Browser, bytes: Uint8Array) {
  const body = new FormData();
  body.set('crop', JSON.stringify({ x: 0, y: 0, size: 1 }));
  body.set('file', new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), 'photo.jpg');
  return browser.json<{ error?: string; detail?: string; photo?: { version: string } }>(
    routes.photo.POST,
    '/api/me/photo',
    { method: 'POST', body },
  );
}

describe('with consent v4 live: the wording on record decides (A11-31)', () => {
  it('a learner whose consent names the photo adds it, sees it and removes it', async () => {
    await setSwitch(false);
    const browser = await adultV3();
    const me = await browser.json<{ photo: unknown }>(routes.me.GET, '/api/me');
    expect(me.body.photo).toEqual({ version: null });
    const added = await upload(browser, await photo());
    expect(added.status).toBe(200);
    expect((await browser.call(routes.photo.GET, '/api/me/photo')).status).toBe(200);
    const removed = await browser.json(routes.photo.DELETE, '/api/me/photo', { method: 'DELETE' });
    expect(removed.status).toBe(200);
  });

  it('a learner under older wording is offered no photo, and an upload is refused with nothing kept', async () => {
    await setSwitch(false);
    const browser = await adultV2();
    const me = await browser.json<{ photo: unknown }>(routes.me.GET, '/api/me');
    expect(me.body.photo).toBeNull();
    const { files } = await getServices();
    const put = vi.spyOn(files, 'put');
    const del = vi.spyOn(files, 'delete');
    const refused = await upload(browser, await photo());
    expect(refused).toMatchObject({
      status: 403,
      body: { error: 'consent-outdated', detail: 'photo-consent' },
    });
    // Refused before a byte is kept: nothing stored, so nothing to delete.
    expect(put).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    put.mockRestore();
    del.mockRestore();
    expect((await browser.call(routes.photo.GET, '/api/me/photo')).status).toBe(404);
  });

  it('a photo kept in the preview under older wording is not served, is in the export, and can be removed', async () => {
    const browser = await adultV2();
    const { files } = await getServices();
    const put = vi.spyOn(files, 'put');
    expect((await upload(browser, await photo())).status).toBe(200);
    const key = put.mock.calls.at(-1)?.[0] as string;
    put.mockRestore();
    // The wording becomes what decides: the preview no longer stands in.
    await setSwitch(false);
    expect((await browser.call(routes.photo.GET, '/api/me/photo')).status).toBe(404);
    const me = await browser.json<{ photo: unknown }>(routes.me.GET, '/api/me');
    expect(me.body.photo).toBeNull();
    const exported = await browser.call(routes.exportData, '/api/me/export');
    const data = (await exported.json()) as { personal: { profilePhoto: { base64: string } } };
    expect(data.personal.profilePhoto?.base64.length).toBeGreaterThan(0);
    const removed = await browser.json(routes.photo.DELETE, '/api/me/photo', { method: 'DELETE' });
    expect(removed.status).toBe(200);
    expect(await files.get(key)).toBeNull();
  });
});

describe('a guardian’s withdrawal deletes the photo (used for nothing else)', () => {
  it('the record and the file go at once', async () => {
    const browser = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    const guardianPhone = phone();
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
    // The preview stands in for guardian v4 here (the live wording is v3).
    expect((await upload(browser, await photo())).status).toBe(200);
    const key = put.mock.calls.at(-1)?.[0] as string;
    put.mockRestore();
    expect(await files.get(key)).not.toBeNull();
    expect((await decide('withdraw')).status).toBe(200);
    expect(await files.get(key)).toBeNull();
  });
});
