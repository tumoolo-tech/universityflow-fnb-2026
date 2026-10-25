import { en } from '@universityflow/content';
import type { ModuleOutlineDraft } from '@universityflow/documents';
import { describe, expect, it, vi } from 'vitest';
import { Browser } from './harness';

/**
 * Module outlines (Phase 6b) over the real route handlers and an embedded database, locally (the
 * stand-in reader, files through our own server):
 *
 * - an upload under consent wording that doesn't name module outlines (the live adult-v2) is
 *   refused with its reason (D9), the file removed and nothing read;
 * - under wording that does (adult-v3, a draft), the upload reads into a draft, the learner
 *   confirms it part by part, and the file is deleted once they do (D10);
 * - weights that don't add up and a lecturer's mobile number are refused with their reasons
 *   (hard rule 6, D3), never repaired;
 * - a learner removes their own outline, never another's.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const { getServices } = await import('../lib/server/services');

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  me: await import('../app/api/me/route'),
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  adultConsent: (await import('../app/api/me/adult-consent/route')).POST,
  documents: await import('../app/api/documents/route'),
  outlines: await import('../app/api/module-outlines/route'),
  outline: await import('../app/api/module-outlines/[id]/route'),
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_300_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;
/** A synthetic mobile number for a lecturer, built at runtime. */
const mobile = () => ['082', '555', '0123'].join(' ');

async function adult(agreedTo?: string) {
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
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2000-02-02' } });
  if (agreedTo) {
    const me = await browser.json<{ account: { id: string } }>(routes.me.GET, '/api/me');
    const { store } = await getServices();
    await store.consentAsAdult(me.body.account.id, agreedTo);
  } else {
    await browser.json(routes.adultConsent, '/api/me/adult-consent', {
      json: { version: en.adultConsent.version },
    });
  }
  return browser;
}

const upload = (browser: Browser) => {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new TextEncoder().encode('%PDF-1.4 synthetic outline')], { type: 'application/pdf' }),
    'outline.pdf',
  );
  form.append('kind', 'module-outline');
  return browser.json<{ documentId: string; outline: ModuleOutlineDraft | null; sample: boolean }>(
    routes.documents.POST,
    '/api/documents',
    { method: 'POST', body: form },
  );
};

/** What the learner confirms from a draft, every part checked as read. */
function confirmedFrom(draft: ModuleOutlineDraft, documentId: string | null) {
  return {
    moduleCode: draft.moduleCode,
    moduleName: draft.moduleName,
    academicYear: draft.academicYear,
    term: draft.term,
    components: {
      status: 'confirmed',
      items: draft.components.map((c) => ({
        name: c.name,
        kind: c.kind ?? 'other',
        weight: c.weight,
        subminimum: c.subminimum,
      })),
      dpRequirement: { percent: draft.dpPercent, quote: draft.dpQuote },
      examSubminimum: draft.examSubminimum,
      supplementaryQuote: draft.supplementaryQuote,
    },
    dates: {
      status: 'confirmed',
      items: draft.dates.map((d) => ({ label: d.label, date: d.date })),
    },
    books: {
      status: 'confirmed',
      items: draft.books.map((b) => ({
        role: b.role ?? 'prescribed',
        title: b.title,
        authors: b.authors,
        edition: b.edition,
        isbn: b.isbn,
      })),
    },
    people: { status: 'confirmed', items: draft.people },
    documentId,
  };
}

const put = (browser: Browser, body: unknown) =>
  browser.json<{
    id?: string;
    outlines?: Array<{ id: string; moduleCode: string; fromDocument: boolean }>;
    error?: string;
    detail?: string;
  }>(routes.outlines.PUT, '/api/module-outlines', { method: 'PUT', json: body });

describe('module outlines over the routes (Phase 6b)', () => {
  it('refuses an upload under the live adult wording, says why, removes the file and reads nothing (D9)', async () => {
    const browser = await adult();
    const { files, outlineReader } = await getServices();
    const removed = vi.spyOn(files, 'delete');
    const read = vi.spyOn(outlineReader, 'read');
    expect(await upload(browser)).toMatchObject({
      status: 403,
      body: { error: 'consent-outdated', detail: 'module-outlines' },
    });
    expect(removed).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
    removed.mockRestore();
    read.mockRestore();
  });

  it('reads an outline into a draft, saves it as confirmed, and deletes the file (D10)', async () => {
    const browser = await adult('adult-v3-test');
    const uploaded = await upload(browser);
    expect(uploaded.status).toBe(200);
    const { documentId, outline, sample } = uploaded.body;
    expect(sample).toBe(true);
    if (!outline) throw new Error('no draft');
    expect(outline.moduleCode).toBe('DEMO1001');
    expect(outline.weightsTotal).toBe(100);

    const { files } = await getServices();
    const removed = vi.spyOn(files, 'delete');
    const saved = await put(browser, confirmedFrom(outline, documentId));
    expect(saved.status).toBe(200);
    expect(removed).toHaveBeenCalledTimes(1);
    removed.mockRestore();
    expect(saved.body.outlines).toEqual([
      expect.objectContaining({ moduleCode: 'DEMO1001', fromDocument: true }),
    ]);
    const listed = await browser.json<{ documents: unknown[] }>(
      routes.documents.GET,
      '/api/documents',
    );
    expect(listed.body.documents).toEqual([]);
  });

  it('refuses weights that don’t add up and a lecturer’s mobile number, with their reasons', async () => {
    const browser = await adult('adult-v3-test');
    const { body } = await upload(browser);
    if (!body.outline) throw new Error('no draft');
    const good = confirmedFrom(body.outline, null);
    const weights = {
      ...good,
      components: {
        ...good.components,
        items: good.components.items.map((c, i) => (i === 0 ? { ...c, weight: 5 } : c)),
      },
    };
    expect(await put(browser, weights)).toMatchObject({
      status: 400,
      body: { error: 'invalid', detail: 'weights-dont-add-up' },
    });
    const person = body.outline.people[0];
    const withMobile = {
      ...good,
      people: { status: 'confirmed', items: [{ ...person, phone: mobile() }] },
    };
    expect(await put(browser, withMobile)).toMatchObject({
      status: 409,
      body: { error: 'state', detail: 'personal-number' },
    });
    const listed = await browser.json<{ outlines: unknown[] }>(
      routes.outlines.GET,
      '/api/module-outlines',
    );
    expect(listed.body.outlines).toEqual([]);
  });

  it('a learner removes their own outline, never another learner’s', async () => {
    const owner = await adult('adult-v3-test');
    const other = await adult('adult-v3-test');
    const { body } = await upload(owner);
    if (!body.outline) throw new Error('no draft');
    const saved = await put(owner, confirmedFrom(body.outline, null));
    const id = saved.body.id as string;
    const call = (browser: Browser) =>
      browser.call(routes.outline.DELETE, `/api/module-outlines/${id}`, {
        method: 'DELETE',
        params: { id },
      });
    expect((await call(other)).status).toBe(404);
    expect((await call(owner)).status).toBe(200);
    const listed = await owner.json<{ outlines: unknown[] }>(
      routes.outlines.GET,
      '/api/module-outlines',
    );
    expect(listed.body.outlines).toEqual([]);
  });
});
