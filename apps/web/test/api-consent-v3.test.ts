import { en } from '@universityflow/content';
import {
  adultConsentVersionNumber,
  consentVersionNumber,
  UNIVERSITY_DOCUMENTS_ADULT_CONSENT_VERSION,
  UNIVERSITY_DOCUMENTS_CONSENT_VERSION,
} from '@universityflow/db';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, errorMessage } from '../lib/client/api';
import { Browser } from './harness';

/**
 * A11-13 over the real route handlers and an embedded database. An offer letter or a proof of
 * registration goes whole to the AI provider, with an ID or student number on it; guardian
 * consent v3 and adult agreement adult-v2 are the first wording that names them.
 *
 * - A minor whose guardian agreed to v2 can't upload either one, and is told why
 *   ('consent-outdated', detail 'university-documents'); the stored file is removed again, and
 *   nothing reaches a reader. A report still uploads.
 * - An adult who agreed to adult-v1 is asked again before anything else, as A7-04 asked adults
 *   who had agreed to nothing; agreeing to the wording shown lets them through.
 *
 * And A11-17: an ID or student number in a quoted condition is refused with a reason the app
 * can show ('state', detail 'personal-number').
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
  offers: await import('../app/api/offers/route'),
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_200_000;
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

async function accountId(browser: Browser) {
  const me = await browser.json<{ account: { id: string } }>(routes.me.GET, '/api/me');
  return me.body.account.id;
}

async function minorGrantedUnder(version: string) {
  const browser = await signedIn();
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2010-05-05' } });
  const { store } = await getServices();
  const { token } = await store.requestGuardianConsent(
    await accountId(browser),
    { name: 'Test Guardian', phone: phone(), relationship: 'parent' },
    version,
  );
  await store.grantConsent(token);
  return browser;
}

const pdfForm = (kind?: string) => {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new TextEncoder().encode('%PDF-1.4 synthetic')], { type: 'application/pdf' }),
    'upload.pdf',
  );
  if (kind) form.append('kind', kind);
  return form;
};

const upload = (browser: Browser, kind?: string) =>
  browser.json(routes.documents.POST, '/api/documents', { method: 'POST', body: pdfForm(kind) });

describe('A11-13: letters and proofs need consent wording that names them', () => {
  it('the wording the server shows is the version the database asks for', () => {
    expect(consentVersionNumber(en.consent.version)).toBeGreaterThanOrEqual(
      UNIVERSITY_DOCUMENTS_CONSENT_VERSION,
    );
    expect(adultConsentVersionNumber(en.adultConsent.version)).toBeGreaterThanOrEqual(
      UNIVERSITY_DOCUMENTS_ADULT_CONSENT_VERSION,
    );
  });

  it('refuses a minor under guardian v2 a letter and a proof, says why, and removes the file', async () => {
    const browser = await minorGrantedUnder('v2-2026-10');
    const { files, letterReader, registrationReader } = await getServices();
    const removed = vi.spyOn(files, 'delete');
    const readLetter = vi.spyOn(letterReader, 'read');
    const readProof = vi.spyOn(registrationReader, 'read');
    for (const kind of ['acceptance-letter', 'proof-of-registration']) {
      expect(await upload(browser, kind), kind).toMatchObject({
        status: 403,
        body: { error: 'consent-outdated', detail: 'university-documents' },
      });
    }
    expect(removed).toHaveBeenCalledTimes(2);
    expect(readLetter).not.toHaveBeenCalled();
    expect(readProof).not.toHaveBeenCalled();
    removed.mockRestore();
    readLetter.mockRestore();
    readProof.mockRestore();
    // A report is covered by v2.
    expect((await upload(browser)).status).toBe(200);
    const listed = await browser.json<{ documents: Array<{ kind: string }> }>(
      routes.documents.GET,
      '/api/documents',
    );
    expect(listed.body.documents.map((d) => d.kind)).toEqual(['grade-11-report']);
  });

  it('lets a minor under the current guardian wording upload a letter', async () => {
    const browser = await minorGrantedUnder(en.consent.version);
    expect((await upload(browser, 'acceptance-letter')).status).toBe(200);
  });

  it('asks an adult who agreed to adult-v1 again, before chat or any upload', async () => {
    const browser = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2000-02-02' },
    });
    const { store } = await getServices();
    await store.consentAsAdult(await accountId(browser), 'adult-v1-2026-10');

    const me = await browser.json<{ ready: boolean; account: { needsAdultConsent: boolean } }>(
      routes.me.GET,
      '/api/me',
    );
    expect(me.body).toMatchObject({ ready: false, account: { needsAdultConsent: true } });
    const chat = await browser.call(routes.chat.POST, '/api/chat', {
      json: { message: 'What can I study?' },
    });
    expect(chat.status).toBe(403);
    expect(await upload(browser, 'acceptance-letter')).toMatchObject({
      status: 403,
      body: { error: 'consent' },
    });

    const agreed = await browser.json(routes.adultConsent, '/api/me/adult-consent', {
      json: { version: en.adultConsent.version },
    });
    expect(agreed.status).toBe(200);
    expect((await browser.json<{ ready: boolean }>(routes.me.GET, '/api/me')).body.ready).toBe(
      true,
    );
    expect((await upload(browser, 'acceptance-letter')).status).toBe(200);
  });

  it('A11-17: an offer whose condition holds an ID number is refused with a reason', async () => {
    const browser = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2000-02-02' },
    });
    await browser.json(routes.adultConsent, '/api/me/adult-consent', {
      json: { version: en.adultConsent.version },
    });
    const refused = await browser.json(routes.offers.POST, '/api/offers', {
      json: {
        programmeId: 'uj-beng-civil',
        kind: 'provisional',
        replyBy: null,
        conditions: ['ID 1234567890123: pass Mathematics'],
      },
    });
    expect(refused).toMatchObject({
      status: 409,
      body: { error: 'state', detail: 'personal-number' },
    });
  });

  it('the web app explains the refusal in its own words', () => {
    expect(errorMessage(new ApiError(403, 'consent-outdated', 'university-documents'))).toBe(
      en.errors.consentOutdatedDocuments,
    );
    // A5-09 (A1-37): a number locked by wrong PINs is told so, not "wait a few minutes".
    expect(errorMessage(new ApiError(429, 'pin-locked', null))).toBe(en.auth.errors.pinLocked);
    expect(errorMessage(new ApiError(403, 'consent-outdated', null))).toBe(
      en.errors.consentOutdated,
    );
    // A11-17: a condition or module holding an ID or student number is refused with a reason.
    expect(errorMessage(new ApiError(409, 'state', 'personal-number'))).toBe(
      en.offers.errors['personal-number'],
    );
  });
});
