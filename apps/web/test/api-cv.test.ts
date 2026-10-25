import { en } from '@universityflow/content';
import {
  type CvEntryRecord,
  MAX_CV_WEBHOOK_BYTES,
  MemoryCvEngine,
  MMEREKO_SIGNATURE_HEADER,
  signCvWebhook,
} from '@universityflow/cv';
import type { CvDocumentRecord, CvShareRecord } from '@universityflow/db';
import { signWebhook } from '@universityflow/messaging';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../lib/server/config';
import { QUOTAS } from '../lib/server/http';
import { createServices, type Services } from '../lib/server/services';
import { agreeAsAdult } from './adult-consent';
import { Browser, chunkedRequest } from './harness';

/**
 * My CV's API (docs/design/mmereko-api-proposal.md §10.3) over the real route handlers, an
 * embedded database and the stand-in engine, with the owner's switch on (UF_CV=1, the preview):
 * 404 with the switch off; the opt-in; entries with the crisis check on every save (§7.5); what
 * is ticked (marks off unless ticked, D11); queuing a base or tailored CV and collecting it
 * through the signed webhook; the 60-second PDF link; the ATS scan; "every line is true"; 18+
 * share links served by UniversityFlow (D5); withdrawal (D15); export; and nothing personal in a
 * log. Synthetic learners only.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const WEBHOOK = 'api-cv-test-webhook-secret-of-at-least-32-chars';
const engine = new MemoryCvEngine({ webhookSecret: WEBHOOK });
type Global = { __ufServices?: Promise<Services> | null };
const on = createServices(readConfig({ ...process.env, UF_CV: '1' }), { cvEngine: engine });
const off = createServices(readConfig({ ...process.env, UF_CV: undefined }));
(globalThis as Global).__ufServices = on;
afterAll(() => {
  (globalThis as Global).__ufServices = null;
});
afterEach(() => {
  vi.restoreAllMocks();
});

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  me: await import('../app/api/me/route'),
  exportData: (await import('../app/api/me/export/route')).GET,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
  optIn: await import('../app/api/me/cv/opt-in/route'),
  entries: await import('../app/api/me/cv/entries/route'),
  entry: await import('../app/api/me/cv/entries/[id]/route'),
  selection: await import('../app/api/me/cv/selection/route'),
  drafts: (await import('../app/api/me/cv/drafts/route')).POST,
  tailorings: (await import('../app/api/me/cv/tailorings/route')).POST,
  atsScan: (await import('../app/api/me/cv/ats-scan/route')).POST,
  documents: (await import('../app/api/me/cv/documents/route')).GET,
  document: (await import('../app/api/me/cv/documents/[id]/route')).GET,
  confirm: (await import('../app/api/me/cv/documents/[id]/confirm/route')).POST,
  shares: await import('../app/api/me/cv/shares/route'),
  pdf: (await import('../app/api/cv/pdf/[id]/route')).GET,
  sharePage: (await import('../app/cv/s/[token]/route')).GET,
  webhook: (await import('../app/api/integrations/mmereko/webhook/route')).POST,
};

let n = 4_500_000;
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function signedIn() {
  const number = phone();
  const browser = new Browser();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const { body } = await new Browser().json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const pin = body.messages
    .find((m) => m.to === `+27${number.slice(1)}` && /\b\d{6}\b/.test(m.body))
    ?.body.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return browser;
}

async function accountId(browser: Browser) {
  const me = await browser.json<{ account: { id: string } }>(routes.me.GET, '/api/me');
  return me.body.account.id;
}

/** An adult in their own name, with a first name and a school, opted in to the CV. */
async function adult(share = false) {
  const browser = await signedIn();
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  const id = await accountId(browser);
  const { store } = await on;
  await store
    .forStudent(id)
    .updateProfile({ displayName: 'Thandi', schoolName: 'Example High School', grade: 12 });
  const opted = await browser.json(routes.optIn.POST, '/api/me/cv/opt-in', { json: { share } });
  expect(opted.status).toBe(200);
  return { browser, id };
}

async function minor() {
  const browser = await signedIn();
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2010-05-05' } });
  const id = await accountId(browser);
  const { store } = await on;
  const { token } = await store.requestGuardianConsent(
    id,
    { name: 'Test Guardian', phone: phone(), relationship: 'parent' },
    'v3-test',
  );
  await store.grantConsent(token);
  await store
    .forStudent(id)
    .updateProfile({ displayName: 'Sipho', schoolName: 'Example High School', grade: 11 });
  return { browser, id };
}

const ENTRY = {
  kind: 'project',
  title: 'Campus bus tracker',
  organisation: null,
  role: 'Solo developer',
  startDate: '2026-03',
  endDate: null,
  description: 'A page that shows when the next bus leaves.',
  highlights: ['Used by my residence'],
  keywords: ['Python'],
  evidence: [{ kind: 'repository', url: 'https://github.com/example-learner/bus', label: 'Code' }],
  linkedModules: [],
};

async function runJobs() {
  const services = await on;
  return services.jobRunner?.runDue(services.jobHandlers);
}

/** Queues a base CV, lets the engine finish it, posts its webhook and collects it. */
async function makeCv(browser: Browser) {
  await browser.json(routes.selection.PUT, '/api/me/cv/selection', {
    method: 'PUT',
    json: { ...SELECTION, surname: 'Example', includeSchool: true },
  });
  const made = await browser.json<{ document: CvDocumentRecord }>(
    routes.drafts,
    '/api/me/cv/drafts',
    {
      json: {},
    },
  );
  expect(made.status).toBe(202);
  const createDraft = vi.spyOn(engine, 'createDraft');
  await runJobs();
  // Other learners' queued CVs may run in the same pass: find this one's by its key (its row id).
  const call = createDraft.mock.calls.findIndex(([, key]) => key === made.body.document.id);
  const sent = createDraft.mock.results[call];
  if (!sent) throw new Error('The CV was not sent');
  const { jobId } = await (sent.value as Promise<{ jobId: string }>);
  await engine.complete(jobId);
  const delivery = engine.webhooks.at(-1);
  const answer = await new Browser().call(routes.webhook, '/api/integrations/mmereko/webhook', {
    body: delivery?.body ?? '',
    headers: { ...(delivery?.headers ?? {}) },
    origin: null,
  });
  expect(answer.status).toBe(200);
  await runJobs();
  return made.body.document.id;
}

const SELECTION = {
  surname: null,
  label: null,
  summary: null,
  email: null,
  phone: null,
  city: null,
  region: null,
  includeSchool: false,
  subjectIds: [],
  includeOffer: false,
  moduleCodes: [],
  entryIds: [],
};

describe('the switch (D8)', () => {
  it('answers 404 everywhere while UF_CV is off', async () => {
    const { browser } = await adult();
    (globalThis as Global).__ufServices = off;
    try {
      expect((await browser.call(routes.optIn.GET, '/api/me/cv/opt-in')).status).toBe(404);
      expect(
        (await browser.call(routes.entries.POST, '/api/me/cv/entries', { json: ENTRY })).status,
      ).toBe(404);
      expect((await browser.call(routes.drafts, '/api/me/cv/drafts', { json: {} })).status).toBe(
        404,
      );
      expect(
        (
          await new Browser().call(routes.webhook, '/api/integrations/mmereko/webhook', {
            body: '{}',
            origin: null,
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await new Browser().call(routes.sharePage, '/cv/s/x', {
            params: { token: 'x'.repeat(43) },
          })
        ).status,
      ).toBe(404);
    } finally {
      (globalThis as Global).__ufServices = on;
    }
  });
});

describe('the opt-in (§9.1 item 3)', () => {
  it('reads, gives and refuses sharing below 18', async () => {
    const browser = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2000-02-02' },
    });
    await agreeAsAdult(browser);
    const before = await browser.json(routes.optIn.GET, '/api/me/cv/opt-in');
    expect(before.body).toMatchObject({
      optIn: null,
      wordingCovers: true,
      mayShare: false,
      canShare: true,
    });
    const given = await browser.json<{ optIn: { purposes: string[]; version: string } }>(
      routes.optIn.POST,
      '/api/me/cv/opt-in',
      { json: { share: true } },
    );
    expect(given.body.optIn).toMatchObject({ version: en.cv.optInVersion });
    expect(given.body.optIn.purposes).toContain('cv.share');
    expect((await browser.json(routes.optIn.GET, '/api/me/cv/opt-in')).body).toMatchObject({
      mayShare: true,
    });

    const young = await minor();
    const refused = await young.browser.json(routes.optIn.POST, '/api/me/cv/opt-in', {
      json: { share: true },
    });
    expect(refused).toEqual({ status: 403, body: { error: 'forbidden', detail: 'cv-share-age' } });
    expect(
      (await young.browser.json(routes.optIn.POST, '/api/me/cv/opt-in', { json: {} })).status,
    ).toBe(200);
  });

  it('refuses a cross-site write (CSRF)', async () => {
    const { browser } = await adult();
    const forged = await browser.call(routes.optIn.POST, '/api/me/cv/opt-in', {
      json: {},
      origin: 'https://evil.example',
    });
    expect(forged.status).toBe(403);
  });
});

describe('entries (§3.3), crisis-checked on every save (§7.5)', () => {
  it('saves an entry, reads it back, edits and deletes it; another learner can’t touch it', async () => {
    const { browser } = await adult();
    const saved = await browser.json<{ entry: CvEntryRecord; care: unknown }>(
      routes.entries.POST,
      '/api/me/cv/entries',
      { json: ENTRY },
    );
    expect(saved.status).toBe(200);
    expect(saved.body.care).toBeNull();
    const id = saved.body.entry.id;
    const list = await browser.json<{ entries: CvEntryRecord[] }>(
      routes.entries.GET,
      '/api/me/cv/entries',
    );
    expect(list.body.entries.map((e) => e.title)).toEqual(['Campus bus tracker']);
    const edited = await browser.json<{ entry: CvEntryRecord }>(
      routes.entry.PATCH,
      `/api/me/cv/entries/${id}`,
      {
        method: 'PATCH',
        json: { title: 'Bus tracker' },
        params: { id },
      },
    );
    expect(edited.body.entry.title).toBe('Bus tracker');
    const other = await adult();
    const stolen = await other.browser.call(routes.entry.PATCH, `/api/me/cv/entries/${id}`, {
      method: 'PATCH',
      json: { title: 'Mine' },
      params: { id },
    });
    expect(stolen.status).toBe(404);
    expect(
      (
        await browser.call(routes.entry.DELETE, `/api/me/cv/entries/${id}`, {
          method: 'DELETE',
          params: { id },
        })
      ).status,
    ).toBe(200);
  });

  it('shows the crisis card at once, saves the words anyway, and keeps nothing about the check', async () => {
    const { browser } = await adult();
    const logged = vi.spyOn(console, 'error');
    const saved = await browser.json<{ entry: CvEntryRecord; care: { level: string } | null }>(
      routes.entries.POST,
      '/api/me/cv/entries',
      {
        json: {
          ...ENTRY,
          kind: 'work',
          title: 'Shop assistant',
          description: 'I left because I want to die',
        },
      },
    );
    expect(saved.status).toBe(200);
    expect(saved.body.care?.level).toBe('crisis');
    expect(saved.body.entry.description).toBe('I left because I want to die');
    expect(JSON.stringify(logged.mock.calls)).not.toContain('die');
  });

  it('refuses an ID number with a reason, and an http link', async () => {
    const { browser } = await adult();
    const id = ['8', '0', '0', '1', '0', '1', '5', '0', '0', '9', '0', '8', '7'].join('');
    expect(
      await browser.json(routes.entries.POST, '/api/me/cv/entries', {
        json: { ...ENTRY, description: `ID ${id}` },
      }),
    ).toEqual({ status: 409, body: { error: 'state', detail: 'personal-number' } });
    const http = await browser.call(routes.entries.POST, '/api/me/cv/entries', {
      json: { ...ENTRY, evidence: [{ kind: 'demo', url: 'http://example.org', label: null }] },
    });
    expect(http.status).toBe(400);
  });
});

describe('what goes on the CV (D9, D11)', () => {
  it('lists what can be ticked, and puts marks on only when a subject is ticked', async () => {
    const { browser, id } = await adult();
    const { store } = await on;
    await store.forStudent(id).saveConfirmedReport({
      kind: 'grade-11-final',
      marks: [
        { subject: 'mathematics', percent: 78 },
        { subject: 'english-hl', percent: 66 },
      ],
    });
    const read = await browser.json<{
      available: { subjects: Array<{ id: string; percent: number }>; school: unknown };
      ready: boolean;
    }>(routes.selection.GET, '/api/me/cv/selection');
    expect(read.body.available.subjects.map((s) => s.id).sort()).toEqual([
      'english-hl',
      'mathematics',
    ]);
    expect(read.body.ready).toBe(false);
    const ticked = await browser.json<{
      profile: { education: Array<{ xSubjects?: unknown }> };
      ready: boolean;
    }>(routes.selection.PUT, '/api/me/cv/selection', {
      method: 'PUT',
      json: { ...SELECTION, includeSchool: true },
    });
    expect(ticked.body.ready).toBe(true);
    expect(JSON.stringify(ticked.body.profile)).not.toContain('78%');
    const marks = await browser.json<{ profile: unknown }>(
      routes.selection.PUT,
      '/api/me/cv/selection',
      {
        method: 'PUT',
        json: { ...SELECTION, includeSchool: true, subjectIds: ['mathematics'] },
      },
    );
    expect(JSON.stringify(marks.body.profile)).toContain('78%');
    expect(JSON.stringify(marks.body.profile)).not.toContain('66%');
  });

  it('never names a university or course from an unverified catalogue record (hard rule 3)', async () => {
    const { browser, id } = await adult();
    const { store } = await on;
    const student = store.forStudent(id);
    const offerId = await student.addOffer({
      universityId: 'uj',
      programmeId: 'uj-beng-civil',
      kind: 'final',
      replyBy: null,
      conditions: [],
    });
    await student.acceptOffer(offerId);
    const read = await browser.json<{
      available: { offer: { university: string | null; course: string | null } | null };
      profile: unknown;
      omitted: unknown[];
    }>(routes.selection.PUT, '/api/me/cv/selection', {
      method: 'PUT',
      json: { ...SELECTION, includeOffer: true },
    });
    // The catalogue is researched but not yet verified by a person: nothing of it reaches a CV.
    expect(read.body.available.offer).toEqual({ university: null, course: null });
    expect(read.body.omitted).toContainEqual({ source: 'offer', reason: 'unverified' });
    expect(JSON.stringify(read.body.profile)).not.toContain('Johannesburg');
  });

  it('crisis-checks the summary the learner writes', async () => {
    const { browser } = await adult();
    const saved = await browser.json<{ care: { level: string } | null }>(
      routes.selection.PUT,
      '/api/me/cv/selection',
      {
        method: 'PUT',
        json: { ...SELECTION, summary: 'Honestly I want to kill myself' },
      },
    );
    expect(saved.body.care?.level).toBe('crisis');
  });
});

describe('making a CV (§5.3)', () => {
  it('queues it, collects it through the signed webhook, and serves the PDF by a 60-second link', async () => {
    const { browser } = await adult();
    const id = await makeCv(browser);
    const one = await browser.json<{
      document: CvDocumentRecord;
      pdf: { url: string; expiresAt: string };
    }>(routes.document, `/api/me/cv/documents/${id}`, { params: { id } });
    expect(one.body.document).toMatchObject({ status: 'ready', hasPdf: true });
    const url = new URL(one.body.pdf.url);
    expect(Date.parse(one.body.pdf.expiresAt) - Date.now()).toBeLessThanOrEqual(60_000);
    const pdf = await new Browser().call(routes.pdf, url.pathname + url.search, { params: { id } });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('cache-control')).toContain('no-store');
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))).toBe('%PDF-');
    const forged = await new Browser().call(
      routes.pdf,
      `${url.pathname}?exp=${url.searchParams.get('exp')}&sig=${'0'.repeat(64)}`,
      {
        params: { id },
      },
    );
    expect(forged.status).toBe(404);
    const list = await browser.json<{ documents: CvDocumentRecord[] }>(
      routes.documents,
      '/api/me/cv/documents',
    );
    expect(list.body.documents.map((d) => d.id)).toEqual([id]);
  });

  it('makes one CV at a time, needs a name and a school, and has a daily limit', async () => {
    const { browser } = await adult();
    expect(await browser.json(routes.drafts, '/api/me/cv/drafts', { json: {} })).toEqual({
      status: 409,
      body: { error: 'state', detail: 'cv-incomplete' },
    });
    await browser.json(routes.selection.PUT, '/api/me/cv/selection', {
      method: 'PUT',
      json: { ...SELECTION, includeSchool: true },
    });
    expect((await browser.call(routes.drafts, '/api/me/cv/drafts', { json: {} })).status).toBe(202);
    expect(await browser.json(routes.drafts, '/api/me/cv/drafts', { json: {} })).toEqual({
      status: 409,
      body: { error: 'state', detail: 'cv-busy' },
    });
    const services = await on;
    vi.spyOn(services.store, 'allow').mockResolvedValueOnce(false);
    expect(
      (
        await browser.call(routes.tailorings, '/api/me/cv/tailorings', {
          json: { advert: { title: 'Junior developer', company: null, text: 'Python.' } },
        })
      ).status,
    ).toBe(429);
  });

  it('tailors to an advert without keeping its text, and scores a CV against one', async () => {
    const { browser } = await adult();
    const id = await makeCv(browser);
    const advert = {
      title: 'Junior developer',
      company: 'Example Software',
      text: 'Python, Flask and Git, please.',
    };
    const scan = await browser.json<{ ats: { coveragePct: number; missing: string[] } }>(
      routes.atsScan,
      '/api/me/cv/ats-scan',
      { json: { documentId: id, advert } },
    );
    expect(scan.status).toBe(200);
    expect(scan.body.ats.coveragePct).toBeGreaterThanOrEqual(0);
    const tailored = await browser.json<{ document: CvDocumentRecord }>(
      routes.tailorings,
      '/api/me/cv/tailorings',
      {
        json: { advert },
      },
    );
    expect(tailored.status).toBe(202);
    expect(tailored.body.document).toMatchObject({
      kind: 'tailored',
      advertTitle: 'Junior developer',
    });
    expect(JSON.stringify(tailored.body)).not.toContain('Flask and Git');
  });

  // CV-A11 A11-41: an ID number pasted into the advert is refused before the scan, as a fitted
  // CV's advert is (`checkAdvert`): nothing leaves, nothing is counted.
  it('refuses an advert holding an ID number before anything leaves', async () => {
    const { browser } = await adult();
    const id = await makeCv(browser);
    const idNumber = ['8', '0', '0', '1', '0', '1', '5', '0', '0', '9', '0', '8', '7'].join('');
    const scan = vi.spyOn(engine, 'atsScan');
    const services = await on;
    const allow = vi.spyOn(services.store, 'allow');
    for (const advert of [
      { title: 'Junior developer', company: null, text: `Python. Send your ID ${idNumber}.` },
      { title: `Developer ${idNumber}`, company: null, text: 'Python.' },
      { title: 'Developer', company: `Example ${idNumber}`, text: 'Python.' },
    ]) {
      expect(
        await browser.json(routes.atsScan, '/api/me/cv/ats-scan', {
          json: { documentId: id, advert },
        }),
      ).toEqual({ status: 409, body: { error: 'state', detail: 'personal-number' } });
    }
    expect(scan).not.toHaveBeenCalled();
    expect(allow.mock.calls.map(([key]) => key)).not.toContain('cv-ats');
  });
});

describe('recruiter links (§9.3, D5): 18+, a checked CV, served by UniversityFlow', () => {
  it('shares a checked CV and serves it until the link is switched off', async () => {
    const { browser } = await adult(true);
    const id = await makeCv(browser);
    expect(
      await browser.json(routes.shares.POST, '/api/me/cv/shares', { json: { documentId: id } }),
    ).toEqual({ status: 403, body: { error: 'forbidden', detail: 'cv-share-unchecked' } });
    await browser.json(routes.confirm, `/api/me/cv/documents/${id}/confirm`, {
      json: {},
      params: { id },
    });
    const shared = await browser.json<{ share: CvShareRecord; url: string }>(
      routes.shares.POST,
      '/api/me/cv/shares',
      {
        json: { documentId: id, days: 30 },
      },
    );
    expect(shared.status).toBe(201);
    const token = shared.body.url.split('/cv/s/')[1] as string;
    const opened = await new Browser().call(routes.sharePage, `/cv/s/${token}`, {
      params: { token },
    });
    expect([302, 307]).toContain(opened.status);
    expect(opened.headers.get('location')).toMatch(
      new RegExp(`/api/cv/pdf/${id}\\?exp=\\d+&sig=[0-9a-f]{64}$`),
    );
    expect(opened.headers.get('x-robots-tag')).toContain('noindex');
    expect(opened.headers.get('referrer-policy')).toBe('no-referrer');
    await browser.json(routes.shares.DELETE, '/api/me/cv/shares', {
      method: 'DELETE',
      json: { id: shared.body.share.id },
    });
    const gone = await new Browser().call(routes.sharePage, `/cv/s/${token}`, {
      params: { token },
    });
    expect(gone.status).toBe(404);
    expect(await gone.text()).toContain(en.cv.share.gone);
  });

  // CV-A5 A5-18: the public page holds each address to a limit (§7.6, "a keyed hash for abuse
  // limits"); over it, nothing is counted, logged or served.
  it('holds each address to a limit, and counts nothing over it', async () => {
    const { browser } = await adult(true);
    const id = await makeCv(browser);
    await browser.json(routes.confirm, `/api/me/cv/documents/${id}/confirm`, {
      json: {},
      params: { id },
    });
    const shared = await browser.json<{ share: CvShareRecord; url: string }>(
      routes.shares.POST,
      '/api/me/cv/shares',
      { json: { documentId: id } },
    );
    const token = shared.body.url.split('/cv/s/')[1] as string;
    const services = await on;
    const allow = vi.spyOn(services.store, 'allow');
    const open = () =>
      new Browser().call(routes.sharePage, `/cv/s/${token}`, {
        params: { token },
        headers: { 'x-forwarded-for': '203.0.113.7' },
      });
    expect((await open()).status).toBe(307);
    expect(allow).toHaveBeenCalledWith(
      'cv-share-view',
      '203.0.113.7',
      expect.any(Number),
      expect.any(Number),
    );
    allow.mockResolvedValueOnce(false);
    const over = await open();
    expect(over.status).toBe(429);
    expect(over.headers.get('location')).toBeNull();
    expect(over.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(over.headers.get('x-robots-tag')).toContain('noindex');
    const { body } = await browser.json<{ shares: CvShareRecord[] }>(
      routes.shares.GET,
      '/api/me/cv/shares',
    );
    expect(body.shares.find((s) => s.id === shared.body.share.id)?.viewCount).toBe(1);
  });

  // CV-A5 A5-21: a daily limit on the links a learner makes, as drafts have; over it, no link.
  it('holds each learner to a daily number of share links', async () => {
    const { browser, id: studentId } = await adult(true);
    const id = await makeCv(browser);
    await browser.json(routes.confirm, `/api/me/cv/documents/${id}/confirm`, {
      json: {},
      params: { id },
    });
    const services = await on;
    const real = services.store.allow.bind(services.store);
    const allow = vi
      .spyOn(services.store, 'allow')
      .mockImplementation(async (key, subject, max, windowMs) =>
        key === 'cv-share' ? false : real(key, subject, max, windowMs),
      );
    expect(
      await browser.json(routes.shares.POST, '/api/me/cv/shares', { json: { documentId: id } }),
    ).toEqual({ status: 429, body: { error: 'rate-limited', detail: null } });
    expect(allow).toHaveBeenCalledWith(
      'cv-share',
      studentId,
      QUOTAS.cvShare.max,
      QUOTAS.cvShare.windowMs,
    );
    allow.mockRestore();
    const { body } = await browser.json<{ shares: CvShareRecord[] }>(
      routes.shares.GET,
      '/api/me/cv/shares',
    );
    expect(body.shares).toEqual([]);
  });

  it('never lets an under-18 share', async () => {
    const { browser } = await minor();
    await browser.json(routes.optIn.POST, '/api/me/cv/opt-in', { json: {} });
    const refused = await browser.json(routes.shares.POST, '/api/me/cv/shares', {
      json: { documentId: crypto.randomUUID() },
    });
    expect(refused).toEqual({ status: 403, body: { error: 'forbidden', detail: 'cv-share-age' } });
  });
});

describe('the webhook route (§4.1): forged, stale, replayed, wrong channel', () => {
  const post = (body: string, headers: Record<string, string>) =>
    new Browser().call(routes.webhook, '/api/integrations/mmereko/webhook', {
      body,
      headers,
      origin: null,
    });
  const event = () =>
    JSON.stringify({
      createdAt: new Date().toISOString(),
      data: { jobId: 'unknown-job', kind: 'cv-draft', learnerRef: 'x', status: 'succeeded' },
      id: `evt-${crypto.randomUUID()}`,
      type: 'cv.ready',
    });

  it('takes a signed one once, and refuses the rest', async () => {
    const body = event();
    const signed = { [MMEREKO_SIGNATURE_HEADER]: signCvWebhook(WEBHOOK, body) };
    expect((await post(body, signed)).status).toBe(200);
    expect((await post(body, signed)).status).toBe(401);
    const forged = event();
    expect(
      (await post(forged, { [MMEREKO_SIGNATURE_HEADER]: signCvWebhook('f'.repeat(40), forged) }))
        .status,
    ).toBe(401);
    const stale = event();
    expect(
      (
        await post(stale, {
          [MMEREKO_SIGNATURE_HEADER]: signCvWebhook(
            WEBHOOK,
            stale,
            new Date(Date.now() - 10 * 60_000),
          ),
        })
      ).status,
    ).toBe(401);
    const sms = event();
    expect(
      (await post(sms, { [MMEREKO_SIGNATURE_HEADER]: signWebhook(WEBHOOK, 'sms', sms) })).status,
    ).toBe(401);
    expect((await post(event(), {})).status).toBe(401);
    expect((await post('x'.repeat(5000), {})).status).toBe(400);
  });

  // CV-A5 A5-19: a webhook sent chunked (no content-length) is read only up to the cap.
  it('stops reading a chunked webhook at the cap', async () => {
    const { request, read } = chunkedRequest('/api/integrations/mmereko/webhook', 1024 * 1024);
    expect((await routes.webhook(request)).status).toBe(400);
    expect(read.bytes).toBeLessThanOrEqual(MAX_CV_WEBHOOK_BYTES + 64 * 1024);
  });
});

describe('the learner’s rights (§7.3, D15)', () => {
  it('withdrawal deletes the CV data here and sends the deletion to the engine', async () => {
    const { browser } = await adult();
    await browser.json(routes.entries.POST, '/api/me/cv/entries', { json: ENTRY });
    await makeCv(browser);
    const remove = vi.spyOn(engine, 'deleteLearner');
    const withdrawn = await browser.json<{ optIn: null; deleted: { cvs: number } }>(
      routes.optIn.DELETE,
      '/api/me/cv/opt-in',
      { method: 'DELETE' },
    );
    expect(withdrawn.body).toEqual({ optIn: null, deleted: { cvs: 1 } });
    await runJobs();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(
      (await browser.json<{ entries: unknown[] }>(routes.entries.GET, '/api/me/cv/entries')).body
        .entries,
    ).toEqual([]);
  });

  it('puts the CV and what the engine still holds in Download my data', async () => {
    const { browser } = await adult();
    await makeCv(browser);
    const exported = await browser.json<{
      personal: { cv: { documents: unknown[] } };
      cvEngine: unknown[];
    }>(routes.exportData, '/api/me/export');
    expect(exported.body.personal.cv.documents).toHaveLength(1);
    expect(exported.body.cvEngine).toEqual([expect.objectContaining({ jobs: expect.any(Array) })]);
  });

  it('account deletion sends the deletion to the engine', async () => {
    const { browser } = await adult();
    await makeCv(browser);
    const remove = vi.spyOn(engine, 'deleteLearner');
    expect((await browser.call(routes.me.DELETE, '/api/me', { method: 'DELETE' })).status).toBe(
      200,
    );
    await runJobs();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('nothing personal in a log (hard rule 4)', () => {
  it('logs no CV words, advert text or name through a whole CV', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    const { browser } = await adult();
    await browser.json(routes.entries.POST, '/api/me/cv/entries', { json: ENTRY });
    await makeCv(browser);
    const said = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    for (const word of ['Thandi', 'Campus bus tracker', 'Example High School']) {
      expect(said).not.toContain(word);
    }
  });
});

describe('the crisis check on every word the learner writes for a CV (CV-A10)', () => {
  type Cared = { care: { level: string; card?: unknown } | null };

  it('reads the keywords and the links’ labels of an entry (A10-54)', async () => {
    const { browser } = await adult();
    const keyword = await browser.json<Cared>(routes.entries.POST, '/api/me/cv/entries', {
      json: { ...ENTRY, keywords: ['Python', 'i want to die'] },
    });
    expect(keyword.status).toBe(200);
    expect(keyword.body.care?.level).toBe('crisis');
    const label = await browser.json<Cared>(routes.entries.POST, '/api/me/cv/entries', {
      json: {
        ...ENTRY,
        evidence: [
          { kind: 'document', url: 'https://example.org/diary', label: 'nobody would miss me' },
        ],
      },
    });
    expect(label.body.care?.level).toBe('crisis');
    const edited = await browser.json<{ entry: CvEntryRecord }>(
      routes.entries.POST,
      '/api/me/cv/entries',
      { json: ENTRY },
    );
    const id = edited.body.entry.id;
    const patched = await browser.json<Cared>(routes.entry.PATCH, `/api/me/cv/entries/${id}`, {
      method: 'PATCH',
      json: { keywords: ['kill myself'] },
      params: { id },
    });
    expect(patched.body.care?.level).toBe('crisis');
  });

  it('reads the surname, town and province typed for the CV (A10-54)', async () => {
    const { browser } = await adult();
    for (const field of ['surname', 'city', 'region'] as const) {
      const saved = await browser.json<Cared>(routes.selection.PUT, '/api/me/cv/selection', {
        method: 'PUT',
        json: { ...SELECTION, [field]: 'i want to die' },
      });
      expect(saved.status, field).toBe(200);
      expect(saved.body.care?.level, field).toBe('crisis');
    }
  });

  it('sends nothing when what would leave holds crisis words: the card, then only on a second press (A10-56)', async () => {
    const { browser } = await adult();
    const added = await browser.json<{ entry: CvEntryRecord }>(
      routes.entries.POST,
      '/api/me/cv/entries',
      { json: { ...ENTRY, description: 'I left because I want to die' } },
    );
    await browser.json(routes.selection.PUT, '/api/me/cv/selection', {
      method: 'PUT',
      json: { ...SELECTION, includeSchool: true, entryIds: [added.body.entry.id] },
    });
    const createDraft = vi.spyOn(engine, 'createDraft');
    const held = await browser.json<Cared & { document: unknown }>(
      routes.drafts,
      '/api/me/cv/drafts',
      { json: {} },
    );
    expect(held.status).toBe(200);
    expect(held.body.document).toBeNull();
    expect(held.body.care?.level).toBe('crisis');
    expect(held.body.care?.card).toBeTruthy();
    await runJobs();
    expect(createDraft.mock.calls.some(([r]) => JSON.stringify(r).includes('want to die'))).toBe(
      false,
    );
    const list = await browser.json<{ documents: CvDocumentRecord[] }>(
      routes.documents,
      '/api/me/cv/documents',
    );
    expect(list.body.documents).toEqual([]);
    // The words may belong on the CV (a helpline the learner volunteered for): their choice.
    const sent = await browser.json<{ document: CvDocumentRecord }>(
      routes.drafts,
      '/api/me/cv/drafts',
      { json: { sendAnyway: true } },
    );
    expect(sent.status).toBe(202);
    expect(sent.body.document.status).toBe('queued');
  });

  it('reads the job advert the learner pastes: crisis words keep it here, unsent and unstored (A10-55)', async () => {
    const { browser } = await adult();
    const id = await makeCv(browser);
    const advert = {
      title: 'Junior developer',
      company: null,
      text: 'Python. honestly i want to kill myself',
    };
    const tailor = vi.spyOn(engine, 'tailor');
    const scan = vi.spyOn(engine, 'atsScan');
    const held = await browser.json<Cared & { document: unknown }>(
      routes.tailorings,
      '/api/me/cv/tailorings',
      { json: { advert } },
    );
    expect(held.status).toBe(200);
    expect(held.body.document).toBeNull();
    expect(held.body.care?.level).toBe('crisis');
    const scanned = await browser.json<Cared & { ats: unknown }>(
      routes.atsScan,
      '/api/me/cv/ats-scan',
      { json: { documentId: id, advert } },
    );
    expect(scanned.status).toBe(200);
    expect(scanned.body.ats).toBeNull();
    expect(scanned.body.care?.level).toBe('crisis');
    await runJobs();
    expect(tailor).not.toHaveBeenCalled();
    expect(scan).not.toHaveBeenCalled();
    const list = await browser.json<{ documents: CvDocumentRecord[] }>(
      routes.documents,
      '/api/me/cv/documents',
    );
    expect(list.body.documents.map((d) => d.kind)).toEqual(['draft']);

    // A concern goes ahead, with the card beside it.
    const concern = await browser.json<Cared & { document: CvDocumentRecord | null }>(
      routes.tailorings,
      '/api/me/cv/tailorings',
      { json: { advert: { ...advert, text: 'Python. I feel so hopeless about finding work' } } },
    );
    expect(concern.status).toBe(202);
    expect(concern.body.document?.kind).toBe('tailored');
    expect(concern.body.care?.level).toBe('concern');
  });
});
