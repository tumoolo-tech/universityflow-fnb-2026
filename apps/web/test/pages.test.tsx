import { ConsentRequiredError } from '@universityflow/db';
import { describe, expect, it, vi } from 'vitest';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * Audit A1-10: every signed-in page, rendered as Next would render it, for a learner the
 * database won't process yet. Next renders the `(app)` layout and its page in parallel, so the
 * layout's redirect alone doesn't stop a page from reading personal data; each page must send
 * the learner to onboarding itself, never let the consent gate's error escape.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  guardian: (await import('../app/api/me/guardian/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
};

const Layout = (await import('../app/(app)/layout')).default;
const pages: Array<[string, () => Promise<unknown>]> = [
  ['(app) layout', () => Layout({ children: null })],
  ['/home', async () => (await import('../app/(app)/home/page')).default()],
  ['/chat', async () => (await import('../app/(app)/chat/page')).default()],
  ['/results', async () => (await import('../app/(app)/results/page')).default()],
  ['/documents', async () => (await import('../app/(app)/documents/page')).default()],
  ['/applications', async () => (await import('../app/(app)/applications/page')).default()],
  [
    '/applications/uj',
    async () =>
      (await import('../app/(app)/applications/[university]/page')).default({
        params: Promise.resolve({ university: 'uj' }),
      }),
  ],
  [
    '/results/what-i-need/uj-bcom-accounting',
    async () =>
      (await import('../app/(app)/results/what-i-need/[programmeId]/page')).default({
        params: Promise.resolve({ programmeId: 'uj-bcom-accounting' }),
      }),
  ],
  ['/funding', async () => (await import('../app/(app)/funding/page')).default()],
  ['/me', async () => (await import('../app/(app)/me/page')).default()],
  ['/offers', async () => (await import('../app/(app)/offers/page')).default()],
  [
    '/campus?university=up',
    async () =>
      (await import('../app/(app)/campus/page')).default({
        searchParams: Promise.resolve({ university: 'up' }),
      }),
  ],
  [
    '/first-week?university=up',
    async () =>
      (await import('../app/(app)/first-week/page')).default({
        searchParams: Promise.resolve({ university: 'up' }),
      }),
  ],
  ['/modules', async () => (await import('../app/(app)/modules/page')).default()],
  // My CV: only while UF_CV is on (cv-page-server.test.tsx renders it); the gate comes first.
  ['/cv', async () => (await import('../app/(app)/cv/page')).default()],
];

let n = 5_000_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function lastSms(browser: Browser, to: string) {
  const { body } = await browser.json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const e164 = `+27${to.slice(1)}`;
  return body.messages.find((m) => m.to === e164)?.body ?? '';
}

async function signedIn() {
  const browser = new Browser();
  const number = phone();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const pin = (await lastSms(browser, number)).match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  return browser;
}

/** Where a server component redirected to, or what it threw instead. */
async function outcome(render: () => Promise<unknown>): Promise<string> {
  try {
    await render();
    return 'rendered';
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT;')) {
      return `redirect ${digest.split(';')[2]}`;
    }
    if (error instanceof ConsentRequiredError) return 'ConsentRequiredError';
    throw error;
  }
}

describe('signed-in pages before the database may process a learner (A1-10)', () => {
  it.each(pages)('%s sends a learner with no date of birth to onboarding', async (_, render) => {
    const browser = await signedIn();
    browser.enter();
    expect(await outcome(render)).toBe('redirect /onboarding');
  });

  it.each(pages)('%s sends a minor waiting for a guardian to onboarding', async (_, render) => {
    const browser = await signedIn();
    await browser.json(routes.dob, '/api/me/date-of-birth', {
      json: { dateOfBirth: '2010-05-05' },
    });
    await browser.json(routes.guardian, '/api/me/guardian', {
      json: { name: 'Test Guardian', phone: phone(), relationship: 'parent' },
    });
    browser.enter();
    expect(await outcome(render)).toBe('redirect /onboarding');
  });

  it.each(pages)('%s sends a signed-out visitor to sign-in', async (_, render) => {
    new Browser().enter();
    expect(await outcome(render)).toBe('redirect /sign-in');
  });

  // /cv is not there with the switch off (cv-page-server.test.tsx renders it with it on).
  it.each(pages.filter(([name]) => name !== '/applications/uj' && name !== '/cv'))(
    '%s still renders for a ready learner',
    async (_, render) => {
      const browser = await signedIn();
      await browser.json(routes.dob, '/api/me/date-of-birth', {
        json: { dateOfBirth: '2000-02-02' },
      });
      await agreeAsAdult(browser);
      browser.enter();
      expect(await outcome(render)).toBe('rendered');
    },
  );
});
