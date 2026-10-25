import { MemoryCvEngine } from '@universityflow/cv';
import type { CvDocumentRecord, CvShareRecord } from '@universityflow/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../lib/server/config';
import { createServices, type Services } from '../lib/server/services';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';
import { expectNoPhoneNumber, withoutIds } from './no-phone';

/**
 * Wave 5 (2026-10-24), My CV over the real route handlers, an embedded database and the stand-in
 * engine, with the owner's switch on (UF_CV=1):
 * - A10-58 "Report this CV" (design §11, A10-35's pattern): a fitted CV, reported once by id and a
 *   reason, a person told by an id-only log line, 20 a day, never another learner's CV.
 * - A11-38 deleting one CV (D13): DELETE /api/me/cv/documents/[id], its PDF deleted from our files,
 *   its share link dead, never another learner's, never one being made.
 * Synthetic learners only.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const engine = new MemoryCvEngine({
  webhookSecret: 'api-cv-wave5-webhook-secret-of-32-chars-or-more',
});
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
  outbox: (await import('../app/api/dev/outbox/route')).GET,
  optIn: await import('../app/api/me/cv/opt-in/route'),
  selection: await import('../app/api/me/cv/selection/route'),
  drafts: (await import('../app/api/me/cv/drafts/route')).POST,
  tailorings: (await import('../app/api/me/cv/tailorings/route')).POST,
  documents: (await import('../app/api/me/cv/documents/route')).GET,
  document: await import('../app/api/me/cv/documents/[id]/route'),
  report: (await import('../app/api/me/cv/documents/[id]/report/route')).POST,
  confirm: (await import('../app/api/me/cv/documents/[id]/confirm/route')).POST,
  shares: await import('../app/api/me/cv/shares/route'),
  pdf: (await import('../app/api/cv/pdf/[id]/route')).GET,
  sharePage: (await import('../app/cv/s/[token]/route')).GET,
  webhook: (await import('../app/api/integrations/mmereko/webhook/route')).POST,
};

let n = 4_700_000;
const phone = () => `082${String(n++).padStart(7, '0')}`;

/** An adult in their own name, with a first name and a school, opted in (with sharing). */
async function adult() {
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
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  await agreeAsAdult(browser);
  const me = await browser.json<{ account: { id: string } }>(routes.me.GET, '/api/me');
  const id = me.body.account.id;
  const { store } = await on;
  await store
    .forStudent(id)
    .updateProfile({ displayName: 'Thandi', schoolName: 'Example High School', grade: 12 });
  await browser.json(routes.optIn.POST, '/api/me/cv/opt-in', { json: { share: true } });
  await browser.json(routes.selection.PUT, '/api/me/cv/selection', {
    method: 'PUT',
    json: {
      surname: 'Example',
      label: null,
      summary: null,
      email: null,
      phone: null,
      city: null,
      region: null,
      includeSchool: true,
      subjectIds: [],
      includeOffer: false,
      moduleCodes: [],
      entryIds: [],
    },
  });
  return { browser, id };
}

async function runJobs() {
  const services = await on;
  return services.jobRunner?.runDue(services.jobHandlers);
}

/** Queues a base or fitted CV, lets the engine finish it, and collects it by its webhook. */
async function makeCv(browser: Browser, kind: 'draft' | 'tailored') {
  const made =
    kind === 'draft'
      ? await browser.json<{ document: CvDocumentRecord }>(routes.drafts, '/api/me/cv/drafts', {
          json: {},
        })
      : await browser.json<{ document: CvDocumentRecord }>(
          routes.tailorings,
          '/api/me/cv/tailorings',
          {
            json: {
              advert: { title: 'Junior developer', company: null, text: 'Python and Git.' },
            },
          },
        );
  expect(made.status).toBe(202);
  const send = vi.spyOn(engine, kind === 'draft' ? 'createDraft' : 'tailor');
  await runJobs();
  const call = send.mock.calls.findIndex(([, key]) => key === made.body.document.id);
  const sent = send.mock.results[call];
  if (!sent) throw new Error('The CV was not sent');
  const { jobId } = await (sent.value as Promise<{ jobId: string }>);
  send.mockRestore();
  await engine.complete(jobId);
  const delivery = engine.webhooks.at(-1);
  await new Browser().call(routes.webhook, '/api/integrations/mmereko/webhook', {
    body: delivery?.body ?? '',
    headers: { ...(delivery?.headers ?? {}) },
    origin: null,
  });
  await runJobs();
  return made.body.document.id;
}

const report = (browser: Browser, id: string, reason: unknown) =>
  browser.json(routes.report, `/api/me/cv/documents/${id}/report`, {
    json: { reason },
    params: { id },
  });

const remove = (browser: Browser, id: string) =>
  browser.json(routes.document.DELETE, `/api/me/cv/documents/${id}`, {
    method: 'DELETE',
    params: { id },
  });

describe('report this CV (A10-58)', () => {
  it('reports a fitted CV once, tells a person by ids only, and the list marks it', async () => {
    const { browser, id: studentId } = await adult();
    const id = await makeCv(browser, 'tailored');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await report(browser, id, 'untrue')).toEqual({
      status: 200,
      body: { status: 'reported' },
    });
    const lines = warn.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('cv-report'));
    expect(lines).toEqual([`cv-report: student ${studentId} reported CV ${id} (untrue)`]);
    expect(withoutIds(lines[0] ?? '')).not.toMatch(/Thandi|Junior|Python|Example/);
    expectNoPhoneNumber(lines[0] ?? '');

    expect(await report(browser, id, 'harmful')).toEqual({
      status: 200,
      body: { status: 'already-reported' },
    });
    const list = await browser.json<{ documents: CvDocumentRecord[]; reported: string[] }>(
      routes.documents,
      '/api/me/cv/documents',
    );
    expect(list.body.reported).toEqual([id]);
  });

  it('refuses an unknown reason, a base CV and another learner’s CV', async () => {
    const { browser } = await adult();
    const fitted = await makeCv(browser, 'tailored');
    expect((await report(browser, fitted, 'rude')).status).toBe(400);
    expect((await report(browser, fitted, undefined)).status).toBe(400);
    const base = await makeCv(browser, 'draft');
    expect(await report(browser, base, 'untrue')).toMatchObject({
      status: 409,
      body: { error: 'state' },
    });
    const other = await adult();
    expect((await report(other.browser, fitted, 'untrue')).status).toBe(404);
    expect((await report(other.browser, 'not-an-id', 'untrue')).status).toBe(404);
  });

  it('refuses a cross-site report (CSRF) and a signed-out one', async () => {
    const { browser } = await adult();
    const id = await makeCv(browser, 'tailored');
    const forged = await browser.call(routes.report, `/api/me/cv/documents/${id}/report`, {
      json: { reason: 'untrue' },
      params: { id },
      origin: 'https://evil.example',
    });
    expect(forged.status).toBe(403);
    const stranger = await new Browser().call(routes.report, `/api/me/cv/documents/${id}/report`, {
      json: { reason: 'untrue' },
      params: { id },
    });
    expect(stranger.status).toBe(401);
  });

  it('allows 20 reports a day, then refuses', async () => {
    const { browser } = await adult();
    const missing = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    for (let i = 0; i < 20; i++) {
      expect((await report(browser, missing(i), 'other')).status).toBe(404);
    }
    expect((await report(browser, missing(20), 'other')).status).toBe(429);
  });

  it('answers 404 while UF_CV is off', async () => {
    const { browser } = await adult();
    const id = await makeCv(browser, 'tailored');
    (globalThis as Global).__ufServices = off;
    try {
      expect((await report(browser, id, 'untrue')).status).toBe(404);
      expect((await remove(browser, id)).status).toBe(404);
    } finally {
      (globalThis as Global).__ufServices = on;
    }
  });
});

describe('deleting one CV (A11-38, D13)', () => {
  it('deletes the learner’s CV and its PDF; its share link and PDF link stop working', async () => {
    const { browser } = await adult();
    const kept = await makeCv(browser, 'draft');
    const id = await makeCv(browser, 'tailored');
    await browser.json(routes.confirm, `/api/me/cv/documents/${id}/confirm`, {
      json: {},
      params: { id },
    });
    const shared = await browser.json<{ share: CvShareRecord; url: string }>(
      routes.shares.POST,
      '/api/me/cv/shares',
      { json: { documentId: id, days: 30 } },
    );
    const token = shared.body.url.split('/cv/s/')[1] as string;
    const one = await browser.json<{ pdf: { url: string } }>(
      routes.document.GET,
      `/api/me/cv/documents/${id}`,
      { params: { id } },
    );
    const pdfUrl = new URL(one.body.pdf.url);
    const services = await on;
    const deleted = vi.spyOn(services.files, 'delete');

    expect(await remove(browser, id)).toEqual({ status: 200, body: { deleted: true } });

    expect(deleted).toHaveBeenCalledTimes(1);
    expect(deleted.mock.calls[0]?.[0]).toMatch(/^cv-[0-9a-f]{32}$/);
    const list = await browser.json<{ documents: CvDocumentRecord[] }>(
      routes.documents,
      '/api/me/cv/documents',
    );
    expect(list.body.documents.map((d) => d.id)).toEqual([kept]);
    expect(
      (await browser.call(routes.document.GET, `/api/me/cv/documents/${id}`, { params: { id } }))
        .status,
    ).toBe(404);
    const pdf = await new Browser().call(routes.pdf, pdfUrl.pathname + pdfUrl.search, {
      params: { id },
    });
    expect(pdf.status).toBe(404);
    const page = await new Browser().call(routes.sharePage, `/cv/s/${token}`, {
      params: { token },
    });
    expect(page.status).toBe(404);
    // Gone, so a second delete finds nothing.
    expect((await remove(browser, id)).status).toBe(404);
  });

  // CV5-02: the row goes first, so a storage blip must not leave its PDF behind: the delete is
  // tried again (S3 deletes are idempotent).
  it('tries the PDF’s delete again when storage fails for a moment', async () => {
    const { browser } = await adult();
    const id = await makeCv(browser, 'draft');
    const services = await on;
    const real = services.files.delete.bind(services.files);
    const deleted = vi
      .spyOn(services.files, 'delete')
      .mockRejectedValueOnce(new Error('storage blip'))
      .mockRejectedValueOnce(new Error('storage blip'))
      .mockImplementation(real);
    expect(await remove(browser, id)).toEqual({ status: 200, body: { deleted: true } });
    expect(deleted).toHaveBeenCalledTimes(3);
    const key = deleted.mock.calls[0]?.[0] as string;
    expect(deleted.mock.calls.map(([k]) => k)).toEqual([key, key, key]);
    expect(await services.files.get(key)).toBeNull();
  });

  it('never deletes another learner’s CV, nor one still being made', async () => {
    const { browser } = await adult();
    const id = await makeCv(browser, 'draft');
    const other = await adult();
    expect((await remove(other.browser, id)).status).toBe(404);
    expect((await remove(other.browser, 'not-an-id')).status).toBe(404);
    const busy = await browser.json<{ document: CvDocumentRecord }>(
      routes.drafts,
      '/api/me/cv/drafts',
      { json: {} },
    );
    expect(await remove(browser, busy.body.document.id)).toEqual({
      status: 409,
      body: { error: 'state', detail: 'cv-busy' },
    });
    const list = await browser.json<{ documents: CvDocumentRecord[] }>(
      routes.documents,
      '/api/me/cv/documents',
    );
    expect(list.body.documents).toHaveLength(2);
  });

  it('refuses a cross-site delete (CSRF)', async () => {
    const { browser } = await adult();
    const id = await makeCv(browser, 'draft');
    const forged = await browser.call(routes.document.DELETE, `/api/me/cv/documents/${id}`, {
      method: 'DELETE',
      params: { id },
      origin: 'https://evil.example',
    });
    expect(forged.status).toBe(403);
  });
});
