import { en } from '@universityflow/content';
import { describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * A7-04 and A11-01 over the real route handlers and an embedded database.
 *
 * A7-04: an adult is told, and agrees, before their chats and report photos go to the AI
 * provider. Until that agreement is recorded, chat and every upload route refuse (403).
 *
 * A11-01: a minor whose guardian agreed to wording that never mentioned messaging (v1) can't opt
 * in to reminders, and the learner is told why ('consent-outdated').
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const { getServices } = await import('../lib/server/services');

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  me: await import('../app/api/me/route'),
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  adultConsent: (await import('../app/api/me/adult-consent/route')).POST,
  chat: await import('../app/api/chat/route'),
  documents: await import('../app/api/documents/route'),
  uploadTicket: (await import('../app/api/documents/uploads/route')).POST,
  messaging: await import('../app/api/me/messaging/route'),
  consent: (await import('../app/api/consent/[token]/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_100_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function signedIn() {
  const number = phone();
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const { body } = await browser.json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const pin = body.messages
    .find((m) => m.to === `+27${number.slice(1)}`)
    ?.body.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return browser;
}

/** An adult who has given a date of birth and nothing more. */
async function adultNotYetAgreed() {
  const browser = await signedIn();
  const dob = await browser.json(routes.dob, '/api/me/date-of-birth', {
    json: { dateOfBirth: '2000-02-02' },
  });
  expect(dob.body).toEqual({ consentStatus: 'not-required' });
  return browser;
}

const jpegForm = () => {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], { type: 'image/jpeg' }),
    'report.jpg',
  );
  return form;
};

describe('A7-04: an adult agrees before chat and uploads', () => {
  it('refuses chat and every upload route (403) until the adult agrees', async () => {
    const browser = await adultNotYetAgreed();
    const me = await browser.json<{ ready: boolean; account: { needsAdultConsent: boolean } }>(
      routes.me.GET,
      '/api/me',
    );
    expect(me.body).toMatchObject({ ready: false, account: { needsAdultConsent: true } });

    const chat = await browser.call(routes.chat.POST, '/api/chat', {
      json: { message: 'What can I study?' },
    });
    expect(chat.status).toBe(403);
    expect(await chat.json()).toMatchObject({ error: 'consent' });
    expect((await browser.json(routes.chat.GET, '/api/chat')).status).toBe(403);

    const upload = await browser.json(routes.documents.POST, '/api/documents', {
      method: 'POST',
      body: jpegForm(),
    });
    expect(upload).toMatchObject({ status: 403, body: { error: 'consent' } });
    const ticket = await browser.json(routes.uploadTicket, '/api/documents/uploads', {
      json: { contentType: 'image/jpeg', size: 10 },
    });
    expect(ticket).toMatchObject({ status: 403, body: { error: 'consent' } });
  });

  it('records the agreement with the version shown, then lets chat and uploads through', async () => {
    const browser = await adultNotYetAgreed();
    const agreed = await browser.json(routes.adultConsent, '/api/me/adult-consent', {
      json: { version: en.adultConsent.version },
    });
    expect(agreed.status).toBe(200);
    const me = await browser.json<{ ready: boolean }>(routes.me.GET, '/api/me');
    expect(me.body.ready).toBe(true);

    const chat = await browser.call(routes.chat.POST, '/api/chat', {
      json: { message: 'What can I study?' },
    });
    expect(chat.status).toBe(200);
    const upload = await browser.json(routes.documents.POST, '/api/documents', {
      method: 'POST',
      body: jpegForm(),
    });
    expect(upload.status).toBe(200);
  });

  it('refuses an agreement to wording the server no longer shows, or none at all', async () => {
    const browser = await adultNotYetAgreed();
    const stale = await browser.json(routes.adultConsent, '/api/me/adult-consent', {
      json: { version: 'adult-v0-2020-01' },
    });
    expect(stale).toMatchObject({ status: 409, body: { error: 'state' } });
    const empty = await browser.json(routes.adultConsent, '/api/me/adult-consent', {
      method: 'POST',
    });
    expect(empty.status).toBe(400);
    const me = await browser.json<{ ready: boolean }>(routes.me.GET, '/api/me');
    expect(me.body.ready).toBe(false);
  });
});

describe('A11-01: a minor’s reminders need consent wording that names messaging', () => {
  async function minorGrantedUnder(version: string) {
    const browser = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    const { store } = await getServices();
    const me = await browser.json<{ account: { id: string } }>(routes.me.GET, '/api/me');
    const { token } = await store.requestGuardianConsent(
      me.body.account.id,
      { name: 'Test Guardian', phone: phone(), relationship: 'parent' },
      version,
    );
    await store.grantConsent(token);
    return browser;
  }

  const optIn = (browser: Browser) =>
    browser.json(routes.messaging.PUT, '/api/me/messaging', {
      method: 'PUT',
      json: { channel: 'sms', optedIn: true },
    });

  it('refuses opt-in under v1 consent with a reason the app can explain', async () => {
    const browser = await minorGrantedUnder('v1-2026-10');
    expect(await optIn(browser)).toMatchObject({
      status: 403,
      body: { error: 'consent-outdated' },
    });
  });

  it('allows it under the current consent wording', async () => {
    const browser = await minorGrantedUnder(en.consent.version);
    expect((await optIn(browser)).status).toBe(200);
  });
});
