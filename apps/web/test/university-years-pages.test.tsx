import { en } from '@universityflow/content';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Chat } from '../app/(app)/chat/chat';
import { agreeAsAdult } from './adult-consent';
import { Browser } from './harness';

/**
 * A2-66 and A2-68 (DEMO-walk) over the real pages, an embedded database and the preview
 * catalogue: a student already at university (like the demo's Sipho, second year at Wits, and
 * Kagiso, final year) gets a home, a chat and an Applications page for where they are, never an
 * arriving or school learner's. Their year is the confirmed registration's, read against the
 * course's duration in the catalogue (wits-bcom: three years). Synthetic data only.
 */

vi.mock('next/headers', async () => (await import('./harness')).nextHeaders);

const routes = {
  requestPin: (await import('../app/api/auth/request-pin/route')).POST,
  verifyPin: (await import('../app/api/auth/verify-pin/route')).POST,
  dob: (await import('../app/api/me/date-of-birth/route')).POST,
  outbox: (await import('../app/api/dev/outbox/route')).GET,
  registration: await import('../app/api/registration/route'),
  chat: await import('../app/api/chat/route'),
};

const ApplicationsPage = (await import('../app/(app)/applications/page')).default;
const ChatPage = (await import('../app/(app)/chat/page')).default;
const HomePage = (await import('../app/(app)/home/page')).default;
const { demoLearnerSignedIn } = await import('../lib/server/session');

let n = 8_600_000;
/** A synthetic number, built at runtime (hard rule 4). */
const phone = () => `082${String(n++).padStart(7, '0')}`;

async function adult() {
  const browser = new Browser();
  const number = phone();
  await browser.json(routes.requestPin, '/api/auth/request-pin', { json: { phone: number } });
  const { body } = await browser.json<{ messages: Array<{ to: string; body: string }> }>(
    routes.outbox,
    '/api/dev/outbox',
  );
  const pin = body.messages
    .find((m) => m.to === `+27${number.slice(1)}`)
    ?.body.match(/\b(\d{6})\b/)?.[1];
  await browser.json(routes.verifyPin, '/api/auth/verify-pin', { json: { phone: number, pin } });
  await browser.json(routes.dob, '/api/me/date-of-birth', { json: { dateOfBirth: '2005-02-02' } });
  await agreeAsAdult(browser);
  return browser;
}

/** A confirmed registration in this year of a three-year course, with two sample rows. */
async function registered(yearOfStudy: number | null) {
  const browser = await adult();
  const saved = await browser.json(routes.registration.PUT, '/api/registration', {
    method: 'PUT',
    json: {
      programmeId: 'wits-bcom',
      academicYear: 2026,
      yearOfStudy,
      modules: [
        { code: 'SAMP201', name: 'Sample module one', term: 'S1', credits: null },
        { code: 'SAMP202', name: 'Sample module two', term: 'S2', credits: null },
      ],
    },
  });
  expect(saved.status).toBe(200);
  browser.enter();
  return browser;
}

type ChatProps = Parameters<typeof Chat>[0];

describe('a student at university (A2-66, A2-68)', () => {
  it('a second year’s home is his year’s: no first weeks, no campus tour "before your first day"', async () => {
    await registered(2);
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain(en.dashboard.subtitleYears.middle);
    expect(html).not.toContain(en.dashboard.subtitle.university);
    expect(html).not.toContain(en.dashboard.promo.campusLead);
    expect(html).not.toContain(en.dashboard.chart.none);
    expect(html).toContain(en.dashboard.year.title);
  });

  it('a final year’s home says so', async () => {
    await registered(3);
    const html = renderToStaticMarkup(await HomePage());
    expect(html).toContain(en.dashboard.subtitleYears.final);
    expect(html).toContain(en.dashboard.year.final);
  });

  it('a second year’s chat welcome asks for no school report, on the web and from the API', async () => {
    const browser = await registered(2);
    const page = (await ChatPage()) as { props: ChatProps };
    expect(page.props.welcome).toBe('later-years');
    const { body } = await browser.json<{ welcome: string }>(routes.chat.GET, '/api/chat');
    expect(body.welcome).toBe('later-years');
  });

  it('a first year arrives: the arrival’s chat welcome', async () => {
    await registered(1);
    const page = (await ChatPage()) as { props: ChatProps };
    expect(page.props.welcome).toBe('arriving');
  });

  it('a school learner keeps the school welcome', async () => {
    (await adult()).enter();
    const page = (await ChatPage()) as { props: ChatProps };
    expect(page.props.welcome).toBe('school');
  });

  // A2-68: Applications said "Your shortlist is empty. Add courses from My results."
  it('Applications says there is nothing to apply for at university, and points to My modules', async () => {
    await registered(2);
    const html = renderToStaticMarkup(await ApplicationsPage());
    expect(html).toContain(en.applications.atUniversity);
    expect(html).not.toContain(en.applications.empty);
    expect(html).toContain('href="/modules"');
    expect(html).toContain(en.applications.atUniversityAction);
  });

  it('the demo banner’s "Switch learner" shows only with a learner signed in (A2-67)', async () => {
    new Browser().enter();
    expect(await demoLearnerSignedIn()).toBe(false);
    (await adult()).enter();
    expect(await demoLearnerSignedIn()).toBe(true);
  });

  it('Applications keeps the shortlist’s empty state before university', async () => {
    (await adult()).enter();
    const html = renderToStaticMarkup(await ApplicationsPage());
    expect(html).toContain(en.applications.empty);
    expect(html).not.toContain(en.applications.atUniversity);
  });
});
