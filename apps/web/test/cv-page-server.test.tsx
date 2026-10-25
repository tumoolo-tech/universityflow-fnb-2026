import { en } from '@universityflow/content';
import { MemoryCvEngine } from '@universityflow/cv';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { CvInitial } from '../app/(app)/cv/cv-types';
import { readConfig } from '../lib/server/config';
import { createServices, type Services } from '../lib/server/services';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * My CV's page on the server (docs/design/mmereko-api-proposal.md §10.5, D6, D8): it exists only
 * while the server's `UF_CV` switch is on, and so does its link in the sidebar; it hands its
 * client island everything it read, dates as strings; sharing is offered to an adult in their
 * own name and never to an under-18. Embedded database, stand-in engine, synthetic learners.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

type Global = { __ufServices?: Promise<Services> | null };
const on = createServices(readConfig({ ...process.env, UF_CV: '1' }), {
  cvEngine: new MemoryCvEngine({
    webhookSecret: 'cv-page-test-webhook-secret-of-32-chars-or-more',
  }),
});
// The same database with the switch off, so the learner signed in above is still signed in.
const off = on.then((s): Services => ({ ...s, config: { ...s.config, cv: false }, cv: null }));
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
  optIn: (await import('../app/api/me/cv/opt-in/route')).POST,
  entries: (await import('../app/api/me/cv/entries/route')).POST,
};
const CvPage = (await import('../app/(app)/cv/page')).default;
const Layout = (await import('../app/(app)/layout')).default;
const { CvView } = await import('../app/(app)/cv/cv-view');
const { NavLinks } = await import('../app/(app)/nav');

let n = 4_800_000;
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

async function minor() {
  const browser = await signedIn('2010-05-05');
  const me = await browser.json<{ account: { id: string } }>(routes.me, '/api/me');
  const { store } = await on;
  const { token } = await store.requestGuardianConsent(
    me.body.account.id,
    { name: 'Test Guardian', phone: phone(), relationship: 'parent' },
    'v3-test',
  );
  await store.grantConsent(token);
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

async function notFoundOf(render: () => Promise<unknown>): Promise<boolean> {
  try {
    await render();
    return false;
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === 'string' && digest.endsWith(';404')) return true;
    throw error;
  }
}

describe('My CV’s page', () => {
  it('is not there while the switch is off, and neither is its link (D8)', async () => {
    const browser = await signedIn('2000-02-02');
    await agreeAsAdult(browser);
    (globalThis as Global).__ufServices = off;
    try {
      browser.enter();
      expect(await notFoundOf(() => CvPage())).toBe(true);
      const nav = find(await Layout({ children: null }), NavLinks);
      expect(nav?.props['cvLabel']).toBeNull();
    } finally {
      (globalThis as Global).__ufServices = on;
    }
  });

  it('with the switch on, links from the sidebar and starts an adult at the opt-in, with sharing offered', async () => {
    const browser = await signedIn('2000-02-02');
    await agreeAsAdult(browser);
    browser.enter();
    const nav = find(await Layout({ children: null }), NavLinks);
    expect(nav?.props['cvLabel']).toBe(en.cv.title);
    const view = find(await CvPage(), CvView);
    const initial = view?.props['initial'] as CvInitial;
    expect(initial.optIn).toBeNull();
    expect(initial.wordingCovers).toBe(true);
    expect(initial.canShare).toBe(true);
    expect(initial.documents).toEqual([]);
    // Not a judge demo: the AI notes stay (only the demo's stand-in drops them).
    expect(initial.standIn).toBe(false);
  });

  it('hands the island what it read, dates as strings', async () => {
    const browser = await signedIn('2000-02-02');
    await agreeAsAdult(browser);
    expect((await browser.json(routes.optIn, '/api/me/cv/opt-in', { json: {} })).status).toBe(200);
    await browser.json(routes.entries, '/api/me/cv/entries', {
      json: {
        kind: 'skill',
        title: 'Spreadsheets',
        organisation: null,
        role: null,
        startDate: null,
        endDate: null,
        description: null,
        highlights: [],
        keywords: [],
        evidence: [],
        linkedModules: [],
      },
    });
    browser.enter();
    const initial = find(await CvPage(), CvView)?.props['initial'] as CvInitial;
    expect(typeof initial.optIn?.optedInAt).toBe('string');
    expect(initial.entries.map((e) => e.title)).toEqual(['Spreadsheets']);
    expect(initial.view.available.entries.map((e) => e.title)).toEqual(['Spreadsheets']);
    // Marks start unticked (D11); contact details start empty, never the sign-in phone (D9).
    expect(initial.view.selection.subjectIds).toEqual([]);
    expect(initial.view.selection.phone).toBeNull();
    expect(JSON.parse(JSON.stringify(initial))).toEqual(initial);
  });

  it('never offers an under-18 sharing (D6)', async () => {
    const browser = await minor();
    browser.enter();
    const initial = find(await CvPage(), CvView)?.props['initial'] as CvInitial;
    expect(initial.canShare).toBe(false);
    expect(initial.shares).toEqual([]);
  });
});
