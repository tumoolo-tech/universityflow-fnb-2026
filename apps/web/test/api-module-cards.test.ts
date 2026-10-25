import { en } from '@universityflow/content';
import type { ModuleCardData } from '@universityflow/ui';
import { describe, expect, it, vi } from 'vitest';
import { E2E_REGISTRATION_PROGRAMME } from '../lib/server/e2e-fixtures';
import { Browser } from './harness';

/**
 * Module cards (Phase 6c) over the real route handlers and an embedded database:
 *
 * - a learner sees the card of a module on their own confirmed registration only: another
 *   learner's registration, a module they didn't register and a made-up id are "not found";
 * - the card's scheme comes from their confirmed outline (hard rule 6), each field with its source;
 * - they save marks and a target; a mark outside 0–100, or for the exam or a part the module
 *   doesn't have, is refused, never repaired.
 *
 * Every learner and value here is synthetic (hard rule 4).
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  adultConsent: (await import('../app/api/me/adult-consent/route')).POST,
  registration: await import('../app/api/registration/route'),
  outlines: await import('../app/api/module-outlines/route'),
  card: await import('../app/api/modules/[registrationId]/[code]/route'),
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

let n = 7_400_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function adult() {
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
  await browser.json(routes.adultConsent, '/api/me/adult-consent', {
    json: { version: en.adultConsent.version },
  });
  return browser;
}

async function register(browser: Browser) {
  const saved = await browser.json<{ modules: { registrationId: string } | null }>(
    routes.registration.PUT,
    '/api/registration',
    {
      method: 'PUT',
      json: {
        programmeId: E2E_REGISTRATION_PROGRAMME,
        academicYear: 2027,
        yearOfStudy: 1,
        modules: [
          { code: 'TEST101', name: 'Sample module one', term: 'S1', credits: 16 },
          { code: 'TEST102', name: 'Sample module two', term: 'S1', credits: 16 },
        ],
        documentId: null,
      },
    },
  );
  const id = saved.body.modules?.registrationId;
  if (!id) throw new Error('no registration');
  return id;
}

/** An outline the learner typed in for TEST101 (needs consent only, not the outline wording). */
const OUTLINE = {
  moduleCode: 'TEST101',
  moduleName: 'Sample module one',
  academicYear: 2027,
  term: 'S1',
  components: {
    status: 'confirmed',
    items: [
      { name: 'Test 1', kind: 'test', weight: 40, subminimum: null },
      { name: 'Exam', kind: 'exam', weight: 60, subminimum: null },
    ],
    dpRequirement: { percent: 35, quote: null },
    examSubminimum: null,
    supplementaryQuote: null,
  },
  dates: { status: 'not-in-outline' },
  books: { status: 'not-in-outline' },
  people: { status: 'not-in-outline' },
  documentId: null,
};

const get = (browser: Browser, registrationId: string, code: string) =>
  browser.json<ModuleCardData & { error?: string }>(
    routes.card.GET,
    `/api/modules/${registrationId}/${code}`,
    { params: { registrationId, code } },
  );

const put = (browser: Browser, registrationId: string, code: string, body: unknown) =>
  browser.json<ModuleCardData & { error?: string; detail?: string }>(
    routes.card.PUT,
    `/api/modules/${registrationId}/${code}`,
    { method: 'PUT', json: body, params: { registrationId, code } },
  );

describe('module cards over the routes (Phase 6c)', () => {
  it('a learner sees only the cards of their own registered modules', async () => {
    const owner = await adult();
    const other = await adult();
    const id = await register(owner);
    await register(other);
    expect((await get(owner, id, 'TEST101')).status).toBe(200);
    expect((await get(owner, id, 'test%20101')).status).toBe(200);
    // Another learner, a module not registered, an id that isn't theirs or isn't one.
    expect((await get(other, id, 'TEST101')).status).toBe(404);
    expect((await get(owner, id, 'TEST104')).status).toBe(404);
    expect((await get(owner, crypto.randomUUID(), 'TEST101')).status).toBe(404);
    expect((await get(owner, 'not-an-id', 'TEST101')).status).toBe(404);
  });

  it('builds the card from the learner’s confirmed outline, each rule with its source', async () => {
    const browser = await adult();
    const id = await register(browser);
    await browser.json(routes.outlines.PUT, '/api/module-outlines', {
      method: 'PUT',
      json: OUTLINE,
    });
    const { status, body } = await get(browser, id, 'TEST101');
    expect(status).toBe(200);
    expect(body.module).toMatchObject({ code: 'TEST101', academicYear: 2027, term: 'S1' });
    expect(body.scheme.weighting).toMatchObject({
      value: {
        components: [
          { name: 'Test 1', weight: 40 },
          { name: 'Exam', weight: 60 },
        ],
      },
      source: { level: 'outline', draft: false },
    });
    expect(body.scheme.examAdmission?.value.minimumYearMark).toBe(35);
    expect(body.sample).toBe(false);
    expect(body.marks).toEqual([]);
    // Only the resolved scheme goes out, never a catalogue record.
    expect(JSON.stringify(body)).not.toContain('verifiedBy');
  });

  it('saves marks and a target, and refuses a mark that isn’t one or a part the module hasn’t', async () => {
    const browser = await adult();
    const id = await register(browser);
    await browser.json(routes.outlines.PUT, '/api/module-outlines', {
      method: 'PUT',
      json: OUTLINE,
    });
    const saved = await put(browser, id, 'TEST101', {
      marks: [{ component: 'Test 1', attempt: 1, percent: 64 }],
      target: 60,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.marks).toEqual([{ component: 'Test 1', attempt: 1, percent: 64 }]);
    expect(saved.body.target).toBe(60);
    for (const bad of [
      { marks: [{ component: 'Test 1', attempt: 1, percent: 101 }], target: null },
      { marks: [{ component: 'Exam', attempt: 1, percent: 50 }], target: null },
      { marks: [{ component: 'Test 9', attempt: 1, percent: 50 }], target: null },
      { marks: [{ component: 'Test 1', attempt: 2, percent: 50 }], target: null },
      { marks: [], target: 150 },
    ]) {
      expect((await put(browser, id, 'TEST101', bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await get(browser, id, 'TEST101')).body.marks).toEqual([
      { component: 'Test 1', attempt: 1, percent: 64 },
    ]);
  });

  it('refuses to save marks while the module’s weighting isn’t published', async () => {
    const browser = await adult();
    const id = await register(browser);
    const refused = await put(browser, id, 'TEST102', {
      marks: [{ component: 'Test 1', attempt: 1, percent: 64 }],
      target: null,
    });
    expect(refused).toMatchObject({ status: 409, body: { detail: 'weighting-not-published' } });
  });
});
