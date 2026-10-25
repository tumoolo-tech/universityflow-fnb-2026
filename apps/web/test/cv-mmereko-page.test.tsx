import { MemoryCvEngine } from '@universityflow/cv';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { readConfig } from '../lib/server/config';
import { createServices, type Services } from '../lib/server/services';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * "Open Mmereko" on My CV's page (the owner's decision of 2026-10-24), decided on the server: the
 * canvas is rendered for a learner 18 or over, or at university, and only while
 * `UF_CV_MMEREKO_CANVAS=1`. An under-18 school learner's page never carries it (no button, no
 * dialog, no frame), and nothing about the learner is handed to it. Embedded database, stand-in
 * engine, synthetic learners.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

type Global = { __ufServices?: Promise<Services> | null };
const on = createServices(
  readConfig({ ...process.env, UF_CV: '1', UF_CV_MMEREKO_CANVAS: '1', MMEREKO_APP_URL: '' }),
  {
    cvEngine: new MemoryCvEngine({
      webhookSecret: 'cv-mmereko-test-webhook-secret-of-32-chars-or-more',
    }),
  },
);
// The same database with the canvas switched off, so a learner signed in above stays signed in.
const off = on.then((s): Services => ({ ...s, config: { ...s.config, mmerekoCanvas: null } }));
(globalThis as Global).__ufServices = on;
afterAll(() => {
  (globalThis as Global).__ufServices = null;
});

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  me: (await import('../app/api/me/route')).GET,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};
const CvPage = (await import('../app/(app)/cv/page')).default;
const { MmerekoCanvas } = await import('../app/(app)/cv/mmereko-canvas');

let n = 4_900_000;
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function signedIn(dateOfBirth: string) {
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
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth } });
  return browser;
}

async function adult() {
  const browser = await signedIn('2000-02-02');
  await agreeAsAdult(browser);
  return browser;
}

/** A learner under 18 whose guardian agreed: a school learner, unless `atUniversity`. */
async function minor(atUniversity = false) {
  const browser = await signedIn('2010-05-05');
  const me = await browser.json<{ account: { id: string } }>(routes.me, '/api/me');
  const id = me.body.account.id;
  const { store } = await on;
  const { token } = await store.requestGuardianConsent(
    id,
    { name: 'Test Guardian', phone: phone(), relationship: 'parent' },
    'v3-test',
  );
  await store.grantConsent(token);
  if (atUniversity) {
    await store.forStudent(id).saveRegistration({
      universityId: 'wits',
      programmeId: 'wits-bcom',
      academicYear: 2026,
      yearOfStudy: 1,
      modules: [{ code: 'TEST1001', name: 'Sample module (test)', term: 'S1', credits: null }],
    });
  }
  return browser;
}

/** The first element of `type` in a server component's tree. */
function find(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement<Record<string, unknown>>(node)) return null;
  if (node.type === type) return node;
  for (const value of Object.values(node.props)) {
    const hit = find(value as ReactNode, type);
    if (hit) return hit;
  }
  return null;
}

describe('My CV’s page: the Mmereko canvas', () => {
  it('is there for an adult, with Mmereko’s sign-in address and nothing about the learner', async () => {
    const browser = await adult();
    browser.enter();
    const canvas = find(await CvPage(), MmerekoCanvas);
    expect(canvas).not.toBeNull();
    expect(Object.keys(canvas?.props ?? {}).sort()).toEqual(['copy', 'loginUrl', 'siteUrl']);
    expect(canvas?.props['loginUrl']).toBe('https://mmereko.tumoolo.tech/login');
    expect(canvas?.props['siteUrl']).toBe('https://mmereko.tumoolo.tech/');
  });

  it('is never there for a school learner under 18', async () => {
    const browser = await minor();
    browser.enter();
    expect(find(await CvPage(), MmerekoCanvas)).toBeNull();
  });

  it('is there for a learner at university, whatever their age', async () => {
    const browser = await minor(true);
    browser.enter();
    expect(find(await CvPage(), MmerekoCanvas)).not.toBeNull();
  });

  it('is never there while the switch is off, even for an adult', async () => {
    const browser = await adult();
    (globalThis as Global).__ufServices = off;
    try {
      browser.enter();
      expect(find(await CvPage(), MmerekoCanvas)).toBeNull();
    } finally {
      (globalThis as Global).__ufServices = on;
    }
  });
});
